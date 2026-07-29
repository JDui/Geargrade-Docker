from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.app_settings import AppSettings
from app.schemas.settings import AppSettingsResponse, AppSettingsUpdate


router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(db: Session) -> AppSettings:
    settings = db.get(AppSettings, 1)
    if settings is None:
        settings = AppSettings(id=1)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("", response_model=AppSettingsResponse)
def get_app_settings(db: Session = Depends(get_db)) -> AppSettings:
    return _get_or_create_settings(db)


@router.patch("", response_model=AppSettingsResponse)
def update_app_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db)) -> AppSettings:
    settings = _get_or_create_settings(db)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
