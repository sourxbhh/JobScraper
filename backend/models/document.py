from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey

from .database import Base


class GeneratedDocument(Base):
    __tablename__ = "generated_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=False, index=True)
    type = Column(String(30), nullable=False)  # cover_letter | outreach
    status = Column(String(20), default="pending")  # pending|running|done|failed
    content = Column(Text, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
