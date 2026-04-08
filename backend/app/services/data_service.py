from sqlalchemy.orm import Session

from app.core.config import Settings
from app.schemas.data import DataExportResponse, DataImportError, DataImportRequest, DataImportResponse
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
