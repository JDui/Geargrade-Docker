from collections.abc import Iterable
from datetime import date

from sqlalchemy import Select, and_, extract, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.enums import (
    DeviceStatus,
    MountSystemKey,
    RatingLabel,
    mount_system_label_for,
    rating_label_from_score,
)
from app.models.device import Device
from app.models.tag import Tag
from app.schemas.device import DeviceCreate, DeviceDetail, DeviceListItem, DeviceUpdate, SortBy, SortOrder


def _normalize_tag_names(tag_names: Iterable[str]) -> list[str]:
    unique: dict[str, str] = {}
    for raw_name in tag_names:
        name = raw_name.strip()
        if not name:
            continue
        unique.setdefault(name.lower(), name)
    return list(unique.values())


def _build_image_url(settings: Settings, storage_path: str | None) -> str | None:
    if not storage_path:
        return None
    normalized_path = storage_path.replace("\\", "/")
    return f"{settings.media_url_prefix.rstrip('/')}/{normalized_path}"


def calculate_daily_cost_value(
    status: DeviceStatus,
    purchase_price: float | None,
    purchase_date: date | None,
    sale_price: float | None = None,
    sale_date: date | None = None,
) -> float | None:
    if purchase_price is None or purchase_date is None:
        return None

    if status == DeviceStatus.HOLDING:
        end_date = date.today()
        elapsed_days = max((end_date - purchase_date).days, 1)
        return float(purchase_price) / elapsed_days

    if status == DeviceStatus.SOLD and sale_price is not None and sale_date is not None:
        elapsed_days = max((sale_date - purchase_date).days, 1)
        return (float(purchase_price) - float(sale_price)) / elapsed_days

    return None


def serialize_device(device: Device, settings: Settings, detailed: bool = False) -> DeviceListItem | DeviceDetail:
    payload = {
        "id": device.id,
        "name": device.name,
        "brand": device.brand,
        "category": device.category,
        "mount_system_key": device.mount_system_key,
        "mount_system_custom": device.mount_system_custom,
        "mount_system_label": mount_system_label_for(device.mount_system_key, device.mount_system_custom),
        "status": device.status,
        "score": device.score,
        "rating_label": rating_label_from_score(device.score),
        "acquisition_iteration": device.acquisition_iteration,
        "tags": [tag.name for tag in device.tags],
        "purchase_price": device.purchase_price,
        "sale_price": device.sale_price,
        "daily_cost_value": calculate_daily_cost_value(
            device.status,
            device.purchase_price,
            device.purchase_date,
            device.sale_price,
            device.sale_date,
        ),
        "purchase_date": device.purchase_date,
        "sale_date": device.sale_date,
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
        return DeviceDetail(**payload)
    return DeviceListItem(**payload)


def _score_ranking_key(device: Device) -> tuple[int, float, str]:
    return (
        -device.score,
        -(device.updated_at.timestamp() if device.updated_at else 0),
        device.name.lower(),
    )


def get_score_rank(session: Session, device: Device) -> int | None:
    if device.score <= 0:
        return None

    ranked_devices = session.scalars(select(Device).where(Device.score > 0)).all()
    ranked_devices = sorted(ranked_devices, key=_score_ranking_key)

    for index, candidate in enumerate(ranked_devices, 1):
        if candidate.id == device.id:
            return index
    return None


def export_device_payload(device: Device) -> DeviceCreate:
    return DeviceCreate(
        name=device.name,
        brand=device.brand,
        category=device.category,
        mount_system_key=device.mount_system_key,
        mount_system_custom=device.mount_system_custom,
        status=device.status,
        score=device.score,
        acquisition_iteration=device.acquisition_iteration,
        pros=device.pros or [],
        cons=device.cons or [],
        review_detail=device.review_detail,
        tags=[tag.name for tag in device.tags],
        purchase_price=device.purchase_price,
        sale_price=device.sale_price,
        purchase_date=device.purchase_date,
        sale_date=device.sale_date,
        image_source_type=device.image_source_type,
        image_original_url=device.image_original_url,
        image_storage_path=device.image_storage_path,
        image_storage_name=device.image_storage_name,
    )


def _cleanup_media_file(settings: Settings | None, storage_path: str | None) -> None:
    if not settings or not storage_path:
        return
    target = settings.media_root / storage_path
    if target.exists() and target.is_file():
        target.unlink()


def _assign_tags(session: Session, device: Device, tag_names: Iterable[str]) -> None:
    normalized_names = _normalize_tag_names(tag_names)
    if not normalized_names:
        device.tags = []
        return

    existing_tags = session.scalars(select(Tag).where(Tag.name.in_(normalized_names))).all()
    tag_map = {tag.name.lower(): tag for tag in existing_tags}
    resolved_tags: list[Tag] = []

    for name in normalized_names:
        existing = tag_map.get(name.lower())
        if existing is None:
            existing = Tag(name=name)
            session.add(existing)
            session.flush()
            tag_map[name.lower()] = existing
        resolved_tags.append(existing)

    device.tags = resolved_tags


def _normalize_mount_fields(data: dict) -> None:
    mount_key = data.get("mount_system_key")
    if mount_key == MountSystemKey.NONE:
        data["mount_system_custom"] = None
    elif mount_key != MountSystemKey.OTHER:
        data["mount_system_custom"] = None


def _normalize_sale_fields(data: dict) -> None:
    status = data.get("status")
    if status in {DeviceStatus.HOLDING, DeviceStatus.FOR_SALE}:
        data["sale_date"] = None
        data["sale_price"] = None
    elif status == DeviceStatus.BROKEN:
        data["sale_date"] = None
        data["sale_price"] = 0


def create_device(session: Session, payload: DeviceCreate, settings: Settings | None) -> Device:
    data = payload.model_dump()
    _normalize_mount_fields(data)
    _normalize_sale_fields(data)

    device = Device(
        name=data["name"],
        brand=data["brand"],
        category=data["category"],
        mount_system_key=data["mount_system_key"],
        mount_system_custom=data["mount_system_custom"],
        status=data["status"],
        score=data["score"],
        acquisition_iteration=data["acquisition_iteration"],
        pros=data["pros"],
        cons=data["cons"],
        review_detail=data["review_detail"],
        purchase_price=data["purchase_price"],
        sale_price=data["sale_price"],
        purchase_date=data["purchase_date"],
        sale_date=data["sale_date"],
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


def get_device(session: Session, device_id: int) -> Device | None:
    statement = select(Device).options(selectinload(Device.tags)).where(Device.id == device_id)
    return session.scalar(statement)


def get_devices_for_export(session: Session) -> list[Device]:
    statement = select(Device).options(selectinload(Device.tags)).order_by(Device.purchase_date.desc(), Device.created_at.desc())
    return session.execute(statement).scalars().unique().all()


def update_device(session: Session, device: Device, payload: DeviceUpdate, settings: Settings) -> Device:
    data = payload.model_dump(exclude_unset=True)
    previous_storage_path = device.image_storage_path
    next_status = data.get("status", device.status)

    data["status"] = next_status
    _normalize_mount_fields(data)
    _normalize_sale_fields(data)

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


def delete_device(session: Session, device: Device, settings: Settings) -> None:
    image_storage_path = device.image_storage_path
    session.delete(device)
    session.commit()
    _cleanup_media_file(settings, image_storage_path)


def _apply_search(statement: Select[tuple[Device]], search: str | None) -> Select[tuple[Device]]:
    if not search:
        return statement

    pattern = f"%{search.strip()}%"
    return (
        statement.outerjoin(Device.tags)
        .where(
            or_(
                Device.name.ilike(pattern),
                Device.brand.ilike(pattern),
                Device.review_detail.ilike(pattern),
                Tag.name.ilike(pattern),
            )
        )
        .distinct()
    )


def _apply_rating_label_filter(statement: Select[tuple[Device]], rating_label: str | None) -> Select[tuple[Device]]:
    if not rating_label:
        return statement

    if rating_label == RatingLabel.GOD:
        return statement.where(Device.score > 100)
    if rating_label == RatingLabel.EXCELLENT:
        return statement.where(and_(Device.score >= 80, Device.score <= 100))
    if rating_label == RatingLabel.AVERAGE:
        return statement.where(and_(Device.score >= 50, Device.score <= 79))
    if rating_label == RatingLabel.LOW:
        return statement.where(and_(Device.score >= 1, Device.score <= 49))
    return statement


def _apply_sort(statement: Select[tuple[Device]], sort_by: SortBy, sort_order: SortOrder) -> Select[tuple[Device]]:
    direction = {"asc": lambda value: value.asc(), "desc": lambda value: value.desc()}[sort_order]
    fallback_direction = {"asc": lambda value: value.asc(), "desc": lambda value: value.desc()}[sort_order]
    sort_column = func.lower(Device.name) if sort_by == "name" else getattr(Device, sort_by)
    return statement.order_by(direction(sort_column), fallback_direction(Device.created_at))


def list_devices(
    session: Session,
    settings: Settings,
    search: str | None = None,
    category: str | None = None,
    status: str | None = None,
    rating_label: str | None = None,
    purchase_year: int | None = None,
    feeling_only: bool | None = None,
    sort_by: SortBy = "purchase_date",
    sort_order: SortOrder = "desc",
) -> tuple[list[DeviceListItem], int]:
    statement: Select[tuple[Device]] = select(Device).options(selectinload(Device.tags))
    statement = _apply_search(statement, search)

    if category:
        statement = statement.where(Device.category == category)
    if status:
        statement = statement.where(Device.status == status)
    if purchase_year:
        statement = statement.where(extract("year", Device.purchase_date) == purchase_year)
    if feeling_only is True:
        statement = statement.where(Device.score == -1)
    elif feeling_only is False:
        statement = statement.where(Device.score != -1)

    statement = _apply_rating_label_filter(statement, rating_label)
    statement = _apply_sort(statement, sort_by, sort_order)

    devices = session.execute(statement).scalars().unique().all()
    items = [serialize_device(device, settings) for device in devices]
    return items, len(items)


def make_dedup_key(payload: DeviceCreate) -> tuple[str, str, int, str | None]:
    return (
        payload.brand.strip().lower(),
        payload.name.strip().lower(),
        payload.acquisition_iteration,
        payload.purchase_date.isoformat() if payload.purchase_date else None,
    )
