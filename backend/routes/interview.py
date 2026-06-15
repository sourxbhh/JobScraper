from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import get_db, SessionLocal
from models.interview import InterviewStory
from models.job import Job
from models.settings import get_setting, set_setting
from services import resume_service, llm_service
import prompts

router = APIRouter(prefix="/api/interview", tags=["interview"])


class StoryIn(BaseModel):
    title: str
    theme: Optional[str] = None
    situation: Optional[str] = None
    task: Optional[str] = None
    action: Optional[str] = None
    result: Optional[str] = None
    reflection: Optional[str] = None
    best_for: Optional[str] = None
    job_id: Optional[int] = None


def _story_to_dict(s: InterviewStory) -> dict:
    return {
        "id": s.id, "title": s.title, "theme": s.theme,
        "situation": s.situation, "task": s.task, "action": s.action,
        "result": s.result, "reflection": s.reflection, "best_for": s.best_for,
        "job_id": s.job_id, "source": s.source,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.get("/stories")
def list_stories(db: Session = Depends(get_db)):
    rows = db.query(InterviewStory).order_by(desc(InterviewStory.created_at)).all()
    return [_story_to_dict(s) for s in rows]


@router.post("/stories")
def create_story(data: StoryIn, db: Session = Depends(get_db)):
    s = InterviewStory(source="manual", **data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return _story_to_dict(s)


@router.put("/stories/{story_id}")
def update_story(story_id: int, data: StoryIn, db: Session = Depends(get_db)):
    s = db.query(InterviewStory).filter(InterviewStory.id == story_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Story not found")
    for field, value in data.model_dump().items():
        setattr(s, field, value)
    s.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(s)
    return _story_to_dict(s)


@router.delete("/stories/{story_id}")
def delete_story(story_id: int, db: Session = Depends(get_db)):
    s = db.query(InterviewStory).filter(InterviewStory.id == story_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Story not found")
    db.delete(s)
    db.commit()
    return {"detail": "Deleted"}


def _generate_bg(job_id: int):
    db = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        cv_text = resume_service.primary_resume_text(db)
        if not job or not cv_text:
            return
        system, user = prompts.interview_stories(job, cv_text)
        data = llm_service.chat_json(system, user)
        for st in data.get("stories", []):
            db.add(InterviewStory(
                title=str(st.get("title", "Untitled"))[:300],
                theme=st.get("theme"),
                situation=st.get("situation"),
                task=st.get("task"),
                action=st.get("action"),
                result=st.get("result"),
                reflection=st.get("reflection"),
                best_for=st.get("best_for"),
                job_id=job_id,
                source="generated",
            ))
        db.commit()
    finally:
        db.close()


@router.post("/generate")
def generate(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not resume_service.primary_resume_text(db):
        raise HTTPException(status_code=400, detail="Upload a resume first (set one as primary).")
    background_tasks.add_task(_generate_bg, job_id)
    return {"detail": "Generation started", "job_id": job_id}


# ── Settings (negotiation notes, etc.) ──

class SettingIn(BaseModel):
    value: Optional[str] = None


@router.get("/settings/{key}")
def read_setting(key: str, db: Session = Depends(get_db)):
    return {"key": key, "value": get_setting(db, key)}


@router.put("/settings/{key}")
def write_setting(key: str, data: SettingIn, db: Session = Depends(get_db)):
    set_setting(db, key, data.value)
    return {"key": key, "value": data.value}
