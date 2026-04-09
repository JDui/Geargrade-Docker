from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.device import DeviceCreate, DeviceDetail, DeviceListResponse, DeviceUpdate
from app.services import device_service


router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("", response_model=DeviceListResponse)
def list_devices(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status"),
    rating_label: str | None = Query(default=None),
    purchase_year: int | None = Query(default=None, ge=1900, le=3000),
    feeling_only: bool | None = Query(default=None, alias="feeling_only"),
    sort_by: str = Query(default="purchase_date"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DeviceListResponse:
    items, total = device_service.list_devices(
        session=db,
        settings=settings,
        search=search,
        category=category,
        status=status_filter,
        rating_label=rating_label,
        purchase_year=purchase_year,
        feeling_only=feeling_only,
        sort_by=sort_by,  # type: ignore[arg-type]
        sort_order=sort_order,  # type: ignore[arg-type]
    )
    return DeviceListResponse(items=items, total=total)


@router.get("/{device_id}", response_model=DeviceDetail)
def get_device(
    device_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DeviceDetail:
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    detail = device_service.serialize_device(device, settings, detailed=True)
    detail.score_rank = device_service.get_score_rank(db, device)
    return detail


@router.post("", response_model=DeviceDetail, status_code=status.HTTP_201_CREATED)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DeviceDetail:
    device = device_service.create_device(db, payload, settings)
    detail = device_service.serialize_device(device, settings, detailed=True)
    detail.score_rank = device_service.get_score_rank(db, device)
    return detail


@router.patch("/{device_id}", response_model=DeviceDetail)
def update_device(
    device_id: int,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DeviceDetail:
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    updated = device_service.update_device(db, device, payload, settings)
    detail = device_service.serialize_device(updated, settings, detailed=True)
    detail.score_rank = device_service.get_score_rank(db, updated)
    return detail


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_device(
    device_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    device = device_service.get_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found.")
    device_service.delete_device(db, device, settings)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
