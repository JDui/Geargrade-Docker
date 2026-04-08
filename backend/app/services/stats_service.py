from collections import Counter

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import DeviceCategory, DeviceStatus, RatingLabel, is_feeling_score, rating_label_from_score
from app.models.device import Device
from app.schemas.dashboard import CountBucket, DashboardSummary


def _count_by_enum(session: Session, column, enum_cls) -> list[CountBucket]:
    counts = dict(session.execute(select(column, func.count(Device.id)).group_by(column)).all())
    return [CountBucket(key=enum_value, count=counts.get(enum_value, 0)) for enum_value in enum_cls]


def get_dashboard_summary(session: Session) -> DashboardSummary:
    currently_owned_count = session.scalar(
        select(func.count(Device.id)).where(Device.status.in_([DeviceStatus.HOLDING, DeviceStatus.FOR_SALE]))
    ) or 0
    sold_count = session.scalar(select(func.count(Device.id)).where(Device.status == DeviceStatus.SOLD)) or 0
    feeling_in_progress_count = session.scalar(select(func.count(Device.id)).where(Device.score == -1)) or 0

    scores = session.scalars(select(Device.score)).all()
    rating_counter = Counter(
        label for score in scores if not is_feeling_score(score) for label in [rating_label_from_score(score)] if label is not None
    )
    ratings = [CountBucket(key=label, count=rating_counter.get(label, 0)) for label in RatingLabel]
    categories = _count_by_enum(session, Device.category, DeviceCategory)
    return DashboardSummary(
        currently_owned_count=currently_owned_count,
        sold_count=sold_count,
        feeling_in_progress_count=feeling_in_progress_count,
        ratings=ratings,
        categories=categories,
    )
