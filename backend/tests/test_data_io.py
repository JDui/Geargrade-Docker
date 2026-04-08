from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceStatus
from app.schemas.data import DataImportRequest
from app.schemas.device import DeviceCreate
from app.services.data_service import export_data, import_data
from app.services.device_service import create_device


def test_export_and_import_skip_duplicates(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Exported Device",
            brand="Brand",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=88,
            acquisition_iteration=1,
            review_detail="test",
            purchase_date="2024-01-01",
            tags=["sample"],
        ),
        settings,
    )

    exported = export_data(session)
    assert len(exported.items) == 1
    assert exported.items[0].tags == ["sample"]

    result = import_data(session, DataImportRequest(items=exported.items), settings)
    assert result.total == 1
    assert result.created == 0
    assert result.skipped == 1
    assert result.errors == []
