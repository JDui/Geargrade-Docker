from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceRating, DeviceStatus
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
            status=DeviceStatus.HOLDING,
            rating=DeviceRating.EXCELLENT,
            summary="便携全画幅随身机。",
            tags=["随身", "全画幅"],
        ),
        settings,
    )

    assert device.id is not None
    assert get_device(session, device.id) is not None

    updated = update_device(
        session,
        device,
        DeviceUpdate(status=DeviceStatus.SOLD, sale_price=32000, tags=["已售"]),
        settings,
    )

    assert updated.status == DeviceStatus.SOLD
    assert updated.sale_price == 32000
    assert updated.is_currently_owned is False
    assert [tag.name for tag in updated.tags] == ["已售"]


def test_list_devices_supports_search_and_rating_sort(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Sony A7C II",
            brand="Sony",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            rating=DeviceRating.AVERAGE,
            summary="轻便机身。",
            tags=["旅行"],
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Sony FE 50mm F1.2 GM",
            brand="Sony",
            category=DeviceCategory.LENS,
            status=DeviceStatus.HOLDING,
            rating=DeviceRating.GOD,
            summary="顶级人像镜头。",
            tags=["人像"],
        ),
        settings,
    )

    items, total = list_devices(session, settings, search="人像", sort_by="rating", sort_order="desc")
    assert total == 1
    assert items[0].name == "Sony FE 50mm F1.2 GM"
