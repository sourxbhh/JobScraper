from datetime import datetime

from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey

from .database import Base


class InterviewStory(Base):
    __tablename__ = "interview_stories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(300), nullable=False)
    theme = Column(String(120), nullable=True)
    situation = Column(Text, nullable=True)
    task = Column(Text, nullable=True)
    action = Column(Text, nullable=True)
    result = Column(Text, nullable=True)
    reflection = Column(Text, nullable=True)
    best_for = Column(Text, nullable=True)
    job_id = Column(Integer, ForeignKey("jobs.id"), nullable=True, index=True)
    source = Column(String(20), default="manual")  # manual | generated
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
