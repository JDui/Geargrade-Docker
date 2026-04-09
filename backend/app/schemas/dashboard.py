from pydantic import BaseModel

from app.core.enums import DeviceCategory, RatingLabel


class CountBucket(BaseModel):
    key: DeviceCategory | RatingLabel
    count: int


class PurchaseYearBucket(BaseModel):
    year: int
    count: int


class DashboardSummary(BaseModel):
    currently_owned_count: int
    sold_count: int
    feeling_in_progress_count: int
    ratings: list[CountBucket]
    categories: list[CountBucket]
    purchase_years: list[PurchaseYearBucket]
