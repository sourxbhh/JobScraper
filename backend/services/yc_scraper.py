"""Y Combinator jobs scraper.

jobspy (the library backing the other sources) does not support Y Combinator, so
this module fetches YC jobs directly. The public jobs page at
https://www.ycombinator.com/jobs is an Inertia.js app that server-renders its
data into a ``<div id="app" data-page="...">`` blob. We parse that JSON instead
of relying on the Algolia search backend, whose API keys rotate and require no
stable public credentials.

The listing page exposes ~20 recent/active postings (title, company, salary,
skills, location). Each posting's detail page adds the full description. We
filter by the config's search terms / locations and return a DataFrame whose
columns match what ``scraper_service.run_scrape`` expects from a jobspy result.
"""
import json
import logging
import re
from datetime import datetime
from html import unescape

import pandas as pd
import requests

logger = logging.getLogger("jobhunter.scraper.yc")

YC_BASE = "https://www.ycombinator.com"
YC_JOBS_URL = f"{YC_BASE}/jobs"
SITE_NAME = "ycombinator"

# YC's /jobs page defaults to the Engineering category only (~20 postings), so a
# data-analyst search against it always returns nothing. The full board is split
# across these role categories, each reachable at /jobs/role/<category>. We fetch
# all of them and let the search-term filter decide what's relevant — analyst
# roles mostly live under "operations", but YC files them inconsistently.
YC_ROLE_CATEGORIES = (
    "eng", "design", "product", "science", "sales",
    "marketing", "support", "operations", "recruiting", "finance", "legal",
)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml",
}

_DATA_PAGE_RE = re.compile(r'data-page="(.*?)"', re.S)


def _fetch_props(url: str, timeout: int = 20) -> dict | None:
    """Fetch an Inertia page and return its ``props`` dict, or None."""
    resp = requests.get(url, headers=_HEADERS, timeout=timeout)
    resp.raise_for_status()
    match = _DATA_PAGE_RE.search(resp.text)
    if not match:
        return None
    data = json.loads(unescape(match.group(1)))
    return data.get("props")


def _fetch_all_categories() -> list[dict]:
    """Fetch every YC role category page concurrently and return the combined,
    de-duplicated list of postings. A single category failing is non-fatal."""
    from concurrent.futures import ThreadPoolExecutor, as_completed

    def _one(cat: str) -> list[dict]:
        props = _fetch_props(f"{YC_BASE}/jobs/role/{cat}")
        return (props or {}).get("jobPostings") or []

    seen: set[str] = set()
    postings: list[dict] = []
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(_one, cat): cat for cat in YC_ROLE_CATEGORIES}
        for fut in as_completed(futures):
            cat = futures[fut]
            try:
                for job in fut.result():
                    url = job.get("url") or ""
                    if url and url in seen:
                        continue
                    if url:
                        seen.add(url)
                    postings.append(job)
            except Exception as e:  # one bad category shouldn't fail the scrape
                logger.debug("YC category fetch failed for %s: %s", cat, e)
    return postings


def _parse_salary(salary_range: str | None) -> tuple[float | None, float | None]:
    """Parse strings like '$120K - $190K', '$120K', '€90K - €120K' into
    (min, max) absolute USD-ish floats. Returns (None, None) when unparseable."""
    if not salary_range:
        return None, None

    def to_number(token: str) -> float | None:
        m = re.search(r"([\d.]+)\s*([KkMm]?)", token)
        if not m:
            return None
        value = float(m.group(1))
        suffix = m.group(2).lower()
        if suffix == "k":
            value *= 1_000
        elif suffix == "m":
            value *= 1_000_000
        return value

    numbers = [n for n in (to_number(p) for p in salary_range.split("-")) if n]
    if not numbers:
        return None, None
    if len(numbers) == 1:
        return numbers[0], None
    return numbers[0], numbers[1]


def _split_location(location: str | None) -> tuple[str | None, str | None]:
    """Best-effort (city, state) from a 'City, ST' style YC location."""
    if not location:
        return None, None
    # YC often uses 'US / Remote (US)', 'San Francisco, CA', 'Remote'.
    primary = location.split("/")[0].strip()
    parts = [p.strip() for p in primary.split(",")]
    if len(parts) == 2 and len(parts[1]) <= 3:
        return parts[0] or None, parts[1] or None
    return None, None


def _matches_terms(job: dict, terms: list[str]) -> bool:
    """True if any search term appears in the job's searchable text. Empty
    ``terms`` matches everything."""
    if not terms:
        return True
    haystack = " ".join(
        str(job.get(k, "") or "")
        for k in ("title", "prettyRole", "roleSpecificType", "companyName", "companyOneLiner")
    )
    haystack = (haystack + " " + " ".join(job.get("skills") or [])).lower()
    return any(term.lower().strip() in haystack for term in terms if term.strip())


def _matches_location(location: str, user_locations: list[str], include_remote: bool) -> bool:
    """Lenient location filter. YC postings are remote-heavy, so we keep remote
    jobs when remote is allowed, and otherwise match the user's city names."""
    loc_lower = (location or "").lower()
    is_remote = "remote" in loc_lower
    if is_remote and include_remote:
        return True
    for ul in user_locations:
        city = ul.split(",")[0].strip().lower()
        if city and city in loc_lower:
            return True
    return False


def scrape_yc(
    search_terms: list[str],
    locations: list[str],
    results_wanted: int = 25,
    include_remote: bool = True,
    fetch_descriptions: bool = True,
) -> pd.DataFrame:
    """Scrape Y Combinator jobs and return a DataFrame with the same columns the
    rest of the pipeline expects from a jobspy result.

    YC's listing is global (search/location filtering happens client-side via
    Algolia), so we fetch every role category and filter the postings ourselves.
    """
    postings = _fetch_all_categories()
    if not postings:
        raise RuntimeError("could not parse YC jobs page (no postings found)")

    rows: list[dict] = []

    for job in postings:
        if len(rows) >= results_wanted:
            break

        location = job.get("location") or ""
        if not _matches_terms(job, search_terms):
            continue
        if not _matches_location(location, locations, include_remote):
            continue

        rel_url = job.get("url") or ""
        job_url = YC_BASE + rel_url if rel_url.startswith("/") else rel_url
        if not job_url:
            continue

        description = job.get("companyOneLiner") or ""
        if fetch_descriptions and rel_url:
            try:
                detail = _fetch_props(YC_BASE + rel_url)
                if detail and detail.get("job"):
                    description = detail["job"].get("description") or description
            except Exception as e:  # detail fetch is best-effort
                logger.debug("YC detail fetch failed for %s: %s", job_url, e)

        min_amount, max_amount = _parse_salary(job.get("salaryRange"))
        city, state = _split_location(location)
        batch = job.get("companyBatchName")
        company = job.get("companyName")

        rows.append({
            "title": job.get("title"),
            "company": f"{company} ({batch})" if company and batch else company,
            "location": location,
            "description": description,
            "job_type": (job.get("type") or "").lower() or None,
            "site": SITE_NAME,
            "job_url": job_url,
            "min_amount": min_amount,
            "max_amount": max_amount,
            # YC only exposes relative ages ('7 days'), not exact dates.
            "date_posted": None,
            "is_remote": "remote" in location.lower(),
            "city": city,
            "state": state,
        })

    logger.info("YC scrape: %d/%d postings kept after filtering", len(rows), len(postings))
    return pd.DataFrame(rows)
