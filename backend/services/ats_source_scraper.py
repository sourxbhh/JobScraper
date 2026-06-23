"""ATS job-board scrapers (Greenhouse / Lever / Ashby).

jobspy (the library backing Indeed/LinkedIn/Glassdoor/etc.) does not support the
applicant-tracking-system boards that most tech companies actually post on, and
the big aggregators it does support — Glassdoor, ZipRecruiter, Google — are
routinely blocked by bot protection when scraped without proxies. These three
ATS platforms, by contrast, expose clean, free, public JSON APIs that need no
credentials, so they are reliable sources.

We reuse the curated company registry in ``backend/data/portals.yml`` (the same
list the /career-ops ATS scanner uses) as the set of boards to fetch, then return
a DataFrame whose columns match what ``scraper_service.run_scrape`` expects from a
jobspy result. Search-term / location filtering happens here (the APIs return a
company's whole board), mirroring the Y Combinator scraper.
"""
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from html import unescape
from urllib.request import Request, urlopen

import pandas as pd
import yaml

logger = logging.getLogger("jobhunter.scraper.ats")

PORTALS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "portals.yml")

# Site names we expose to the rest of the app (config, filters, Job.source).
ATS_PLATFORMS = ("greenhouse", "lever", "ashby")

_UA = {"User-Agent": "Mozilla/5.0 (JobHunterXX ATS scraper)"}
_TAG_RE = re.compile(r"<[^>]+>")


def _fetch(url, timeout=25):
    import json
    try:
        with urlopen(Request(url, headers=_UA), timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        return {"__error__": str(e)}


def _slug_from(url):
    m = re.search(r"/([^/]+)/?$", (url or "").rstrip("/"))
    return m.group(1) if m else None


def _strip_html(text: str | None) -> str:
    if not text:
        return ""
    return _TAG_RE.sub(" ", unescape(text)).strip()


def _parse_ts(s):
    if not s:
        return None
    try:
        if isinstance(s, (int, float)):  # lever = ms epoch
            return datetime.fromtimestamp(s / 1000, timezone.utc)
        return datetime.fromisoformat(str(s).replace("Z", "+00:00"))
    except Exception:
        return None


def _split_location(location: str | None) -> tuple[str | None, str | None]:
    """Best-effort (city, state) from a 'City, ST' style location string."""
    if not location:
        return None, None
    primary = location.split("/")[0].strip()
    parts = [p.strip() for p in primary.split(",")]
    if len(parts) == 2 and len(parts[1]) <= 3:
        return parts[0] or None, parts[1] or None
    return None, None


# ── per-platform fetchers: each returns a list of normalized job dicts ──

def _greenhouse(company: str, api: str) -> list[dict]:
    # content=true embeds each posting's full (HTML) description in one call.
    d = _fetch(api + "?content=true")
    if not isinstance(d, dict) or "__error__" in d:
        raise RuntimeError(d.get("__error__", "bad response") if isinstance(d, dict) else "bad response")
    out = []
    for j in d.get("jobs", []):
        out.append({
            "title": j.get("title", ""),
            "company": company,
            "location": (j.get("location") or {}).get("name", ""),
            "description": _strip_html(j.get("content")),
            "job_url": j.get("absolute_url", ""),
            "date_posted": _parse_ts(j.get("updated_at") or j.get("first_published")),
        })
    return out


def _lever(company: str, slug: str) -> list[dict]:
    d = _fetch(f"https://api.lever.co/v0/postings/{slug}?mode=json")
    if isinstance(d, dict) and "__error__" in d:
        raise RuntimeError(d["__error__"])
    out = []
    for j in (d if isinstance(d, list) else []):
        out.append({
            "title": j.get("text", ""),
            "company": company,
            "location": (j.get("categories") or {}).get("location", ""),
            "description": _strip_html(j.get("descriptionPlain") or j.get("description")),
            "job_url": j.get("hostedUrl", ""),
            "date_posted": _parse_ts(j.get("createdAt")),
            "job_type": ((j.get("categories") or {}).get("commitment") or "").lower() or None,
        })
    return out


def _ashby(company: str, slug: str) -> list[dict]:
    d = _fetch(f"https://api.ashbyhq.com/posting-api/job-board/{slug}?includeCompensation=true")
    if isinstance(d, dict) and "__error__" in d:
        raise RuntimeError(d["__error__"])
    out = []
    for j in (d.get("jobs", []) if isinstance(d, dict) else []):
        out.append({
            "title": j.get("title", ""),
            "company": company,
            "location": j.get("location", ""),
            "description": _strip_html(j.get("descriptionPlain") or j.get("descriptionHtml")),
            "job_url": j.get("jobUrl", ""),
            "date_posted": _parse_ts(j.get("publishedAt") or j.get("updatedAt")),
            "job_type": (j.get("employmentType") or "").lower() or None,
            "is_remote": bool(j.get("isRemote")),
        })
    return out


def _board_tasks(companies: list[dict], platforms: set[str]) -> list[tuple]:
    """Map enabled tracked_companies to (platform, fetch_fn, company, arg)."""
    tasks = []
    for c in companies:
        if not c.get("enabled", True):
            continue
        name, url, api = c["name"], c.get("careers_url", ""), c.get("api")
        if api and "greenhouse" in api and "greenhouse" in platforms:
            tasks.append(("greenhouse", _greenhouse, name, api))
        elif "greenhouse.io" in url and "greenhouse" in platforms:
            slug = _slug_from(url)
            tasks.append(("greenhouse", _greenhouse, name,
                          f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"))
        elif "lever.co" in url and "lever" in platforms:
            tasks.append(("lever", _lever, name, _slug_from(url)))
        elif "ashbyhq.com" in url and "ashby" in platforms:
            tasks.append(("ashby", _ashby, name, _slug_from(url)))
    return tasks


def _matches_terms(job: dict, terms: list[str]) -> bool:
    if not terms:
        return True
    haystack = " ".join(
        str(job.get(k, "") or "") for k in ("title", "company", "description")
    ).lower()
    return any(t.lower().strip() in haystack for t in terms if t.strip())


def _matches_location(job: dict, user_locations: list[str], include_remote: bool) -> bool:
    loc_lower = (job.get("location") or "").lower()
    is_remote = job.get("is_remote") or "remote" in loc_lower
    if is_remote and include_remote:
        return True
    if not user_locations:
        return True
    for ul in user_locations:
        city = ul.split(",")[0].strip().lower()
        if city and city in loc_lower:
            return True
        # also match the bare state code, e.g. "NC"
        parts = [p.strip().lower() for p in ul.split(",")]
        if len(parts) == 2 and parts[1] and parts[1] in loc_lower:
            return True
    return False


def scrape_ats_sources(
    platforms: list[str],
    search_terms: list[str],
    locations: list[str],
    results_wanted: int = 25,
    include_remote: bool = True,
) -> pd.DataFrame:
    """Fetch jobs from the requested ATS platforms across the companies tracked in
    portals.yml, filter by search terms / locations, and return a jobspy-shaped
    DataFrame. ``results_wanted`` caps results *per platform*.
    """
    want = {p for p in platforms if p in ATS_PLATFORMS}
    if not want:
        return pd.DataFrame()

    with open(PORTALS_PATH, encoding="utf-8") as fh:
        cfg = yaml.safe_load(fh) or {}
    companies = cfg.get("tracked_companies", [])
    tasks = _board_tasks(companies, want)

    raw: list[dict] = []
    with ThreadPoolExecutor(max_workers=8) as pool:
        futures = {pool.submit(fn, name, arg): (platform, name)
                   for platform, fn, name, arg in tasks}
        for fut in as_completed(futures):
            platform, name = futures[fut]
            try:
                for job in fut.result():
                    job["site"] = platform
                    raw.append(job)
            except Exception as e:  # one bad board shouldn't fail the whole scrape
                logger.debug("ATS fetch failed for %s (%s): %s", name, platform, e)

    per_platform: dict[str, int] = {}
    rows: list[dict] = []
    for job in raw:
        if not job.get("job_url") or not job.get("title"):
            continue
        if not _matches_terms(job, search_terms):
            continue
        if not _matches_location(job, locations, include_remote):
            continue
        site = job["site"]
        if per_platform.get(site, 0) >= results_wanted:
            continue
        per_platform[site] = per_platform.get(site, 0) + 1

        location = job.get("location") or ""
        city, state = _split_location(location)
        rows.append({
            "title": job.get("title"),
            "company": job.get("company"),
            "location": location,
            "description": job.get("description") or "",
            "job_type": job.get("job_type"),
            "site": site,
            "job_url": job.get("job_url"),
            "min_amount": None,
            "max_amount": None,
            "date_posted": job.get("date_posted"),
            "is_remote": bool(job.get("is_remote") or "remote" in location.lower()),
            "city": city,
            "state": state,
        })

    logger.info(
        "ATS scrape: %d boards, %d raw postings, %d kept (%s)",
        len(tasks), len(raw), len(rows), per_platform,
    )
    return pd.DataFrame(rows)
