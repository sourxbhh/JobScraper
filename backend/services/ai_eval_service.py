"""LLM-driven deep job evaluation (career-ops A-F blocks)."""
import json

from sqlalchemy.orm import Session

from models.job import Job
from models.ai_eval import AiEvaluation
from services import resume_service, llm_service
import prompts

_BLOCK_KEYS = [
    "role_fit", "cv_match", "level_strategy",
    "comp_notes", "personalization", "red_flags",
]


def create_evaluation(db: Session, job_id: int) -> AiEvaluation:
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise ValueError("Job not found")
    ev = AiEvaluation(job_id=job_id, status="pending")
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def run_evaluation(db: Session, eval_id: int) -> None:
    ev = db.query(AiEvaluation).filter(AiEvaluation.id == eval_id).first()
    if not ev:
        return
    ev.status = "running"
    db.commit()
    try:
        job = db.query(Job).filter(Job.id == ev.job_id).first()
        cv_text = resume_service.primary_resume_text(db)
        system, user = prompts.job_deep_eval(job, cv_text)
        data = llm_service.chat_json(system, user)

        ev.summary = str(data.get("summary", ""))
        ev.fit_score = float(data.get("fit_score", 0) or 0)
        ev.recommendation = str(data.get("recommendation", ""))[:300]
        blocks = {k: data.get(k) for k in _BLOCK_KEYS if data.get(k) is not None}
        ev.blocks_json = json.dumps(blocks)
        ev.status = "done"
    except Exception as e:
        ev.status = "failed"
        ev.error = str(e)
    db.commit()


def to_dict(ev: AiEvaluation) -> dict:
    return {
        "id": ev.id,
        "job_id": ev.job_id,
        "status": ev.status,
        "summary": ev.summary,
        "fit_score": ev.fit_score,
        "recommendation": ev.recommendation,
        "blocks": json.loads(ev.blocks_json) if ev.blocks_json else {},
        "error": ev.error,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }
