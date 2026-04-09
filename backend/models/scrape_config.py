from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, JSON
)
from .database import Base


class ScrapeConfig(Base):
    __tablename__ = "scrape_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    search_terms = Column(JSON, nullable=False)
    sites = Column(JSON, nullable=False)
    locations = Column(JSON, default=["Charlotte, NC"])
    distance = Column(Integer, default=50)
    max_age_hours = Column(Integer, default=72)
    results_per_site = Column(Integer, default=25)
    job_types = Column(JSON, nullable=True)
    include_remote = Column(Boolean, default=True)
    google_search_term = Column(String(500), nullable=True)
    schedule = Column(String(100), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_id = Column(Integer, nullable=False, index=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="running")
    total_found = Column(Integer, default=0)
    new_jobs = Column(Integer, default=0)
    duplicates = Column(Integer, default=0)
    errors = Column(Text, nullable=True)
    log = Column(Text, nullable=True)
