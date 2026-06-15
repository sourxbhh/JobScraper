from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, ForeignKey

from .database import Base


class Resume(Base):
    __tablename__ = "resumes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    filename = Column(String(300), nullable=True)
    raw_text = Column(Text, nullable=False)
    is_primary = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ResumeEvaluation(Base):
    __tablename__ = "resume_evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    resume_id = Column(Integer, ForeignKey("resumes.id"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    status = Column(String(20), default="pending")  # pending|running|done|failed
    keyword_score = Column(Float, nullable=True)     # deterministic, instant
    matched_json = Column(Text, nullable=True)       # JSON list
    missing_json = Column(Text, nullable=True)       # JSON list (keyword gaps)
    llm_fit_score = Column(Float, nullable=True)
    llm_feedback = Column(Text, nullable=True)        # verdict / strengths / gaps summary
    suggestions_json = Column(Text, nullable=True)    # JSON list of edits
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
