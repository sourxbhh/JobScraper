import re
from collections import Counter
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from models.database import get_db
from models.job import Job

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

COMMON_SKILLS = [
    "python", "sql", "excel", "power bi", "tableau", "r", "java", "javascript",
    "aws", "azure", "google cloud", "snowflake", "bigquery", "spark",
    "pandas", "numpy", "scikit-learn", "tensorflow", "pytorch",
    "data visualization", "etl", "data warehouse", "dax",
    "machine learning", "deep learning", "statistics",
    "git", "docker", "kubernetes", "airflow", "dbt",
    "communication", "agile", "scrum", "jira",
    "sas", "spss", "matlab", "scala", "hadoop",
    "mongodb", "postgresql", "mysql", "redshift",
    "looker", "qlik", "data modeling", "business intelligence",
]


@router.get("/overview")
def overview(db: Session = Depends(get_db)):
    total = db.query(func.count(Job.id)).filter(Job.is_hidden == False).scalar() or 0

    today = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    new_today = (
        db.query(func.count(Job.id))
        .filter(Job.is_hidden == False, Job.date_scraped >= today)
        .scalar() or 0
    )

    bookmarked = (
        db.query(func.count(Job.id))
        .filter(Job.is_hidden == False, Job.is_bookmarked == True)
        .scalar() or 0
    )

    applied = (
        db.query(func.count(Job.id))
        .filter(Job.is_hidden == False, Job.status == "applied")
        .scalar() or 0
    )

    avg_min = (
        db.query(func.avg(Job.min_salary))
        .filter(Job.is_hidden == False, Job.min_salary.isnot(None))
        .scalar()
    )
    avg_max = (
        db.query(func.avg(Job.max_salary))
        .filter(Job.is_hidden == False, Job.max_salary.isnot(None))
        .scalar()
    )

    return {
        "total_jobs": total,
        "new_today": new_today,
        "bookmarked": bookmarked,
        "applied": applied,
        "avg_min_salary": round(avg_min, 2) if avg_min else None,
        "avg_max_salary": round(avg_max, 2) if avg_max else None,
    }


@router.get("/by-source")
def by_source(db: Session = Depends(get_db)):
    results = (
        db.query(Job.source, func.count(Job.id))
        .filter(Job.is_hidden == False)
        .group_by(Job.source)
        .all()
    )
    return [{"source": r[0], "count": r[1]} for r in results]


@router.get("/over-time")
def over_time(days: int = Query(default=30), db: Session = Depends(get_db)):
    start = datetime.utcnow() - timedelta(days=days)
    jobs = (
        db.query(Job.date_scraped)
        .filter(Job.is_hidden == False, Job.date_scraped >= start)
        .all()
    )

    counts: dict = {}
    for (dt,) in jobs:
        if dt:
            day = dt.strftime("%Y-%m-%d")
            counts[day] = counts.get(day, 0) + 1

    result = []
    for i in range(days):
        d = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        result.append({"date": d, "count": counts.get(d, 0)})
    return result


@router.get("/companies")
def top_companies(limit: int = 15, db: Session = Depends(get_db)):
    results = (
        db.query(Job.company, func.count(Job.id).label("count"))
        .filter(Job.is_hidden == False, Job.company.isnot(None), Job.company != "")
        .group_by(Job.company)
        .order_by(func.count(Job.id).desc())
        .limit(limit)
        .all()
    )
    return [{"company": r[0], "count": r[1]} for r in results]


@router.get("/salaries")
def salary_distribution(db: Session = Depends(get_db)):
    jobs = (
        db.query(Job.min_salary, Job.max_salary)
        .filter(
            Job.is_hidden == False,
            Job.min_salary.isnot(None),
        )
        .all()
    )

    ranges = [
        {"label": "$0-30k", "min": 0, "max": 30000, "count": 0},
        {"label": "$30-50k", "min": 30000, "max": 50000, "count": 0},
        {"label": "$50-70k", "min": 50000, "max": 70000, "count": 0},
        {"label": "$70-90k", "min": 70000, "max": 90000, "count": 0},
        {"label": "$90-120k", "min": 90000, "max": 120000, "count": 0},
        {"label": "$120k+", "min": 120000, "max": 999999999, "count": 0},
    ]

    for min_sal, max_sal in jobs:
        avg = min_sal if max_sal is None else (min_sal + max_sal) / 2
        for r in ranges:
            if r["min"] <= avg < r["max"]:
                r["count"] += 1
                break

    return [{"label": r["label"], "count": r["count"]} for r in ranges]


@router.get("/skills")
def skills_frequency(limit: int = 20, db: Session = Depends(get_db)):
    descriptions = (
        db.query(Job.description)
        .filter(Job.is_hidden == False, Job.description.isnot(None))
        .all()
    )

    counter = Counter()
    for (desc_text,) in descriptions:
        lower = desc_text.lower()
        for skill in COMMON_SKILLS:
            if skill in lower:
                counter[skill] += 1

    return [{"skill": s, "count": c} for s, c in counter.most_common(limit)]


@router.get("/funnel")
def funnel(db: Session = Depends(get_db)):
    statuses = ["new", "reviewing", "applied", "interview", "offer", "rejected"]
    result = []
    for s in statuses:
        count = (
            db.query(func.count(Job.id))
            .filter(Job.is_hidden == False, Job.status == s)
            .scalar() or 0
        )
        result.append({"status": s, "count": count})
    return result
