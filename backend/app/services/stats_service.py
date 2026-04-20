from collections import Counter, defaultdict

from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session

from app.core.enums import (
    DeviceCategory,
    DeviceStatus,
    RatingLabel,
    is_feeling_score,
    is_unrated_score,
    rating_label_from_score,
)
from app.models.device import Device
from app.schemas.dashboard import (
    CategoryCountBucket,
    DashboardSummary,
    PurchaseYearBucket,
    PurchaseYearCategoryBreakdownBucket,
    PurchaseYearRatingBreakdownBucket,
    RatingCountBucket,
)


NON_ACCESSORY_CATEGORIES = [
    DeviceCategory.CAMERA_BODY,
    DeviceCategory.LENS,
    DeviceCategory.ACTION_CAMERA,
    DeviceCategory.DRONE,
    DeviceCategory.OTHER,
]


def _count_by_category(session: Session) -> list[CategoryCountBucket]:
    counts = dict(session.execute(select(Device.category, func.count(Device.id)).group_by(Device.category)).all())
    return [CategoryCountBucket(key=category, count=counts.get(category, 0)) for category in DeviceCategory]


def _purchase_years(session: Session) -> list[PurchaseYearBucket]:
    rows = session.execute(
        select(extract("year", Device.purchase_date), func.count(Device.id))
        .where(
            Device.purchase_date.is_not(None),
            Device.category != DeviceCategory.ACCESSORY,
        )
        .group_by(extract("year", Device.purchase_date))
        .order_by(extract("year", Device.purchase_date).asc())
    ).all()

    return [PurchaseYearBucket(year=int(year), count=count) for year, count in rows if year is not None]


def _purchase_year_category_breakdown(
    session: Session, year_buckets: list[PurchaseYearBucket]
) -> list[PurchaseYearCategoryBreakdownBucket]:
    rows = session.execute(
        select(extract("year", Device.purchase_date), Device.category, func.count(Device.id))
        .where(
            Device.purchase_date.is_not(None),
            Device.category != DeviceCategory.ACCESSORY,
        )
        .group_by(extract("year", Device.purchase_date), Device.category)
        .order_by(extract("year", Device.purchase_date).asc())
    ).all()

    counts_by_year: dict[int, dict[DeviceCategory, int]] = defaultdict(dict)
    for year, category, count in rows:
        if year is None or category is None:
            continue
        counts_by_year[int(year)][category] = count

    return [
        PurchaseYearCategoryBreakdownBucket(
            year=year_bucket.year,
            buckets=[
                CategoryCountBucket(key=category, count=counts_by_year[year_bucket.year].get(category, 0))
                for category in NON_ACCESSORY_CATEGORIES
            ],
        )
        for year_bucket in year_buckets
    ]


def _purchase_year_rating_breakdown(
    session: Session, year_buckets: list[PurchaseYearBucket]
) -> list[PurchaseYearRatingBreakdownBucket]:
    rows = session.execute(
        select(extract("year", Device.purchase_date), Device.score)
        .where(
            Device.purchase_date.is_not(None),
            Device.category != DeviceCategory.ACCESSORY,
        )
        .order_by(extract("year", Device.purchase_date).asc())
    ).all()

    counts_by_year: dict[int, Counter[RatingLabel]] = defaultdict(Counter)
    for year, score in rows:
        if year is None or score is None or is_feeling_score(score) or is_unrated_score(score):
            continue
        label = rating_label_from_score(score)
        if label is None:
            continue
        counts_by_year[int(year)][label] += 1

    return [
        PurchaseYearRatingBreakdownBucket(
            year=year_bucket.year,
            buckets=[
                RatingCountBucket(key=label, count=counts_by_year[year_bucket.year].get(label, 0))
                for label in RatingLabel
            ],
        )
        for year_bucket in year_buckets
    ]


def get_dashboard_summary(session: Session) -> DashboardSummary:
    currently_owned_count = session.scalar(
        select(func.count(Device.id)).where(Device.status.in_([DeviceStatus.HOLDING, DeviceStatus.FOR_SALE]))
    ) or 0
    sold_count = session.scalar(select(func.count(Device.id)).where(Device.status == DeviceStatus.SOLD)) or 0
    feeling_in_progress_count = session.scalar(select(func.count(Device.id)).where(Device.score == -1)) or 0

    scores = session.scalars(select(Device.score)).all()
    rating_counter = Counter(
        label
        for score in scores
        if not is_feeling_score(score) and not is_unrated_score(score)
        for label in [rating_label_from_score(score)]
        if label is not None
    )

    year_buckets = _purchase_years(session)

    return DashboardSummary(
        currently_owned_count=currently_owned_count,
        sold_count=sold_count,
        feeling_in_progress_count=feeling_in_progress_count,
        ratings=[RatingCountBucket(key=label, count=rating_counter.get(label, 0)) for label in RatingLabel],
        categories=_count_by_category(session),
        purchase_years=year_buckets,
        purchase_year_category_breakdown=_purchase_year_category_breakdown(session, year_buckets),
        purchase_year_rating_breakdown=_purchase_year_rating_breakdown(session, year_buckets),
    )
