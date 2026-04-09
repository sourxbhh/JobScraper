from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey
)
from .database import Base


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    external_id = Column(String(64), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    company = Column(String(300), nullable=True)
    location = Column(String(300), nullable=True)
    city = Column(String(150), nullable=True)
    state = Column(String(100), nullable=True)
    is_remote = Column(Boolean, default=False)
    job_type = Column(String(50), nullable=True)
    source = Column(String(50), nullable=False)
    job_url = Column(String(2000), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    min_salary = Column(Float, nullable=True)
    max_salary = Column(Float, nullable=True)
    salary_currency = Column(String(10), default="USD")
    date_posted = Column(DateTime, nullable=True)
    date_scraped = Column(DateTime, default=datetime.utcnow)
    hours_old = Column(Integer, nullable=True)
    status = Column(String(20), default="new", index=True)
    is_bookmarked = Column(Boolean, default=False, index=True)
    is_hidden = Column(Boolean, default=False, index=True)
    match_score = Column(Float, nullable=True, index=True)
    notes = Column(Text, nullable=True)
    scrape_config_id = Column(Integer, ForeignKey("scrape_configs.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
