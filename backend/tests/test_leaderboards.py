from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceStatus
from app.schemas.device import DeviceCreate
from app.services.device_service import create_device
from app.services.leaderboard_service import (
    get_finance_leaderboard,
    get_holding_duration_leaderboard,
    get_score_leaderboard,
)


def test_leaderboards(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Hold Long",
            brand="Alpha",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=90,
            acquisition_iteration=1,
            review_detail="still holding",
            purchase_date="2024-01-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Sold Profit",
            brand="Beta",
            category=DeviceCategory.LENS,
            status=DeviceStatus.SOLD,
            score=70,
            acquisition_iteration=1,
            review_detail="sold",
            purchase_price=1000,
            sale_price=1600,
            purchase_date="2025-01-01",
            sale_date="2025-03-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Feeling Device",
            brand="Gamma",
            category=DeviceCategory.OTHER,
            status=DeviceStatus.HOLDING,
            score=-1,
            acquisition_iteration=1,
            review_detail="feeling",
            purchase_date="2025-05-01",
        ),
        settings,
    )

    holding_desc = get_holding_duration_leaderboard(session, sort_order="desc")
    holding_asc = get_holding_duration_leaderboard(session, sort_order="asc")
    score = get_score_leaderboard(session, sort_order="desc")
    finance = get_finance_leaderboard(session, sort_order="desc")

    assert holding_desc.items[0].name == "Hold Long"
    assert holding_asc.items[0].name == "Sold Profit"
    assert all(item.name != "Feeling Device" for item in score.items)
    assert finance.items[0].profit_value == 600
