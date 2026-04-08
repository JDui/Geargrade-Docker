from pydantic import BaseModel

from app.core.enums import DeviceCategory, DeviceRating


class CountBucket(BaseModel):
    key: DeviceCategory | DeviceRating
    count: int


class DashboardSummary(BaseModel):
    currently_owned_count: int
    sold_count: int
    ratings: list[CountBucket]
    categories: list[CountBucket]
