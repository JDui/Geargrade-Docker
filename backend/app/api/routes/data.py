from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.data import (
    DataExportResponse,
    DataImportRequest,
    DataImportResponse,
    DataResetResponse,
    GGPack,
    GGPackImportRequest,
    GGPackImportResponse,
    GGPackPreviewResponse,
    GGPackScope,
)
from app.services.data_service import export_data, export_ggpack, import_data, import_ggpack, preview_ggpack, reset_all_data


router = APIRouter(prefix="/data", tags=["data"])


@router.get("/export", response_model=DataExportResponse)
def export_database(db: Session = Depends(get_db)) -> DataExportResponse:
    return export_data(db)


@router.post("/import", response_model=DataImportResponse)
def import_database(
    payload: object = Body(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DataImportResponse:
    try:
        request = DataImportRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    return import_data(db, request, settings)


@router.get("/ggpack/export", response_model=GGPack)
def export_ggpack_database(
    scope: GGPackScope = Query(default="all"),
    db: Session = Depends(get_db),
) -> GGPack:
    return export_ggpack(db, scope)


@router.post("/ggpack/preview", response_model=GGPackPreviewResponse)
def preview_ggpack_database(
    payload: object = Body(...),
    db: Session = Depends(get_db),
) -> GGPackPreviewResponse:
    try:
        request = GGPackImportRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    return preview_ggpack(db, request)


@router.post("/ggpack/import", response_model=GGPackImportResponse)
def import_ggpack_database(
    payload: object = Body(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> GGPackImportResponse:
    try:
        request = GGPackImportRequest.model_validate(payload)
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.errors()) from exc
    return import_ggpack(db, request, settings)


@router.post("/reset", response_model=DataResetResponse)
def reset_database(
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DataResetResponse:
    return reset_all_data(db, settings)
