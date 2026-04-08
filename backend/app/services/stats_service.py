from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import DeviceCategory, DeviceRating, DeviceStatus
from app.models.device import Device
from app.schemas.dashboard import CountBucket, DashboardSummary


def _count_by_enum(session: Session, column, enum_cls) -> list[CountBucket]:
    counts = dict(session.execute(select(column, func.count(Device.id)).group_by(column)).all())
    return [CountBucket(key=enum_value, count=counts.get(enum_value, 0)) for enum_value in enum_cls]


def get_dashboard_summary(session: Session) -> DashboardSummary:
    currently_owned_count = session.scalar(select(func.count(Device.id)).where(Device.is_currently_owned.is_(True))) or 0
    sold_count = session.scalar(select(func.count(Device.id)).where(Device.status == DeviceStatus.SOLD)) or 0
    ratings = _count_by_enum(session, Device.rating, DeviceRating)
    categories = _count_by_enum(session, Device.category, DeviceCategory)
    return DashboardSummary(
        currently_owned_count=currently_owned_count,
        sold_count=sold_count,
        ratings=ratings,
        categories=categories,
    )
