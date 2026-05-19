from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pydantic import ValidationError
from sqlalchemy import delete
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import Settings
from app.models import Device, Tag, WishlistDevice, device_tags, wishlist_device_tags
from app.schemas.data import (
    DataExportResponse,
    DataImportError,
    DataImportRequest,
    DataImportResponse,
    DataImportSkippedDetail,
    DataResetResponse,
    GGPack,
    GGPackImportRequest,
    GGPackImportResponse,
    GGPackPreviewResponse,
    GGPackRowError,
    GGPackRowPreview,
    GGPackScope,
    GGPackTable,
    GGPackTableName,
    GGPackTablePreview,
)
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.schemas.wishlist import WishlistDeviceCreate, WishlistDeviceUpdate
from app.services import device_service, wishlist_service


DEVICE_COLUMNS = list(DeviceCreate.model_fields.keys())
WISHLIST_COLUMNS = list(WishlistDeviceCreate.model_fields.keys())
TABLE_COLUMNS: dict[GGPackTableName, list[str]] = {
    "devices": DEVICE_COLUMNS,
    "wishlist": WISHLIST_COLUMNS,
}
TABLE_DEDUP_KEYS: dict[GGPackTableName, list[str]] = {
    "devices": ["brand", "name", "acquisition_iteration", "purchase_date"],
    "wishlist": ["brand", "name", "acquisition_iteration"],
}


def export_data(session: Session) -> DataExportResponse:
    devices = device_service.get_devices_for_export(session)
    items = [device_service.export_device_payload(device) for device in devices]
    return DataExportResponse(
        exported_at=datetime.now(timezone.utc),
        item_count=len(items),
        items=items,
    )


def import_data(session: Session, payload: DataImportRequest, settings: Settings) -> DataImportResponse:
    existing_devices = device_service.get_devices_for_export(session)
    dedup_keys = {device_service.make_dedup_key(device_service.export_device_payload(device)) for device in existing_devices}

    created = 0
    skipped = 0
    skipped_details: list[DataImportSkippedDetail] = []
    errors: list[DataImportError] = []

    for index, item in enumerate(payload.items):
        dedup_key = device_service.make_dedup_key(item)
        if dedup_key in dedup_keys:
            skipped += 1
            skipped_details.append(DataImportSkippedDetail(index=index, name=item.name, reason="duplicate"))
            continue
        try:
            device_service.create_device(session, item, settings)
            dedup_keys.add(dedup_key)
            created += 1
        except Exception as exc:  # noqa: BLE001
            errors.append(DataImportError(index=index, name=item.name, reason=str(exc)))

    return DataImportResponse(
        total=len(payload.items),
        created=created,
        skipped=skipped,
        skipped_details=skipped_details,
        errors=errors,
    )


def _export_wishlist_payload(device: WishlistDevice) -> WishlistDeviceCreate:
    return WishlistDeviceCreate(
        name=device.name,
        brand=device.brand,
        category=device.category,
        mount_system_key=device.mount_system_key,
        mount_system_custom=device.mount_system_custom,
        score=device.score,
        acquisition_iteration=device.acquisition_iteration,
        pros=device.pros or [],
        cons=device.cons or [],
        review_detail=device.review_detail or "",
        tags=[tag.name for tag in device.tags],
        image_source_type=device.image_source_type,
        image_original_url=device.image_original_url,
        image_storage_path=device.image_storage_path,
        image_storage_name=device.image_storage_name,
    )


def _get_wishlist_for_export(session: Session) -> list[WishlistDevice]:
    statement = (
        select(WishlistDevice)
        .options(selectinload(WishlistDevice.tags))
        .order_by(WishlistDevice.updated_at.desc(), WishlistDevice.created_at.desc())
    )
    return session.execute(statement).scalars().unique().all()


def _table_from_items(name: GGPackTableName, items: list[DeviceCreate] | list[WishlistDeviceCreate]) -> GGPackTable:
    return GGPackTable(
        name=name,
        columns=TABLE_COLUMNS[name],
        rows=[item.model_dump(mode="json") for item in items],
        dedup_key=TABLE_DEDUP_KEYS[name],
    )


def export_ggpack(session: Session, scope: GGPackScope) -> GGPack:
    tables: list[GGPackTable] = []

    if scope in {"devices", "all"}:
        devices = device_service.get_devices_for_export(session)
        device_items = [device_service.export_device_payload(device) for device in devices]
        tables.append(_table_from_items("devices", device_items))

    if scope in {"wishlist", "all"}:
        wishlist_devices = _get_wishlist_for_export(session)
        wishlist_items = [_export_wishlist_payload(device) for device in wishlist_devices]
        tables.append(_table_from_items("wishlist", wishlist_items))

    return GGPack(
        exported_at=datetime.now(timezone.utc),
        tables=tables,
        counts={table.name: len(table.rows) for table in tables},
    )


def _wishlist_dedup_key(payload: WishlistDeviceCreate) -> tuple[str, str, int]:
    return (
        payload.brand.strip().lower(),
        payload.name.strip().lower(),
        payload.acquisition_iteration,
    )


def _device_map(session: Session) -> dict[tuple[str, str, int, str | None], Device]:
    devices = device_service.get_devices_for_export(session)
    return {device_service.make_dedup_key(device_service.export_device_payload(device)): device for device in devices}


def _wishlist_map(session: Session) -> dict[tuple[str, str, int], WishlistDevice]:
    devices = _get_wishlist_for_export(session)
    return {_wishlist_dedup_key(_export_wishlist_payload(device)): device for device in devices}


def _validation_reason(exc: ValidationError) -> str:
    messages: list[str] = []
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"])
        messages.append(f"{location}: {error['msg']}" if location else error["msg"])
    return "; ".join(messages)


def _row_name(row: dict[str, Any]) -> str | None:
    value = row.get("name")
    return value if isinstance(value, str) else None


def _validate_row(table_name: GGPackTableName, row: dict[str, Any]) -> DeviceCreate | WishlistDeviceCreate:
    invalid_columns = sorted(set(row) - set(TABLE_COLUMNS[table_name]))
    if invalid_columns:
        raise ValueError(f"invalid columns: {', '.join(invalid_columns)}")
    if table_name == "devices":
        return DeviceCreate.model_validate(row)
    return WishlistDeviceCreate.model_validate(row)


def _preview_table(
    table: GGPackTable,
    device_map: dict[tuple[str, str, int, str | None], Device],
    wishlist_map: dict[tuple[str, str, int], WishlistDevice],
) -> GGPackTablePreview:
    errors: list[GGPackRowError] = []
    rows: list[GGPackRowPreview] = []
    create = 0
    update = 0
    skipped = 0
    valid = 0

    invalid_columns = sorted(set(table.columns) - set(TABLE_COLUMNS[table.name]))

    for index, row in enumerate(table.rows):
        if invalid_columns:
            reason = f"invalid columns: {', '.join(invalid_columns)}"
            errors.append(GGPackRowError(table=table.name, index=index, name=_row_name(row), reason=reason))
            rows.append(GGPackRowPreview(index=index, name=_row_name(row), action="error", selected=False, reason=reason))
            continue

        try:
            item = _validate_row(table.name, row)
        except ValidationError as exc:
            reason = _validation_reason(exc)
            errors.append(GGPackRowError(table=table.name, index=index, name=_row_name(row), reason=reason))
            rows.append(GGPackRowPreview(index=index, name=_row_name(row), action="error", selected=False, reason=reason))
            continue
        except ValueError as exc:
            reason = str(exc)
            errors.append(GGPackRowError(table=table.name, index=index, name=_row_name(row), reason=reason))
            rows.append(GGPackRowPreview(index=index, name=_row_name(row), action="error", selected=False, reason=reason))
            continue

        valid += 1
        if table.name == "devices":
            action = "update" if device_service.make_dedup_key(item) in device_map else "create"
        else:
            action = "update" if _wishlist_dedup_key(item) in wishlist_map else "create"

        if action == "update":
            update += 1
        else:
            create += 1
        rows.append(GGPackRowPreview(index=index, name=item.name, action=action))

    return GGPackTablePreview(
        name=table.name,
        total=len(table.rows),
        valid=valid,
        create=create,
        update=update,
        skipped=skipped,
        errors=errors,
        rows=rows,
    )


def preview_ggpack(session: Session, payload: GGPackImportRequest) -> GGPackPreviewResponse:
    device_map = _device_map(session)
    wishlist_map = _wishlist_map(session)
    previews = [_preview_table(table, device_map, wishlist_map) for table in payload.package.tables]
    return GGPackPreviewResponse(tables=previews)


def import_ggpack(session: Session, payload: GGPackImportRequest, settings: Settings) -> GGPackImportResponse:
    device_map = _device_map(session)
    wishlist_map = _wishlist_map(session)
    selected = payload.selection or {}
    created = 0
    updated = 0
    skipped = 0
    total = 0
    errors: list[GGPackRowError] = []

    for table in payload.package.tables:
        selected_indexes = set(selected.get(table.name, range(len(table.rows)))) if payload.selection is not None else None
        invalid_columns = sorted(set(table.columns) - set(TABLE_COLUMNS[table.name]))

        for index, row in enumerate(table.rows):
            if selected_indexes is not None and index not in selected_indexes:
                skipped += 1
                continue

            total += 1
            if invalid_columns:
                errors.append(
                    GGPackRowError(
                        table=table.name,
                        index=index,
                        name=_row_name(row),
                        reason=f"invalid columns: {', '.join(invalid_columns)}",
                    )
                )
                continue

            try:
                item = _validate_row(table.name, row)
            except ValidationError as exc:
                errors.append(GGPackRowError(table=table.name, index=index, name=_row_name(row), reason=_validation_reason(exc)))
                continue
            except ValueError as exc:
                errors.append(GGPackRowError(table=table.name, index=index, name=_row_name(row), reason=str(exc)))
                continue

            if table.name == "devices":
                key = device_service.make_dedup_key(item)
                existing = device_map.get(key)
                if existing is None:
                    created_device = device_service.create_device(session, item, settings)
                    device_map[key] = created_device
                    created += 1
                else:
                    updated_device = device_service.update_device(
                        session,
                        existing,
                        DeviceUpdate(**item.model_dump()),
                        settings,
                    )
                    device_map[key] = updated_device
                    updated += 1
            else:
                wishlist_key = _wishlist_dedup_key(item)
                existing_wishlist = wishlist_map.get(wishlist_key)
                if existing_wishlist is None:
                    created_wishlist = wishlist_service.create_wishlist_device(session, item, settings)
                    wishlist_map[wishlist_key] = created_wishlist
                    created += 1
                else:
                    updated_wishlist = wishlist_service.update_wishlist_device(
                        session,
                        existing_wishlist,
                        WishlistDeviceUpdate(**item.model_dump()),
                        settings,
                    )
                    wishlist_map[wishlist_key] = updated_wishlist
                    updated += 1

    return GGPackImportResponse(total=total, created=created, updated=updated, skipped=skipped, errors=errors)


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
