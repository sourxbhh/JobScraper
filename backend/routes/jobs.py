import io
import csv
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from models.database import get_db
from models.job import Job

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


class JobUpdate(BaseModel):
    status: Optional[str] = None
    is_bookmarked: Optional[bool] = None
    is_hidden: Optional[bool] = None
    notes: Optional[str] = None


class BulkUpdate(BaseModel):
    job_ids: List[int]
    status: Optional[str] = None
    is_bookmarked: Optional[bool] = None
    is_hidden: Optional[bool] = None


@router.get("")
def list_jobs(
    search: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    location: Optional[str] = None,
    is_bookmarked: Optional[bool] = None,
    is_hidden: Optional[bool] = Query(default=False),
    min_salary: Optional[float] = None,
    min_match_score: Optional[float] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort_by: str = "date_scraped",
    sort_order: str = "desc",
    page: int = 1,
    per_page: int = 25,
    db: Session = Depends(get_db),
):
    query = db.query(Job)

    # Filters
    if is_hidden is not None:
        query = query.filter(Job.is_hidden == is_hidden)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                Job.title.ilike(search_term),
                Job.company.ilike(search_term),
                Job.description.ilike(search_term),
            )
        )

    if status:
        statuses = status.split(",")
        query = query.filter(Job.status.in_(statuses))

    if source:
        sources = source.split(",")
        query = query.filter(Job.source.in_(sources))

    if location:
        if location.lower() == "remote":
            query = query.filter(Job.is_remote == True)
        elif location.lower() != "all":
            query = query.filter(Job.location.ilike(f"%{location}%"))

    if is_bookmarked is not None:
        query = query.filter(Job.is_bookmarked == is_bookmarked)

    if min_salary is not None:
        query = query.filter(
            or_(Job.min_salary >= min_salary, Job.max_salary >= min_salary)
        )

    if min_match_score is not None:
        query = query.filter(Job.match_score >= min_match_score)

    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(Job.date_scraped >= dt)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(Job.date_scraped <= dt)
        except ValueError:
            pass

    # Count before pagination
    total = query.count()

    # Sorting
    sort_col = getattr(Job, sort_by, Job.date_scraped)
    if sort_order == "asc":
        query = query.order_by(asc(sort_col))
    else:
        query = query.order_by(desc(sort_col))

    # Pagination
    offset = (page - 1) * per_page
    jobs = query.offset(offset).limit(per_page).all()

    return {
        "jobs": [_job_to_dict(j) for j in jobs],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": (total + per_page - 1) // per_page,
    }


@router.get("/export")
def export_jobs(
    format: str = "csv",
    search: Optional[str] = None,
    status: Optional[str] = None,
    source: Optional[str] = None,
    is_bookmarked: Optional[bool] = None,
    job_ids: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(Job).filter(Job.is_hidden == False)

    if job_ids:
        ids = [int(x) for x in job_ids.split(",")]
        query = query.filter(Job.id.in_(ids))
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(Job.title.ilike(search_term), Job.company.ilike(search_term))
        )
    if status:
        query = query.filter(Job.status.in_(status.split(",")))
    if source:
        query = query.filter(Job.source.in_(source.split(",")))
    if is_bookmarked is not None:
        query = query.filter(Job.is_bookmarked == is_bookmarked)

    jobs = query.order_by(desc(Job.date_scraped)).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Title", "Company", "Location", "Source", "Job URL",
        "Status", "Match Score", "Min Salary", "Max Salary",
        "Date Posted", "Date Scraped", "Bookmarked",
    ])
    for j in jobs:
        writer.writerow([
            j.title, j.company, j.location, j.source, j.job_url,
            j.status, j.match_score, j.min_salary, j.max_salary,
            j.date_posted, j.date_scraped, j.is_bookmarked,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=jobs_export.csv"},
    )


@router.get("/{job_id}")
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_dict(job)


@router.patch("/{job_id}")
def update_job(job_id: int, update: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return _job_to_dict(job)


@router.patch("/bulk/update")
def bulk_update_jobs(update: BulkUpdate, db: Session = Depends(get_db)):
    jobs = db.query(Job).filter(Job.id.in_(update.job_ids)).all()
    for job in jobs:
        if update.status is not None:
            job.status = update.status
        if update.is_bookmarked is not None:
            job.is_bookmarked = update.is_bookmarked
        if update.is_hidden is not None:
            job.is_hidden = update.is_hidden
        job.updated_at = datetime.utcnow()
    db.commit()
    return {"updated": len(jobs)}


@router.delete("/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    job.is_hidden = True
    job.updated_at = datetime.utcnow()
    db.commit()
    return {"detail": "Job hidden"}


def _job_to_dict(job: Job) -> dict:
    return {
        "id": job.id,
        "external_id": job.external_id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "city": job.city,
        "state": job.state,
        "is_remote": job.is_remote,
        "job_type": job.job_type,
        "source": job.source,
        "job_url": job.job_url,
        "description": job.description,
        "min_salary": job.min_salary,
        "max_salary": job.max_salary,
        "salary_currency": job.salary_currency,
        "date_posted": job.date_posted.isoformat() if job.date_posted else None,
        "date_scraped": job.date_scraped.isoformat() if job.date_scraped else None,
        "hours_old": job.hours_old,
        "status": job.status,
        "is_bookmarked": job.is_bookmarked,
        "is_hidden": job.is_hidden,
        "match_score": job.match_score,
        "notes": job.notes,
        "scrape_config_id": job.scrape_config_id,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "updated_at": job.updated_at.isoformat() if job.updated_at else None,
    }
