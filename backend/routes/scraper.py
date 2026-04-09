from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import get_db
from models.scrape_config import ScrapeConfig, ScrapeRun
from services.scraper_service import run_scrape
from services.scheduler import schedule_config

router = APIRouter(prefix="/api/scrapes", tags=["scraper"])


class ScrapeConfigCreate(BaseModel):
    name: str
    search_terms: List[str]
    sites: List[str]
    locations: List[str] = ["Charlotte, NC"]
    distance: int = 50
    max_age_hours: int = 72
    results_per_site: int = 25
    job_types: Optional[List[str]] = None
    include_remote: bool = True
    google_search_term: Optional[str] = None
    schedule: Optional[str] = None
    is_active: bool = True


class ScrapeConfigUpdate(ScrapeConfigCreate):
    pass


# ── Static /runs/* routes MUST come before /{config_id}/* to avoid path conflicts ──

@router.get("/runs/recent")
def recent_runs(limit: int = 5, db: Session = Depends(get_db)):
    runs = (
        db.query(ScrapeRun)
        .order_by(desc(ScrapeRun.started_at))
        .limit(limit)
        .all()
    )
    result = []
    for r in runs:
        d = _run_to_dict(r)
        config = db.query(ScrapeConfig).filter(ScrapeConfig.id == r.config_id).first()
        d["config_name"] = config.name if config else "Unknown"
        result.append(d)
    return result


@router.get("/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(ScrapeRun).filter(ScrapeRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return _run_to_dict(run)


# ── Config CRUD and actions ──

@router.get("")
def list_configs(db: Session = Depends(get_db)):
    configs = db.query(ScrapeConfig).order_by(desc(ScrapeConfig.created_at)).all()
    result = []
    for c in configs:
        last_run = (
            db.query(ScrapeRun)
            .filter(ScrapeRun.config_id == c.id)
            .order_by(desc(ScrapeRun.started_at))
            .first()
        )
        result.append(_config_to_dict(c, last_run))
    return result


@router.post("")
def create_config(data: ScrapeConfigCreate, db: Session = Depends(get_db)):
    config = ScrapeConfig(
        name=data.name,
        search_terms=data.search_terms,
        sites=data.sites,
        locations=data.locations,
        distance=data.distance,
        max_age_hours=data.max_age_hours,
        results_per_site=data.results_per_site,
        job_types=data.job_types,
        include_remote=data.include_remote,
        google_search_term=data.google_search_term,
        schedule=data.schedule,
        is_active=data.is_active,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    schedule_config(config)
    return _config_to_dict(config)


@router.put("/{config_id}")
def update_config(config_id: int, data: ScrapeConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(ScrapeConfig).filter(ScrapeConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    for field, value in data.model_dump().items():
        setattr(config, field, value)
    config.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(config)
    schedule_config(config)
    return _config_to_dict(config)


@router.delete("/{config_id}")
def delete_config(config_id: int, db: Session = Depends(get_db)):
    config = db.query(ScrapeConfig).filter(ScrapeConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    db.delete(config)
    db.commit()
    return {"detail": "Deleted"}


@router.post("/{config_id}/run")
async def trigger_run(
    config_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    config = db.query(ScrapeConfig).filter(ScrapeConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    result = await run_scrape(db, config_id)
    return result


@router.get("/{config_id}/history")
def get_history(config_id: int, db: Session = Depends(get_db)):
    runs = (
        db.query(ScrapeRun)
        .filter(ScrapeRun.config_id == config_id)
        .order_by(desc(ScrapeRun.started_at))
        .limit(50)
        .all()
    )
    return [_run_to_dict(r) for r in runs]


def _config_to_dict(config: ScrapeConfig, last_run: ScrapeRun = None) -> dict:
    d = {
        "id": config.id,
        "name": config.name,
        "search_terms": config.search_terms,
        "sites": config.sites,
        "locations": config.locations,
        "distance": config.distance,
        "max_age_hours": config.max_age_hours,
        "results_per_site": config.results_per_site,
        "job_types": config.job_types,
        "include_remote": config.include_remote,
        "google_search_term": config.google_search_term,
        "schedule": config.schedule,
        "is_active": config.is_active,
        "created_at": config.created_at.isoformat() if config.created_at else None,
        "updated_at": config.updated_at.isoformat() if config.updated_at else None,
        "last_run": None,
    }
    if last_run:
        d["last_run"] = _run_to_dict(last_run)
    return d


def _run_to_dict(run: ScrapeRun) -> dict:
    return {
        "id": run.id,
        "config_id": run.config_id,
        "started_at": run.started_at.isoformat() if run.started_at else None,
        "completed_at": run.completed_at.isoformat() if run.completed_at else None,
        "status": run.status,
        "total_found": run.total_found,
        "new_jobs": run.new_jobs,
        "duplicates": run.duplicates,
        "errors": run.errors,
        "log": run.log,
    }
