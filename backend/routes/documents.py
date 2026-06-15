from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc

from models.database import get_db, SessionLocal
from models.document import GeneratedDocument
from models.job import Job
from services import resume_service, llm_service
import prompts

router = APIRouter(prefix="/api/jobs", tags=["documents"])

_VALID_TYPES = {"cover_letter", "outreach"}


def _doc_to_dict(d: GeneratedDocument) -> dict:
    return {
        "id": d.id,
        "job_id": d.job_id,
        "type": d.type,
        "status": d.status,
        "content": d.content,
        "error": d.error,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }


def _generate_bg(doc_id: int):
    db = SessionLocal()
    try:
        doc = db.query(GeneratedDocument).filter(GeneratedDocument.id == doc_id).first()
        if not doc:
            return
        doc.status = "running"
        db.commit()
        try:
            job = db.query(Job).filter(Job.id == doc.job_id).first()
            cv_text = resume_service.primary_resume_text(db)
            system, user = prompts.document(job, cv_text or "", doc.type)
            doc.content = llm_service.chat(system, user, temperature=0.6)
            doc.status = "done"
        except Exception as e:
            doc.status = "failed"
            doc.error = str(e)
        db.commit()
    finally:
        db.close()


@router.post("/{job_id}/generate-document")
def generate_document(
    job_id: int,
    type: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if type not in _VALID_TYPES:
        raise HTTPException(status_code=400, detail=f"type must be one of {_VALID_TYPES}")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not resume_service.primary_resume_text(db):
        raise HTTPException(status_code=400, detail="Upload a resume first (set one as primary).")

    doc = GeneratedDocument(job_id=job_id, type=type, status="pending")
    db.add(doc)
    db.commit()
    db.refresh(doc)
    background_tasks.add_task(_generate_bg, doc.id)
    return _doc_to_dict(doc)


@router.get("/{job_id}/documents")
def list_documents(job_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(GeneratedDocument)
        .filter(GeneratedDocument.job_id == job_id)
        .order_by(desc(GeneratedDocument.created_at))
        .all()
    )
    return [_doc_to_dict(d) for d in rows]


@router.get("/documents/{doc_id}")
def get_document(doc_id: int, db: Session = Depends(get_db)):
    doc = db.query(GeneratedDocument).filter(GeneratedDocument.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_to_dict(doc)
