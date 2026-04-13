from pydantic import BaseModel

from app.core.enums import DeviceCategory, RatingLabel


class CategoryCountBucket(BaseModel):
    key: DeviceCategory
    count: int


class RatingCountBucket(BaseModel):
    key: RatingLabel
    count: int


class PurchaseYearBucket(BaseModel):
    year: int
    count: int


class PurchaseYearCategoryBreakdownBucket(BaseModel):
    year: int
    buckets: list[CategoryCountBucket]


class PurchaseYearRatingBreakdownBucket(BaseModel):
    year: int
    buckets: list[RatingCountBucket]


class DashboardSummary(BaseModel):
    currently_owned_count: int
    sold_count: int
    feeling_in_progress_count: int
    ratings: list[RatingCountBucket]
    categories: list[CategoryCountBucket]
    purchase_years: list[PurchaseYearBucket]
    purchase_year_category_breakdown: list[PurchaseYearCategoryBreakdownBucket]
    purchase_year_rating_breakdown: list[PurchaseYearRatingBreakdownBucket]
