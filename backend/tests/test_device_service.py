from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceStatus, MountSystemKey
from app.schemas.device import DeviceCreate, DeviceUpdate
from app.services.device_service import create_device, get_device, list_devices, update_device


def test_create_and_update_device(session):
    settings = Settings(media_root="data/media")
    device = create_device(
        session,
        DeviceCreate(
            name="Leica Q3",
            brand="Leica",
            category=DeviceCategory.CAMERA_BODY,
            mount_system_key=MountSystemKey.NONE,
            status=DeviceStatus.HOLDING,
            score=89,
            acquisition_iteration=2,
            review_detail="便携全画幅随身机。",
            tags=["随身", "全画幅"],
        ),
        settings,
    )

    assert device.id is not None
    assert get_device(session, device.id) is not None

    updated = update_device(
        session,
        device,
        DeviceUpdate(status=DeviceStatus.SOLD, sale_price=32000, sale_date="2026-04-08", tags=["已售"]),
        settings,
    )

    assert updated.status == DeviceStatus.SOLD
    assert updated.sale_price == 32000
    assert updated.acquisition_iteration == 2
    assert [tag.name for tag in updated.tags] == ["已售"]


def test_list_devices_supports_year_and_rating_label_filters(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Sony A7C II",
            brand="Sony",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=52,
            acquisition_iteration=1,
            review_detail="轻便机身。",
            tags=["旅行"],
            purchase_date="2024-03-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Sony FE 50mm F1.2 GM",
            brand="Sony",
            category=DeviceCategory.LENS,
            mount_system_key=MountSystemKey.FE,
            status=DeviceStatus.HOLDING,
            score=101,
            acquisition_iteration=1,
            review_detail="顶级人像镜头。",
            tags=["人像"],
            purchase_date="2025-01-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Feeling Device",
            brand="Sony",
            category=DeviceCategory.OTHER,
            status=DeviceStatus.HOLDING,
            score=-1,
            acquisition_iteration=1,
            review_detail="还在感受。",
            purchase_date="2025-01-02",
        ),
        settings,
    )

    items, total = list_devices(
        session,
        settings,
        search="人像",
        rating_label="god",
        purchase_year=2025,
        sort_by="score",
        sort_order="desc",
    )
    assert total == 1
    assert items[0].name == "Sony FE 50mm F1.2 GM"

    feeling_items, feeling_total = list_devices(session, settings, feeling_only=True)
    assert feeling_total == 1
    assert feeling_items[0].score == -1
    assert feeling_items[0].rating_label is None


def test_status_rules_normalize_sale_fields(session):
    settings = Settings(media_root="data/media")

    holding = create_device(
        session,
        DeviceCreate(
            name="Holding Device",
            brand="Brand",
            category=DeviceCategory.OTHER,
            status=DeviceStatus.HOLDING,
            score=40,
            acquisition_iteration=1,
            review_detail="test",
            sale_price=100,
            sale_date="2026-02-01",
            purchase_date="2026-01-01",
        ),
        settings,
    )
    assert holding.sale_date is None
    assert holding.sale_price is None

    for_sale = create_device(
        session,
        DeviceCreate(
            name="For Sale Device",
            brand="Brand",
            category=DeviceCategory.OTHER,
            status=DeviceStatus.FOR_SALE,
            score=40,
            acquisition_iteration=1,
            review_detail="test",
            sale_price=500,
            sale_date="2026-02-01",
            purchase_date="2026-01-01",
        ),
        settings,
    )
    assert for_sale.sale_date is None
    assert for_sale.sale_price is None

    broken = create_device(
        session,
        DeviceCreate(
            name="Broken Device",
            brand="Brand",
            category=DeviceCategory.OTHER,
            status=DeviceStatus.BROKEN,
            score=-1,
            acquisition_iteration=1,
            review_detail="test",
            sale_price=100,
            sale_date="2026-02-01",
            purchase_date="2026-01-01",
        ),
        settings,
    )
    assert broken.sale_date is None
    assert broken.sale_price == 0
