from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import get_db, SessionLocal
from models.ai_eval import AiEvaluation
from services import ai_eval_service

router = APIRouter(prefix="/api/jobs", tags=["ai"])


def _run_bg(eval_id: int):
    db = SessionLocal()
    try:
        ai_eval_service.run_evaluation(db, eval_id)
    finally:
        db.close()


@router.post("/{job_id}/ai-evaluate")
def ai_evaluate(job_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    try:
        ev = ai_eval_service.create_evaluation(db, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    background_tasks.add_task(_run_bg, ev.id)
    return ai_eval_service.to_dict(ev)


@router.get("/{job_id}/ai-evaluation")
def get_ai_evaluation(job_id: int, db: Session = Depends(get_db)):
    """Latest AI evaluation for a job (404 if none yet)."""
    ev = (
        db.query(AiEvaluation)
        .filter(AiEvaluation.job_id == job_id)
        .order_by(desc(AiEvaluation.created_at))
        .first()
    )
    if not ev:
        raise HTTPException(status_code=404, detail="No AI evaluation yet")
    return ai_eval_service.to_dict(ev)
