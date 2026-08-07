from app.core.config import Settings
from app.core.enums import DeviceCategory, DeviceStatus, RatingLabel
from app.schemas.device import DeviceCreate
from app.services.device_service import create_device
from app.services.stats_service import get_dashboard_summary
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
    assert next(item for item in holding_desc.items if item.name == "Sold Profit").duration_months == 2
    assert all(item.name != "Feeling Device" for item in score.items)
    assert finance.items[0].profit_value == 600


def test_leaderboards_can_filter_by_category(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Body High Score",
            brand="Alpha",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=90,
            acquisition_iteration=1,
            review_detail="body",
            purchase_date="2024-01-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Lens Lower Score",
            brand="Beta",
            category=DeviceCategory.LENS,
            status=DeviceStatus.HOLDING,
            score=80,
            acquisition_iteration=1,
            review_detail="lens",
            purchase_date="2024-02-01",
        ),
        settings,
    )

    score_all = get_score_leaderboard(session, sort_order="desc")
    score_body = get_score_leaderboard(session, sort_order="desc", category=DeviceCategory.CAMERA_BODY)

    assert [item.name for item in score_all.items] == ["Body High Score", "Lens Lower Score"]
    assert [item.name for item in score_body.items] == ["Body High Score"]
    assert all(item.rank == 1 for item in score_body.items)

    holding_lens = get_holding_duration_leaderboard(
        session,
        sort_order="desc",
        category=DeviceCategory.LENS,
    )
    assert [item.name for item in holding_lens.items] == ["Lens Lower Score"]


def test_holding_duration_leaderboard_can_sort_by_calendar_months(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Month One Long Days",
            brand="Alpha",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.SOLD,
            score=80,
            acquisition_iteration=1,
            review_detail="long days",
            purchase_date="2025-01-01",
            sale_date="2025-02-28",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Month Two Short Days",
            brand="Beta",
            category=DeviceCategory.LENS,
            status=DeviceStatus.SOLD,
            score=80,
            acquisition_iteration=1,
            review_detail="short days",
            purchase_date="2025-01-31",
            sale_date="2025-03-01",
        ),
        settings,
    )

    by_days = get_holding_duration_leaderboard(session, sort_order="desc")
    by_months = get_holding_duration_leaderboard(session, sort_order="desc", duration_unit="months")

    assert by_days.items[0].name == "Month One Long Days"
    assert by_months.items[0].name == "Month Two Short Days"
    assert by_months.items[0].duration_months == 2


def test_dashboard_purchase_years_excludes_accessories(session):
    settings = Settings(media_root="data/media")
    create_device(
        session,
        DeviceCreate(
            name="Body 2023",
            brand="Alpha",
            category=DeviceCategory.CAMERA_BODY,
            status=DeviceStatus.HOLDING,
            score=80,
            acquisition_iteration=1,
            review_detail="test",
            purchase_date="2023-02-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Accessory 2023",
            brand="Alpha",
            category=DeviceCategory.ACCESSORY,
            status=DeviceStatus.HOLDING,
            score=80,
            acquisition_iteration=1,
            review_detail="test",
            purchase_date="2023-05-01",
        ),
        settings,
    )
    create_device(
        session,
        DeviceCreate(
            name="Lens 2024",
            brand="Alpha",
            category=DeviceCategory.LENS,
            status=DeviceStatus.HOLDING,
            score=80,
            acquisition_iteration=1,
            review_detail="test",
            purchase_date="2024-01-01",
        ),
        settings,
    )

    summary = get_dashboard_summary(session)
    assert [(bucket.year, bucket.count) for bucket in summary.purchase_years] == [
        (2023, 1),
        (2024, 1),
    ]
    assert summary.purchase_year_category_breakdown[0].year == 2023
    assert [(bucket.key, bucket.count) for bucket in summary.purchase_year_category_breakdown[0].buckets] == [
        (DeviceCategory.CAMERA_BODY, 1),
        (DeviceCategory.LENS, 0),
        (DeviceCategory.ACTION_CAMERA, 0),
        (DeviceCategory.DRONE, 0),
        (DeviceCategory.OTHER, 0),
    ]
    assert [(bucket.key, bucket.count) for bucket in summary.purchase_year_rating_breakdown[0].buckets] == [
        (RatingLabel.GOD, 0),
        (RatingLabel.EXCELLENT, 1),
        (RatingLabel.AVERAGE, 0),
        (RatingLabel.LOW, 0),
    ]
