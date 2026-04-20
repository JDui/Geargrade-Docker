from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.enums import DeviceStatus, RatingLabel, mount_system_label_for, rating_label_from_score
from app.models.device import Device
from app.models.tag import Tag
from app.models.wishlist_device import WishlistDevice
from app.schemas.device import DeviceCreate, DeviceDetail
from app.schemas.wishlist import (
    WishlistDeviceCreate,
    WishlistDeviceDetail,
    WishlistDeviceListItem,
    WishlistDeviceUpdate,
    WishlistRedeemRequest,
    WishlistSortBy,
    WishlistSortOrder,
)
from app.services.device_service import (
    _assign_tags,
    _build_image_url,
    _cleanup_media_file,
    _normalize_mount_fields,
    _normalize_sale_fields,
)


def serialize_wishlist_device(
    device: WishlistDevice, settings: Settings, detailed: bool = False
) -> WishlistDeviceListItem | WishlistDeviceDetail:
    payload = {
        "id": device.id,
        "name": device.name,
        "brand": device.brand,
        "category": device.category,
        "mount_system_key": device.mount_system_key,
        "mount_system_custom": device.mount_system_custom,
        "mount_system_label": mount_system_label_for(device.mount_system_key, device.mount_system_custom),
        "score": device.score,
        "rating_label": rating_label_from_score(device.score),
        "acquisition_iteration": device.acquisition_iteration,
        "tags": [tag.name for tag in device.tags],
        "image_source_type": device.image_source_type,
        "image_original_url": device.image_original_url,
        "image_storage_path": device.image_storage_path,
        "image_storage_name": device.image_storage_name,
        "image_url": _build_image_url(settings, device.image_storage_path),
        "created_at": device.created_at,
        "updated_at": device.updated_at,
    }
    if detailed:
        payload["pros"] = device.pros or []
        payload["cons"] = device.cons or []
        payload["review_detail"] = device.review_detail
        return WishlistDeviceDetail(**payload)
    return WishlistDeviceListItem(**payload)


def create_wishlist_device(
    session: Session, payload: WishlistDeviceCreate, settings: Settings | None
) -> WishlistDevice:
    data = payload.model_dump()
    _normalize_mount_fields(data)

    device = WishlistDevice(
        name=data["name"],
        brand=data["brand"],
        category=data["category"],
        mount_system_key=data["mount_system_key"],
        mount_system_custom=data["mount_system_custom"],
        score=data["score"],
        acquisition_iteration=data["acquisition_iteration"],
        pros=data["pros"],
        cons=data["cons"],
        review_detail=data["review_detail"],
        image_source_type=data["image_source_type"],
        image_original_url=data["image_original_url"],
        image_storage_path=data["image_storage_path"],
        image_storage_name=data["image_storage_name"],
    )
    session.add(device)
    session.flush()
    _assign_tags(session, device, data["tags"])
    session.commit()
    session.refresh(device)
    return device


def get_wishlist_device(session: Session, device_id: int) -> WishlistDevice | None:
    statement = select(WishlistDevice).options(selectinload(WishlistDevice.tags)).where(WishlistDevice.id == device_id)
    return session.scalar(statement)


def update_wishlist_device(
    session: Session, device: WishlistDevice, payload: WishlistDeviceUpdate, settings: Settings
) -> WishlistDevice:
    data = payload.model_dump(exclude_unset=True)
    previous_storage_path = device.image_storage_path
    _normalize_mount_fields(data)

    for field, value in data.items():
        if field == "tags":
            continue
        setattr(device, field, value)

    if "tags" in data:
        _assign_tags(session, device, data["tags"] or [])

    session.add(device)
    session.commit()
    session.refresh(device)

    if "image_storage_path" in data and previous_storage_path != device.image_storage_path:
        _cleanup_media_file(settings, previous_storage_path)

    return device


def delete_wishlist_device(session: Session, device: WishlistDevice, settings: Settings) -> None:
    image_storage_path = device.image_storage_path
    session.delete(device)
    session.commit()
    _cleanup_media_file(settings, image_storage_path)


def redeem_wishlist_device(
    session: Session,
    wishlist_device: WishlistDevice,
    payload: WishlistRedeemRequest,
    settings: Settings,
) -> Device:
    redeem_data = DeviceCreate(
        name=payload.name or wishlist_device.name,
        brand=payload.brand or wishlist_device.brand,
        category=payload.category or wishlist_device.category,
        mount_system_key=payload.mount_system_key if payload.mount_system_key is not None else wishlist_device.mount_system_key,
        mount_system_custom=(
            payload.mount_system_custom if payload.mount_system_custom is not None else wishlist_device.mount_system_custom
        ),
        status=DeviceStatus.HOLDING,
        score=payload.score if payload.score is not None else wishlist_device.score,
        acquisition_iteration=payload.acquisition_iteration or wishlist_device.acquisition_iteration,
        pros=payload.pros if payload.pros is not None else (wishlist_device.pros or []),
        cons=payload.cons if payload.cons is not None else (wishlist_device.cons or []),
        review_detail=payload.review_detail if payload.review_detail is not None else wishlist_device.review_detail,
        tags=payload.tags if payload.tags is not None else [tag.name for tag in wishlist_device.tags],
        purchase_price=payload.purchase_price,
        sale_price=None,
        purchase_date=payload.purchase_date,
        sale_date=None,
        image_source_type=payload.image_source_type or wishlist_device.image_source_type,
        image_original_url=payload.image_original_url or wishlist_device.image_original_url,
        image_storage_path=payload.image_storage_path or wishlist_device.image_storage_path,
        image_storage_name=payload.image_storage_name or wishlist_device.image_storage_name,
    ).model_dump()
    _normalize_mount_fields(redeem_data)
    _normalize_sale_fields(redeem_data)

    created_device = Device(
        name=redeem_data["name"],
        brand=redeem_data["brand"],
        category=redeem_data["category"],
        mount_system_key=redeem_data["mount_system_key"],
        mount_system_custom=redeem_data["mount_system_custom"],
        status=redeem_data["status"],
        score=redeem_data["score"],
        acquisition_iteration=redeem_data["acquisition_iteration"],
        pros=redeem_data["pros"],
        cons=redeem_data["cons"],
        review_detail=redeem_data["review_detail"],
        purchase_price=redeem_data["purchase_price"],
        sale_price=redeem_data["sale_price"],
        purchase_date=redeem_data["purchase_date"],
        sale_date=redeem_data["sale_date"],
        image_source_type=redeem_data["image_source_type"],
        image_original_url=redeem_data["image_original_url"],
        image_storage_path=redeem_data["image_storage_path"],
        image_storage_name=redeem_data["image_storage_name"],
    )
    session.add(created_device)
    session.flush()
    _assign_tags(session, created_device, redeem_data["tags"])
    session.delete(wishlist_device)
    session.commit()
    session.refresh(created_device)
    return created_device


def _apply_search(statement: Select[tuple[WishlistDevice]], search: str | None) -> Select[tuple[WishlistDevice]]:
    if not search:
        return statement

    pattern = f"%{search.strip()}%"
    return (
        statement.outerjoin(WishlistDevice.tags)
        .where(
            or_(
                WishlistDevice.name.ilike(pattern),
                WishlistDevice.brand.ilike(pattern),
                WishlistDevice.review_detail.ilike(pattern),
                Tag.name.ilike(pattern),
            )
        )
        .distinct()
    )


def _apply_rating_label_filter(
    statement: Select[tuple[WishlistDevice]], rating_label: str | None
) -> Select[tuple[WishlistDevice]]:
    if not rating_label:
        return statement

    if rating_label == RatingLabel.GOD:
        return statement.where(WishlistDevice.score > 100)
    if rating_label == RatingLabel.EXCELLENT:
        return statement.where(and_(WishlistDevice.score >= 80, WishlistDevice.score <= 100))
    if rating_label == RatingLabel.AVERAGE:
        return statement.where(and_(WishlistDevice.score >= 50, WishlistDevice.score <= 79))
    if rating_label == RatingLabel.LOW:
        return statement.where(and_(WishlistDevice.score >= 1, WishlistDevice.score <= 49))
    return statement


def _apply_sort(
    statement: Select[tuple[WishlistDevice]], sort_by: WishlistSortBy, sort_order: WishlistSortOrder
) -> Select[tuple[WishlistDevice]]:
    direction = {"asc": lambda value: value.asc(), "desc": lambda value: value.desc()}[sort_order]
    fallback_direction = {"asc": lambda value: value.asc(), "desc": lambda value: value.desc()}[sort_order]
    column_map = {
        "name": func.lower(WishlistDevice.name),
        "brand": func.lower(WishlistDevice.brand),
        "category": WishlistDevice.category,
        "score": WishlistDevice.score,
        "updated_at": WishlistDevice.updated_at,
        "created_at": WishlistDevice.created_at,
    }
    sort_column = column_map[sort_by]
    return statement.order_by(direction(sort_column), fallback_direction(WishlistDevice.created_at))


def list_wishlist_devices(
    session: Session,
    settings: Settings,
    search: str | None = None,
    category: str | None = None,
    rating_label: str | None = None,
    feeling_only: bool | None = None,
    sort_by: WishlistSortBy = "updated_at",
    sort_order: WishlistSortOrder = "desc",
) -> tuple[list[WishlistDeviceListItem], int]:
    statement: Select[tuple[WishlistDevice]] = select(WishlistDevice).options(selectinload(WishlistDevice.tags))
    statement = _apply_search(statement, search)

    if category:
        statement = statement.where(WishlistDevice.category == category)
    if feeling_only is True:
        statement = statement.where(WishlistDevice.score == -1)
    elif feeling_only is False:
        statement = statement.where(WishlistDevice.score != -1)

    statement = _apply_rating_label_filter(statement, rating_label)
    statement = _apply_sort(statement, sort_by, sort_order)

    devices = session.execute(statement).scalars().unique().all()
    items = [serialize_wishlist_device(device, settings) for device in devices]
    return items, len(items)
