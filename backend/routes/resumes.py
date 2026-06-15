import json
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session

from models.database import get_db, SessionLocal
from models.resume import Resume, ResumeEvaluation
from models.settings import set_setting, get_setting
from services import resume_service

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _resume_to_dict(r: Resume) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "filename": r.filename,
        "is_primary": r.is_primary,
        "chars": len(r.raw_text or ""),
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _eval_to_dict(ev: ResumeEvaluation) -> dict:
    return {
        "id": ev.id,
        "resume_id": ev.resume_id,
        "job_id": ev.job_id,
        "status": ev.status,
        "keyword_score": ev.keyword_score,
        "matched": json.loads(ev.matched_json) if ev.matched_json else [],
        "missing": json.loads(ev.missing_json) if ev.missing_json else [],
        "llm_fit_score": ev.llm_fit_score,
        "llm_feedback": ev.llm_feedback,
        "suggestions": json.loads(ev.suggestions_json) if ev.suggestions_json else [],
        "error": ev.error,
        "created_at": ev.created_at.isoformat() if ev.created_at else None,
    }


def _run_eval_bg(eval_id: int):
    db = SessionLocal()
    try:
        resume_service.run_llm_evaluation(db, eval_id)
    finally:
        db.close()


@router.get("")
def list_resumes(db: Session = Depends(get_db)):
    rows = db.query(Resume).order_by(Resume.created_at.desc()).all()
    return [_resume_to_dict(r) for r in rows]


@router.post("")
async def upload_resume(
    file: UploadFile = File(...),
    name: str = Form(None),
    db: Session = Depends(get_db),
):
    content = await file.read()
    try:
        text = resume_service.extract_text(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not parse file: {e}")
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted from the file.")

    is_first = db.query(Resume).count() == 0
    resume = Resume(
        name=name or file.filename or "Resume",
        filename=file.filename,
        raw_text=text,
        is_primary=is_first,  # first uploaded becomes primary by default
    )
    db.add(resume)
    db.commit()
    db.refresh(resume)
    if is_first:
        set_setting(db, "primary_resume_id", str(resume.id))
    return _resume_to_dict(resume)


@router.patch("/{resume_id}")
def set_primary(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    db.query(Resume).update({Resume.is_primary: False})
    resume.is_primary = True
    db.commit()
    set_setting(db, "primary_resume_id", str(resume.id))
    return _resume_to_dict(resume)


@router.delete("/{resume_id}")
def delete_resume(resume_id: int, db: Session = Depends(get_db)):
    resume = db.query(Resume).filter(Resume.id == resume_id).first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    # Remove dependent evaluations first to avoid orphaned rows.
    db.query(ResumeEvaluation).filter(ResumeEvaluation.resume_id == resume_id).delete()
    db.delete(resume)
    db.commit()
    # If we deleted the primary, promote the most recent remaining resume.
    if get_setting(db, "primary_resume_id") == str(resume_id):
        nxt = db.query(Resume).order_by(Resume.created_at.desc()).first()
        if nxt:
            nxt.is_primary = True
            db.commit()
            set_setting(db, "primary_resume_id", str(nxt.id))
        else:
            set_setting(db, "primary_resume_id", None)
    return {"detail": "Deleted"}


@router.post("/{resume_id}/evaluate")
def evaluate(
    resume_id: int,
    job_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    try:
        ev = resume_service.create_evaluation(db, resume_id, job_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    background_tasks.add_task(_run_eval_bg, ev.id)
    return _eval_to_dict(ev)


@router.get("/job/{job_id}/evaluations")
def job_evaluations(job_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(ResumeEvaluation)
        .filter(ResumeEvaluation.job_id == job_id)
        .order_by(ResumeEvaluation.created_at.desc())
        .all()
    )
    return [_eval_to_dict(r) for r in rows]


@router.get("/evaluations/{eval_id}")
def get_evaluation(eval_id: int, db: Session = Depends(get_db)):
    ev = db.query(ResumeEvaluation).filter(ResumeEvaluation.id == eval_id).first()
    if not ev:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    return _eval_to_dict(ev)
