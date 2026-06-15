from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from models.database import get_db
from services import ats_scanner

router = APIRouter(prefix="/api/ats", tags=["ats"])


@router.get("/portals")
def portals(db: Session = Depends(get_db)):
    return ats_scanner.get_portals_summary()


@router.post("/scan")
def scan(db: Session = Depends(get_db)):
    """Run the ATS scan (concurrent JSON API calls). Sync def -> runs in a
    threadpool so the blocking HTTP fetches don't freeze the event loop."""
    return ats_scanner.run_ats_scan(db)


@router.post("/verify")
def verify():
    return ats_scanner.verify_employers()
