from collections.abc import Iterable

from sqlalchemy import Select, case, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.core.enums import DeviceRating, DeviceStatus
from app.models.device import Device
from app.models.tag import Tag
from app.schemas.device import DeviceCreate, DeviceDetail, DeviceListItem, DeviceUpdate, SortBy, SortOrder


RATING_WEIGHT = {
    DeviceRating.GOD: 5,
    DeviceRating.EXCELLENT: 4,
    DeviceRating.AVERAGE: 3,
    DeviceRating.LOW: 2,
    DeviceRating.SPECIAL: 1,
}
OWNED_STATUSES = {DeviceStatus.HOLDING, DeviceStatus.FOR_SALE, DeviceStatus.PENDING}


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


def serialize_device(device: Device, settings: Settings, detailed: bool = False) -> DeviceListItem | DeviceDetail:
    payload = {
        "id": device.id,
        "name": device.name,
        "brand": device.brand,
        "category": device.category,
        "mount_system": device.mount_system,
        "status": device.status,
        "rating": device.rating,
        "summary": device.summary,
        "tags": [tag.name for tag in device.tags],
        "purchase_price": device.purchase_price,
        "sale_price": device.sale_price,
        "purchase_date": device.purchase_date,
        "sale_date": device.sale_date,
        "is_currently_owned": device.is_currently_owned,
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


def _derive_owned_flag(status: DeviceStatus, explicit_value: bool | None) -> bool:
    if explicit_value is not None:
        return explicit_value
    return status in OWNED_STATUSES


def _cleanup_media_file(settings: Settings, storage_path: str | None) -> None:
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


def create_device(session: Session, payload: DeviceCreate, settings: Settings | None) -> Device:
    device = Device(
        name=payload.name,
        brand=payload.brand,
        category=payload.category,
        mount_system=payload.mount_system,
        status=payload.status,
        rating=payload.rating,
        summary=payload.summary,
        pros=payload.pros,
        cons=payload.cons,
        review_detail=payload.review_detail,
        purchase_price=payload.purchase_price,
        sale_price=payload.sale_price,
        purchase_date=payload.purchase_date,
        sale_date=payload.sale_date,
        is_currently_owned=_derive_owned_flag(payload.status, payload.is_currently_owned),
        image_source_type=payload.image_source_type,
        image_original_url=payload.image_original_url,
        image_storage_path=payload.image_storage_path,
        image_storage_name=payload.image_storage_name,
    )
    session.add(device)
    session.flush()
    _assign_tags(session, device, payload.tags)
    session.commit()
    session.refresh(device)
    return device


def get_device(session: Session, device_id: int) -> Device | None:
    statement = select(Device).options(selectinload(Device.tags)).where(Device.id == device_id)
    return session.scalar(statement)


def update_device(session: Session, device: Device, payload: DeviceUpdate, settings: Settings) -> Device:
    data = payload.model_dump(exclude_unset=True)
    previous_storage_path = device.image_storage_path
    next_status = data.get("status", device.status)
    explicit_owned_flag = data.get("is_currently_owned")

    for field, value in data.items():
        if field == "tags":
            continue
        setattr(device, field, value)

    device.is_currently_owned = _derive_owned_flag(next_status, explicit_owned_flag)

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
                Device.summary.ilike(pattern),
                Device.review_detail.ilike(pattern),
                Tag.name.ilike(pattern),
            )
        )
        .distinct()
    )


def _apply_sort(statement: Select[tuple[Device]], sort_by: SortBy, sort_order: SortOrder) -> Select[tuple[Device]]:
    direction = {"asc": lambda value: value.asc(), "desc": lambda value: value.desc()}[sort_order]

    if sort_by == "rating":
        rating_case = case(RATING_WEIGHT, value=Device.rating, else_=0)
        return statement.order_by(direction(rating_case), Device.updated_at.desc())

    sort_column = getattr(Device, sort_by)
    return statement.order_by(direction(sort_column), Device.updated_at.desc())


def list_devices(
    session: Session,
    settings: Settings,
    search: str | None = None,
    category: str | None = None,
    status: str | None = None,
    rating: str | None = None,
    sort_by: SortBy = "updated_at",
    sort_order: SortOrder = "desc",
) -> tuple[list[DeviceListItem], int]:
    statement: Select[tuple[Device]] = select(Device).options(selectinload(Device.tags))
    statement = _apply_search(statement, search)

    if category:
        statement = statement.where(Device.category == category)
    if status:
        statement = statement.where(Device.status == status)
    if rating:
        statement = statement.where(Device.rating == rating)

    statement = _apply_sort(statement, sort_by, sort_order)

    devices = session.execute(statement).scalars().unique().all()
    items = [serialize_device(device, settings) for device in devices]
    return items, len(items)
