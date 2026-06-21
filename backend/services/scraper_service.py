import json
import logging
import threading
import time
import traceback
from contextlib import contextmanager
from datetime import datetime
from typing import Optional

import pandas as pd
from sqlalchemy.orm import Session

from models.job import Job
from models.scrape_config import ScrapeConfig, ScrapeRun
from services.deduplication import generate_external_id

logger = logging.getLogger("jobhunter.scraper")

# Substrings that mark a transient failure worth retrying vs. a hard block by
# the remote site's bot protection (expected for ZipRecruiter/Glassdoor when
# scraping without proxies — not a code bug).
_TRANSIENT_MARKERS = (
    "429", "too many requests", "timed out", "timeout",
    "temporarily", "connection", "read timed out", "503", "502",
)
_BLOCKED_MARKERS = ("403", "forbidden", "captcha", "blocked", "400")

# jobspy fires each scrape on its own per-site logger ("JobSpy:Indeed", ...),
# and the capture below swaps those loggers' handlers process-wide, so concurrent
# scrapes (scheduler + manual run) must not overlap. Serialize them.
_scrape_lock = threading.Lock()

SKILL_KEYWORDS = {
    "high_value": [
        "power bi", "tableau", "sql", "python", "data visualization",
        "business intelligence", "etl", "data warehouse", "dax",
        "data modeling", "apache spark", "aws",
    ],
    "medium_value": [
        "excel", "data analysis", "reporting", "dashboard",
        "statistics", "machine learning", "r", "jupyter",
        "pandas", "numpy", "matplotlib", "snowflake",
        "azure", "google cloud", "bigquery",
    ],
    "low_value": [
        "communication", "teamwork", "problem solving",
        "agile", "scrum", "jira", "git", "github",
    ],
}

TITLE_BONUS_KEYWORDS = [
    "data analyst", "bi analyst", "business intelligence",
    "analytics", "data engineer", "reporting analyst",
]

NEGATIVE_KEYWORDS = [
    "senior", "lead", "principal", "director", "manager",
    "10+ years", "8+ years", "7+ years", "staff",
]


def calculate_match_score(title: str, description: str, location: str, job_type: str) -> float:
    title_lower = (title or "").lower()
    desc_lower = (description or "").lower()
    loc_lower = (location or "").lower()
    jtype_lower = (job_type or "").lower()

    score = 0.0

    for kw in SKILL_KEYWORDS["high_value"]:
        if kw in desc_lower:
            score += 5
    for kw in SKILL_KEYWORDS["medium_value"]:
        if kw in desc_lower:
            score += 3
    for kw in SKILL_KEYWORDS["low_value"]:
        if kw in desc_lower:
            score += 1

    if any(kw in title_lower for kw in TITLE_BONUS_KEYWORDS):
        score += 15

    for neg in NEGATIVE_KEYWORDS:
        if neg in title_lower or neg in desc_lower:
            score -= 10

    if "charlotte" in loc_lower or "remote" in loc_lower:
        score += 10

    if jtype_lower in ("internship", "co-op", "coop"):
        score += 5

    return max(0.0, min(100.0, score))


# Sites handled by a dedicated scraper instead of jobspy.
YC_SITE = "ycombinator"
_CUSTOM_SITES = {YC_SITE, "y_combinator", "yc"}


def _map_site_name(site: str) -> str:
    """Normalize site names between our config and jobspy."""
    mapping = {
        "zip_recruiter": "zip_recruiter",
        "ziprecruiter": "zip_recruiter",
        "y_combinator": YC_SITE,
        "yc": YC_SITE,
    }
    return mapping.get(site.lower(), site.lower())


class _ListLogHandler(logging.Handler):
    """Collects jobspy's WARNING/ERROR records instead of letting them print
    to the server console."""

    def __init__(self):
        super().__init__(level=logging.WARNING)
        self.messages = []

    def emit(self, record):
        self.messages.append(record.getMessage())


@contextmanager
def _capture_jobspy_logs():
    """Redirect every ``JobSpy:*`` logger into a single in-memory handler for
    the duration of a scrape, then restore the originals. This stops blocked
    external sites from flooding stderr and lets us attach their messages to
    the ScrapeRun record instead."""
    handler = _ListLogHandler()
    touched = []
    for name in list(logging.root.manager.loggerDict):
        if not str(name).startswith("JobSpy"):
            continue
        lg = logging.getLogger(name)
        touched.append((lg, lg.handlers))
        lg.handlers = [handler]
    try:
        yield handler
    finally:
        for lg, saved in touched:
            lg.handlers = saved


def _scrape_one(scrape_jobs, site, term, loc, config, max_retries=2):
    """Scrape a single site for one (term, location). Returns
    (DataFrame|None, log_messages, status) where status is one of
    'ok', 'empty', 'blocked', 'error'. Retries transient failures."""
    google_term = config.google_search_term
    # The Google Jobs scraper returns nothing without a natural-language query.
    if site == "google" and not google_term:
        google_term = f"{term} jobs near {loc}".strip()

    attempt = 0
    while True:
        with _capture_jobspy_logs() as cap:
            try:
                df = scrape_jobs(
                    site_name=[site],
                    search_term=term,
                    location=loc,
                    distance=config.distance,
                    results_wanted=config.results_per_site,
                    hours_old=config.max_age_hours,
                    is_remote=config.include_remote,
                    google_search_term=google_term if site == "google" else None,
                )
                raised = None
            except Exception as e:  # network/parse errors jobspy didn't swallow
                df, raised = None, e

        msgs = list(cap.messages)
        if raised is not None:
            msgs.append(f"exception: {raised}")
        blob = " ".join(msgs).lower()

        if raised is None and df is not None and not df.empty:
            return df, [], "ok"

        if any(k in blob for k in _TRANSIENT_MARKERS) and attempt < max_retries:
            attempt += 1
            time.sleep(2 ** attempt)
            continue

        if raised is not None:
            return None, msgs, "error"
        if any(k in blob for k in _BLOCKED_MARKERS):
            return None, msgs, "blocked"
        return None, msgs, "empty"


async def run_scrape(db: Session, config_id: int) -> dict:
    config = db.query(ScrapeConfig).filter(ScrapeConfig.id == config_id).first()
    if not config:
        raise ValueError(f"ScrapeConfig {config_id} not found")

    run = ScrapeRun(config_id=config.id, started_at=datetime.utcnow(), status="running")
    db.add(run)
    db.commit()
    db.refresh(run)

    log_lines = []
    total_found = 0
    new_jobs = 0
    duplicates = 0
    errors_list = []

    try:
        from jobspy import scrape_jobs

        sites = [_map_site_name(s) for s in config.sites]
        all_results = []

        # Y Combinator is scraped via its own module (jobspy can't reach it) and
        # is a global source, so split it out of the per-location jobspy loop.
        yc_requested = YC_SITE in sites
        jobspy_sites = [s for s in sites if s not in _CUSTOM_SITES]

        # Support both old single-location and new multi-location format
        locations = config.locations if config.locations else ["Charlotte, NC"]
        if isinstance(locations, str):
            locations = [locations]

        if yc_requested:
            try:
                from services.yc_scraper import scrape_yc

                yc_df = scrape_yc(
                    search_terms=config.search_terms,
                    locations=locations,
                    results_wanted=config.results_per_site,
                    include_remote=config.include_remote,
                )
                if yc_df is not None and not yc_df.empty:
                    all_results.append(yc_df)
                    log_lines.append(f"  ycombinator: {len(yc_df)} results")
                else:
                    log_lines.append("  ycombinator: no results")
            except Exception as e:
                err_msg = f"ycombinator error: {e}"
                log_lines.append(f"  {err_msg}")
                errors_list.append(err_msg)

        blocked_sites = set()
        with _scrape_lock:
            for loc in locations:
                for term in config.search_terms:
                    log_lines.append(f"Searching: '{term}' in '{loc}' on {jobspy_sites}")
                    for site in jobspy_sites:
                        df, msgs, status = _scrape_one(scrape_jobs, site, term, loc, config)
                        if status == "ok":
                            all_results.append(df)
                            log_lines.append(f"  {site}: {len(df)} results")
                        elif status == "empty":
                            log_lines.append(f"  {site}: no results")
                        elif status == "blocked":
                            # Expected when the remote site blocks bots (no proxies).
                            # Log it, but don't treat it as a run error every time.
                            blocked_sites.add(site)
                            log_lines.append(f"  {site}: blocked by remote site (skipped)")
                        else:  # error — a genuine, unexpected failure
                            detail = msgs[-1] if msgs else "unknown error"
                            err_msg = f"{site} error for '{term}' in '{loc}': {detail}"
                            log_lines.append(f"  {err_msg}")
                            errors_list.append(err_msg)

        if blocked_sites:
            log_lines.append(
                "Sites blocked by bot protection (need proxies to scrape): "
                + ", ".join(sorted(blocked_sites))
            )

        if all_results:
            combined = pd.concat(all_results, ignore_index=True)
            if "job_url" in combined.columns:
                combined = combined.drop_duplicates(subset=["job_url"])
            total_found = len(combined)
            log_lines.append(f"Total unique results: {total_found}")

            for _, row in combined.iterrows():
                job_url = str(row.get("job_url", ""))
                if not job_url or job_url == "nan":
                    continue

                ext_id = generate_external_id(job_url)
                existing = db.query(Job).filter(Job.external_id == ext_id).first()
                if existing:
                    duplicates += 1
                    continue

                title = str(row.get("title", "")) if pd.notna(row.get("title")) else ""
                company = str(row.get("company", "")) if pd.notna(row.get("company")) else None
                location_val = str(row.get("location", "")) if pd.notna(row.get("location")) else None
                description = str(row.get("description", "")) if pd.notna(row.get("description")) else None
                job_type = str(row.get("job_type", "")) if pd.notna(row.get("job_type")) else None
                source = str(row.get("site", "")) if pd.notna(row.get("site")) else "unknown"

                min_salary = None
                max_salary = None
                if pd.notna(row.get("min_amount")):
                    try:
                        min_salary = float(row["min_amount"])
                    except (ValueError, TypeError):
                        pass
                if pd.notna(row.get("max_amount")):
                    try:
                        max_salary = float(row["max_amount"])
                    except (ValueError, TypeError):
                        pass

                date_posted = None
                if pd.notna(row.get("date_posted")):
                    try:
                        date_posted = pd.to_datetime(row["date_posted"])
                    except Exception:
                        pass

                is_remote = bool(row.get("is_remote", False)) if pd.notna(row.get("is_remote")) else False

                city = str(row.get("city", "")) if pd.notna(row.get("city")) else None
                state = str(row.get("state", "")) if pd.notna(row.get("state")) else None

                match_score = calculate_match_score(
                    title, description or "", location_val or "", job_type or ""
                )

                job = Job(
                    external_id=ext_id,
                    title=title,
                    company=company,
                    location=location_val,
                    city=city,
                    state=state,
                    is_remote=is_remote,
                    job_type=job_type,
                    source=source,
                    job_url=job_url,
                    description=description,
                    min_salary=min_salary,
                    max_salary=max_salary,
                    date_posted=date_posted,
                    date_scraped=datetime.utcnow(),
                    status="new",
                    match_score=match_score,
                    scrape_config_id=config.id,
                )
                db.add(job)
                new_jobs += 1

            db.commit()
            log_lines.append(f"New jobs added: {new_jobs}, Duplicates skipped: {duplicates}")
        else:
            log_lines.append("No results from any search term.")

        run.status = "completed" if not errors_list else "partial"
    except Exception as e:
        log_lines.append(f"Fatal error: {traceback.format_exc()}")
        errors_list.append(str(e))
        run.status = "failed"

    run.completed_at = datetime.utcnow()
    run.total_found = total_found
    run.new_jobs = new_jobs
    run.duplicates = duplicates
    run.errors = json.dumps(errors_list) if errors_list else None
    run.log = "\n".join(log_lines)
    db.commit()
    db.refresh(run)

    return {
        "run_id": run.id,
        "status": run.status,
        "total_found": total_found,
        "new_jobs": new_jobs,
        "duplicates": duplicates,
        "errors": errors_list,
    }
