from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey

from .database import Base


class AiEvaluation(Base):
    __tablename__ = "ai_evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    status = Column(String(20), default="pending")  # pending|running|done|failed
    summary = Column(Text, nullable=True)
    fit_score = Column(Float, nullable=True)
    recommendation = Column(String(300), nullable=True)
    blocks_json = Column(Text, nullable=True)  # role_fit, cv_match, level_strategy, etc.
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
