from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.schemas.device import DeviceDetail
from app.schemas.wishlist import (
    WishlistDeviceCreate,
    WishlistDeviceDetail,
    WishlistDeviceListResponse,
    WishlistDeviceUpdate,
    WishlistRedeemRequest,
)
from app.services import device_service, wishlist_service


router = APIRouter(prefix="/wishlist/devices", tags=["wishlist"])


@router.get("", response_model=WishlistDeviceListResponse)
def list_wishlist_devices(
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    rating_label: str | None = Query(default=None),
    feeling_only: bool | None = Query(default=None, alias="feeling_only"),
    sort_by: str = Query(default="updated_at"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WishlistDeviceListResponse:
    items, total = wishlist_service.list_wishlist_devices(
        session=db,
        settings=settings,
        search=search,
        category=category,
        rating_label=rating_label,
        feeling_only=feeling_only,
        sort_by=sort_by,  # type: ignore[arg-type]
        sort_order=sort_order,  # type: ignore[arg-type]
    )
    return WishlistDeviceListResponse(items=items, total=total)


@router.get("/{device_id}", response_model=WishlistDeviceDetail)
def get_wishlist_device(
    device_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WishlistDeviceDetail:
    device = wishlist_service.get_wishlist_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist device not found.")
    return wishlist_service.serialize_wishlist_device(device, settings, detailed=True)


@router.post("", response_model=WishlistDeviceDetail, status_code=status.HTTP_201_CREATED)
def create_wishlist_device(
    payload: WishlistDeviceCreate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WishlistDeviceDetail:
    device = wishlist_service.create_wishlist_device(db, payload, settings)
    return wishlist_service.serialize_wishlist_device(device, settings, detailed=True)


@router.patch("/{device_id}", response_model=WishlistDeviceDetail)
def update_wishlist_device(
    device_id: int,
    payload: WishlistDeviceUpdate,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> WishlistDeviceDetail:
    device = wishlist_service.get_wishlist_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist device not found.")
    updated = wishlist_service.update_wishlist_device(db, device, payload, settings)
    return wishlist_service.serialize_wishlist_device(updated, settings, detailed=True)


@router.post("/{device_id}/redeem", response_model=DeviceDetail)
def redeem_wishlist_device(
    device_id: int,
    payload: WishlistRedeemRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> DeviceDetail:
    wishlist_device = wishlist_service.get_wishlist_device(db, device_id)
    if wishlist_device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist device not found.")
    created_device = wishlist_service.redeem_wishlist_device(db, wishlist_device, payload, settings)
    return device_service.serialize_device(created_device, settings, detailed=True)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_wishlist_device(
    device_id: int,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> Response:
    device = wishlist_service.get_wishlist_device(db, device_id)
    if device is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Wishlist device not found.")
    wishlist_service.delete_wishlist_device(db, device, settings)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
