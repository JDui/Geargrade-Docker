from pathlib import Path

from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.models import Device, Tag, WishlistDevice, device_tags, wishlist_device_tags
from app.schemas.data import (
    DataExportResponse,
    DataImportError,
    DataImportRequest,
    DataImportResponse,
    DataResetResponse,
)
from app.services import device_service


def export_data(session: Session) -> DataExportResponse:
    devices = device_service.get_devices_for_export(session)
    items = [device_service.export_device_payload(device) for device in devices]
    return DataExportResponse(items=items)


def import_data(session: Session, payload: DataImportRequest, settings: Settings) -> DataImportResponse:
    existing_devices = device_service.get_devices_for_export(session)
    dedup_keys = {device_service.make_dedup_key(device_service.export_device_payload(device)) for device in existing_devices}

    created = 0
    skipped = 0
    errors: list[DataImportError] = []

    for index, item in enumerate(payload.items):
        dedup_key = device_service.make_dedup_key(item)
        if dedup_key in dedup_keys:
            skipped += 1
            continue
        try:
            device_service.create_device(session, item, settings)
            dedup_keys.add(dedup_key)
            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(DataImportError(index=index, name=item.name, reason=str(exc)))

    return DataImportResponse(total=len(payload.items), created=created, skipped=skipped, errors=errors)


def _clear_media_files(root: Path) -> int:
    if not root.exists():
        return 0

    deleted = 0
    for path in root.rglob("*"):
        if path.is_file():
            path.unlink()
            deleted += 1
    return deleted


def reset_all_data(session: Session, settings: Settings) -> DataResetResponse:
    devices_deleted = session.query(Device).count()
    wishlist_deleted = session.query(WishlistDevice).count()

    session.execute(device_tags.delete())
    session.execute(wishlist_device_tags.delete())
    session.execute(delete(Device))
    session.execute(delete(WishlistDevice))
    session.execute(delete(Tag))
    session.commit()

    media_files_deleted = _clear_media_files(settings.media_root)
    (settings.media_root / "uploads").mkdir(parents=True, exist_ok=True)
    (settings.media_root / "remote-cache").mkdir(parents=True, exist_ok=True)

    return DataResetResponse(
        devices_deleted=devices_deleted,
        wishlist_deleted=wishlist_deleted,
        media_files_deleted=media_files_deleted,
    )
