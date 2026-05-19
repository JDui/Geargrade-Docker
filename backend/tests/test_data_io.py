from sqlalchemy import func, select

from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceStatus
from app.models.device import Device
from app.models.wishlist_device import WishlistDevice
from app.schemas.data import GGPack, GGPackImportRequest, GGPackTable, DataImportRequest
from app.schemas.device import DeviceCreate
from app.schemas.wishlist import WishlistDeviceCreate
from app.services.data_service import export_data, export_ggpack, import_data, import_ggpack, preview_ggpack
from app.services.device_service import create_device
from app.services.wishlist_service import create_wishlist_device


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
    assert exported.schema_version == "geargrade.data.v1"
    assert exported.item_count == 1
    assert len(exported.items) == 1
    assert exported.items[0].tags == ["sample"]

    result = import_data(session, DataImportRequest(items=exported.items), settings)
    assert result.total == 1
    assert result.created == 0
    assert result.skipped == 1
    assert result.skipped_details[0].reason == "duplicate"
    assert result.errors == []


def test_import_request_accepts_array_and_metadata_envelope():
    item = {
        "name": "  Wrapped Device  ",
        "brand": "  Brand  ",
        "category": "camera_body",
        "status": "holding",
        "score": -1,
        "acquisition_iteration": 1,
        "review_detail": "  note  ",
        "tags": "tag-a\n tag-b ",
        "pros": "",
        "cons": None,
        "purchase_price": "",
        "purchase_date": "2024-01-01",
    }

    from_array = DataImportRequest.model_validate([item])
    assert len(from_array.items) == 1
    assert from_array.items[0].name == "Wrapped Device"
    assert from_array.items[0].brand == "Brand"
    assert from_array.items[0].tags == ["tag-a", "tag-b"]
    assert from_array.items[0].pros == []
    assert from_array.items[0].purchase_price is None

    from_envelope = DataImportRequest.model_validate(
        {
            "schema_version": "geargrade.data.v1",
            "exported_at": "2026-04-22T00:00:00Z",
            "item_count": 1,
            "source": "geargrade.main_devices",
            "items": [item],
        }
    )
    assert len(from_envelope.items) == 1
    assert from_envelope.items[0].review_detail == "note"


def test_ggpack_export_all_includes_devices_and_wishlist(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Main Device",
            brand="Brand",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=88,
            acquisition_iteration=1,
        ),
        settings,
    )
    create_wishlist_device(
        session,
        WishlistDeviceCreate(
            name="Wish Device",
            brand="Brand",
            category=DeviceCategory.LENS,
            score=70,
            acquisition_iteration=1,
        ),
        settings,
    )

    exported = export_ggpack(session, "all")

    assert exported.format == "geargrade.ggpack.v1"
    assert {table.name for table in exported.tables} == {"devices", "wishlist"}
    assert exported.counts == {"devices": 1, "wishlist": 1}


def test_ggpack_preview_does_not_write(session):
    before = session.scalar(select(func.count()).select_from(Device))
    package = GGPack(
        exported_at="2026-04-22T00:00:00Z",
        counts={"devices": 1},
        tables=[
            GGPackTable(
                name="devices",
                columns=[
                    "name",
                    "brand",
                    "category",
                    "mount_system_key",
                    "mount_system_custom",
                    "status",
                    "score",
                    "acquisition_iteration",
                    "pros",
                    "cons",
                    "review_detail",
                    "tags",
                    "purchase_price",
                    "sale_price",
                    "purchase_date",
                    "sale_date",
                    "image_source_type",
                    "image_original_url",
                    "image_storage_path",
                    "image_storage_name",
                ],
                dedup_key=["brand", "name", "acquisition_iteration", "purchase_date"],
                rows=[
                    {
                        "name": "Preview Device",
                        "brand": "Brand",
                        "category": "camera_body",
                        "status": "holding",
                        "score": 70,
                        "acquisition_iteration": 1,
                    }
                ],
            )
        ],
    )

    preview = preview_ggpack(session, GGPackImportRequest(package=package))

    after = session.scalar(select(func.count()).select_from(Device))
    assert before == after
    assert preview.tables[0].create == 1
    assert preview.tables[0].valid == 1


def test_ggpack_import_updates_duplicate_device(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Dup Device",
            brand="Brand",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=60,
            acquisition_iteration=1,
            purchase_date="2024-01-01",
            review_detail="old",
        ),
        settings,
    )
    package = GGPack(
        exported_at="2026-04-22T00:00:00Z",
        counts={"devices": 1},
        tables=[
            GGPackTable(
                name="devices",
                columns=list(DeviceCreate.model_fields.keys()),
                dedup_key=["brand", "name", "acquisition_iteration", "purchase_date"],
                rows=[
                    {
                        "name": "Dup Device",
                        "brand": "Brand",
                        "category": "camera_body",
                        "status": "holding",
                        "score": 95,
                        "acquisition_iteration": 1,
                        "purchase_date": "2024-01-01",
                        "review_detail": "updated",
                    }
                ],
            )
        ],
    )

    result = import_ggpack(session, GGPackImportRequest(package=package), settings)
    device = session.scalar(select(Device).where(Device.name == "Dup Device"))

    assert result.created == 0
    assert result.updated == 1
    assert device.score == 95
    assert device.review_detail == "updated"


def test_ggpack_import_updates_duplicate_wishlist(session):
    settings = Settings(media_root="data/media")
    create_wishlist_device(
        session,
        WishlistDeviceCreate(
            name="Dup Wish",
            brand="Brand",
            category=DeviceCategory.LENS,
            score=50,
            acquisition_iteration=2,
            review_detail="old",
        ),
        settings,
    )
    package = GGPack(
        exported_at="2026-04-22T00:00:00Z",
        counts={"wishlist": 1},
        tables=[
            GGPackTable(
                name="wishlist",
                columns=list(WishlistDeviceCreate.model_fields.keys()),
                dedup_key=["brand", "name", "acquisition_iteration"],
                rows=[
                    {
                        "name": "Dup Wish",
                        "brand": "Brand",
                        "category": "lens",
                        "score": 91,
                        "acquisition_iteration": 2,
                        "review_detail": "updated",
                    }
                ],
            )
        ],
    )

    result = import_ggpack(session, GGPackImportRequest(package=package), settings)
    wishlist = session.scalar(select(WishlistDevice).where(WishlistDevice.name == "Dup Wish"))

    assert result.created == 0
    assert result.updated == 1
    assert wishlist.score == 91
    assert wishlist.review_detail == "updated"


def test_ggpack_preview_reports_invalid_rows(session):
    package = GGPack(
        exported_at="2026-04-22T00:00:00Z",
        counts={"devices": 3},
        tables=[
            GGPackTable(
                name="devices",
                columns=list(DeviceCreate.model_fields.keys()),
                dedup_key=["brand", "name", "acquisition_iteration", "purchase_date"],
                rows=[
                    {
                        "name": "Bad Column",
                        "brand": "Brand",
                        "category": "camera_body",
                        "status": "holding",
                        "score": 70,
                        "acquisition_iteration": 1,
                        "unknown": "bad",
                    },
                    {
                        "name": "Bad Enum",
                        "brand": "Brand",
                        "category": "not-a-category",
                        "status": "holding",
                        "score": 70,
                        "acquisition_iteration": 1,
                    },
                    {
                        "name": "Missing Brand",
                        "category": "camera_body",
                        "status": "holding",
                        "score": 70,
                        "acquisition_iteration": 1,
                    },
                ],
            )
        ],
    )

    preview = preview_ggpack(session, GGPackImportRequest(package=package))

    assert preview.tables[0].valid == 0
    assert len(preview.tables[0].errors) == 3
    assert "invalid columns" in preview.tables[0].errors[0].reason
    assert "category" in preview.tables[0].errors[1].reason
    assert "brand" in preview.tables[0].errors[2].reason
