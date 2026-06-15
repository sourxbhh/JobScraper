from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from models.database import get_db
from models.settings import get_setting, set_setting
from services import llm_service

router = APIRouter(prefix="/api/llm", tags=["llm"])


@router.get("/status")
def llm_status():
    """Whether the local Ollama server is reachable and the model is available."""
    return llm_service.status()


class SettingUpdate(BaseModel):
    value: str | None = None


@router.get("/settings/{key}")
def read_setting(key: str, db: Session = Depends(get_db)):
    return {"key": key, "value": get_setting(db, key)}


@router.put("/settings/{key}")
def write_setting(key: str, data: SettingUpdate, db: Session = Depends(get_db)):
    set_setting(db, key, data.value)
    return {"key": key, "value": data.value}
