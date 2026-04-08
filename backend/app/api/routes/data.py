from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.data import DataExportResponse, DataImportRequest, DataImportResponse
from app.services.data_service import export_data, import_data


router = APIRouter(prefix="/data", tags=["data"])


@router.get("/export", response_model=DataExportResponse)
def export_database(db: Session = Depends(get_db)) -> DataExportResponse:
    return export_data(db)


@router.post("/import", response_model=DataImportResponse)
def import_database(
    payload: DataImportRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DataImportResponse:
    return import_data(db, payload, settings)
