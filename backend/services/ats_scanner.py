"""Direct ATS API scanner (Greenhouse / Lever / Ashby).

Ported from career-ops scan-apis.py + verify-employers.py, but instead of writing
scan-results.json it inserts jobs straight into the JobHunterXX DB (reusing dedup +
match scoring) and logs a ScrapeRun, so results show up in the existing UI.

Reads tracked companies + title filter from backend/data/portals.yml.
"""
import datetime as dt
import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from urllib.request import Request, urlopen

import yaml
from sqlalchemy.orm import Session

from models.job import Job
from models.scrape_config import ScrapeConfig, ScrapeRun
from services.deduplication import generate_external_id
from services.scraper_service import calculate_match_score

PORTALS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "portals.yml")
ATS_CONFIG_NAME = "ATS Direct (Greenhouse/Lever/Ashby)"
_UA = {"User-Agent": "Mozilla/5.0 (JobHunterXX ATS scanner)"}
_NOW = lambda: dt.datetime.now(dt.timezone.utc)


# ── low-level fetch + platform parsers (from scan-apis.py) ──

def _fetch(url, timeout=25):
    try:
        with urlopen(Request(url, headers=_UA), timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        return {"__error__": str(e)}


def _slug_from(url):
    m = re.search(r"/([^/]+)/?$", (url or "").rstrip("/"))
    return m.group(1) if m else None


def _parse_ts(s):
    if not s:
        return None
    try:
        if isinstance(s, (int, float)):  # lever = ms epoch
            return dt.datetime.fromtimestamp(s / 1000, dt.timezone.utc)
        return dt.datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def _greenhouse(company, api):
    d = _fetch(api + "?content=false")
    if "__error__" in d:
        return [], d["__error__"]
    out = []
    for j in d.get("jobs", []):
        out.append({
            "company": company, "title": j.get("title", ""),
            "url": j.get("absolute_url", ""), "platform": "greenhouse",
            "ts": _parse_ts(j.get("updated_at")),
            "location": (j.get("location") or {}).get("name", ""),
        })
    return out, None


def _lever(company, slug):
    d = _fetch(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if isinstance(d, dict) and "__error__" in d:
        return [], d["__error__"]
    out = []
    for j in (d if isinstance(d, list) else []):
        out.append({
            "company": company, "title": j.get("text", ""),
            "url": j.get("hostedUrl", ""), "platform": "lever",
            "ts": _parse_ts(j.get("createdAt")),
            "location": (j.get("categories") or {}).get("location", ""),
        })
    return out, None


def _ashby(company, slug):
    d = _fetch(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=false")
    if isinstance(d, dict) and "__error__" in d:
        return [], d["__error__"]
    out = []
    for j in (d.get("jobs", []) if isinstance(d, dict) else []):
        out.append({
            "company": company, "title": j.get("title", ""),
            "url": j.get("jobUrl", ""), "platform": "ashby",
            "ts": _parse_ts(j.get("publishedAt") or j.get("updatedAt")),
            "location": j.get("location", ""),
        })
    return out, None


def _classify(title, tf):
    t = (title or "").lower()
    if not any(p.lower() in t for p in tf["positive"]):
        return False
    if any(n.lower() in t for n in tf["negative"]):
        return False
    return True


def _load_portals():
    with open(PORTALS_PATH, encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _build_tasks(companies):
    tasks = []
    for c in companies:
        name, url = c["name"], c.get("careers_url", "")
        if c.get("api"):
            tasks.append((_greenhouse, name, c["api"]))
        elif "lever.co" in url:
            tasks.append((_lever, name, _slug_from(url)))
        elif "ashbyhq.com" in url:
            tasks.append((_ashby, name, _slug_from(url)))
        # custom careers pages need Playwright -> skipped at API layer
    return tasks


def get_portals_summary() -> dict:
    cfg = _load_portals()
    companies = cfg.get("tracked_companies", [])
    enabled = [c for c in companies if c.get("enabled", True)]
    by_platform = {}
    for fn, _, _ in _build_tasks(enabled):
        key = {"_greenhouse": "greenhouse", "_lever": "lever", "_ashby": "ashby"}[fn.__name__]
        by_platform[key] = by_platform.get(key, 0) + 1
    return {
        "total_companies": len(companies),
        "enabled": len(enabled),
        "scannable_via_api": sum(by_platform.values()),
        "by_platform": by_platform,
        "title_positive": cfg["title_filter"]["positive"],
        "title_negative": cfg["title_filter"]["negative"],
    }


def ensure_ats_config(db: Session) -> ScrapeConfig:
    """Return (creating if needed) the pseudo-config used to log ATS runs."""
    cfg = db.query(ScrapeConfig).filter(ScrapeConfig.name == ATS_CONFIG_NAME).first()
    if cfg:
        return cfg
    cfg = ScrapeConfig(
        name=ATS_CONFIG_NAME,
        search_terms=["(title filter from portals.yml)"],
        sites=["greenhouse", "lever", "ashby"],
        locations=["(per company)"],
        schedule=None,
        is_active=False,  # not run by the scheduler; manual trigger only
    )
    db.add(cfg)
    db.commit()
    db.refresh(cfg)
    return cfg


def run_ats_scan(db: Session) -> dict:
    """Scan all enabled ATS companies and insert new matching jobs into the DB."""
    cfg = ensure_ats_config(db)
    run = ScrapeRun(config_id=cfg.id, started_at=dt.datetime.utcnow(), status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    log, errors, total_found, new_jobs, duplicates = [], [], 0, 0, 0
    try:
        portals = _load_portals()
        tf = portals["title_filter"]
        companies = [c for c in portals.get("tracked_companies", []) if c.get("enabled", True)]
        tasks = _build_tasks(companies)
        log.append(f"Querying {len(tasks)} ATS endpoints...")

        all_jobs = []
        with ThreadPoolExecutor(max_workers=12) as ex:
            futs = {ex.submit(fn, name, arg): name for fn, name, arg in tasks}
            for f in as_completed(futs):
                jobs, err = f.result()
                if err:
                    errors.append(f"{futs[f]}: {err}")
                all_jobs.extend(jobs)

        matches = [j for j in all_jobs if _classify(j["title"], tf) and j.get("url")]
        total_found = len(matches)
        log.append(f"Pulled {len(all_jobs)} postings, {total_found} title matches.")

        for j in matches:
            url = j["url"]
            ext_id = generate_external_id(url)
            if db.query(Job).filter(Job.external_id == ext_id).first():
                duplicates += 1
                continue

            score = calculate_match_score(j["title"], "", j.get("location", ""), "")
            ts = j.get("ts")
            db.add(Job(
                external_id=ext_id,
                title=j["title"],
                company=j["company"],
                location=j.get("location") or None,
                is_remote="remote" in (j.get("location") or "").lower(),
                source=j["platform"],
                job_url=url,
                date_posted=ts.replace(tzinfo=None) if ts else None,
                date_scraped=dt.datetime.utcnow(),
                status="new",
                match_score=score,
                scrape_config_id=cfg.id,
            ))
            new_jobs += 1

        db.commit()
        log.append(f"New jobs added: {new_jobs}, duplicates skipped: {duplicates}")
        run.status = "completed" if not errors else "partial"
    except Exception as e:
        import traceback
        log.append(f"Fatal: {traceback.format_exc()}")
        errors.append(str(e))
        run.status = "failed"

    run.completed_at = dt.datetime.utcnow()
    run.total_found = total_found
    run.new_jobs = new_jobs
    run.duplicates = duplicates
    run.errors = json.dumps(errors) if errors else None
    run.log = "\n".join(log)
    db.commit()
    db.refresh(run)
    return {
        "run_id": run.id, "status": run.status, "total_found": total_found,
        "new_jobs": new_jobs, "duplicates": duplicates, "errors": errors,
    }


# ── Employer verification (ported from verify-employers.py) ──

_POS = ["data analyst", "business analyst", "business intelligence", "bi analyst",
        "analytics engineer", "analytics analyst", "reporting analyst", "data scientist",
        "data engineer", "insights analyst"]
_NEG = ["intern", "manager", "director", "head of", "vp", "principal", "staff", "sales",
        "clearance", "account executive"]


def _count_analyst_roles(jobs):
    n = 0
    for j in jobs:
        t = (j.get("title") or "").lower()
        if any(p in t for p in _POS) and not any(x in t for x in _NEG):
            n += 1
    return n


def verify_employers() -> dict:
    """Ping each enabled ATS endpoint, report live/dead and analyst-role counts."""
    portals = _load_portals()
    companies = [c for c in portals.get("tracked_companies", []) if c.get("enabled", True)]
    tasks = _build_tasks(companies)

    live, dead, no_match = [], [], []
    with ThreadPoolExecutor(max_workers=12) as ex:
        futs = {ex.submit(fn, name, arg): (name, fn.__name__) for fn, name, arg in tasks}
        for f in as_completed(futs):
            name, fnname = futs[f]
            platform = {"_greenhouse": "greenhouse", "_lever": "lever", "_ashby": "ashby"}[fnname]
            jobs, err = f.result()
            if err:
                dead.append({"name": name, "platform": platform, "error": err[:120]})
                continue
            count = _count_analyst_roles(jobs)
            entry = {"name": name, "platform": platform, "total_roles": len(jobs),
                     "analyst_roles": count}
            (live if count > 0 else no_match).append(entry)

    live.sort(key=lambda e: e["analyst_roles"], reverse=True)
    return {
        "checked": len(tasks),
        "live": live,
        "no_analyst_match": no_match,
        "dead": dead,
    }
