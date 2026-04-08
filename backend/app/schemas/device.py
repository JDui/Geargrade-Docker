from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import DeviceCategory, DeviceRating, DeviceStatus, ImageSourceType


SortBy = Literal[
    "purchase_date",
    "sale_date",
    "purchase_price",
    "sale_price",
    "rating",
    "updated_at",
    "created_at",
]
SortOrder = Literal["asc", "desc"]


def _normalize_string_list(value: object) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.splitlines() if item.strip()]
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    raise ValueError("Expected a list of strings.")


class DeviceBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str = Field(min_length=1, max_length=255)
    category: DeviceCategory
    mount_system: str | None = Field(default=None, max_length=255)
    status: DeviceStatus
    rating: DeviceRating
    summary: str = Field(min_length=1, max_length=500)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    review_detail: str = ""
    tags: list[str] = Field(default_factory=list)
    purchase_price: float | None = None
    sale_price: float | None = None
    purchase_date: date | None = None
    sale_date: date | None = None
    is_currently_owned: bool | None = None
    image_source_type: ImageSourceType | None = None
    image_original_url: str | None = None
    image_storage_path: str | None = None
    image_storage_name: str | None = None

    @field_validator("tags", "pros", "cons", mode="before")
    @classmethod
    def normalize_lists(cls, value: object) -> list[str]:
        return _normalize_string_list(value)


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, min_length=1, max_length=255)
    category: DeviceCategory | None = None
    mount_system: str | None = Field(default=None, max_length=255)
    status: DeviceStatus | None = None
    rating: DeviceRating | None = None
    summary: str | None = Field(default=None, min_length=1, max_length=500)
    pros: list[str] | None = None
    cons: list[str] | None = None
    review_detail: str | None = None
    tags: list[str] | None = None
    purchase_price: float | None = None
    sale_price: float | None = None
    purchase_date: date | None = None
    sale_date: date | None = None
    is_currently_owned: bool | None = None
    image_source_type: ImageSourceType | None = None
    image_original_url: str | None = None
    image_storage_path: str | None = None
    image_storage_name: str | None = None

    @field_validator("tags", "pros", "cons", mode="before")
    @classmethod
    def normalize_lists(cls, value: object) -> list[str] | None:
        if value is None:
            return None
        return _normalize_string_list(value)


class DeviceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    brand: str
    category: DeviceCategory
    mount_system: str | None
    status: DeviceStatus
    rating: DeviceRating
    summary: str
    tags: list[str]
    purchase_price: float | None
    sale_price: float | None
    purchase_date: date | None
    sale_date: date | None
    is_currently_owned: bool
    image_source_type: ImageSourceType | None
    image_original_url: str | None
    image_storage_path: str | None
    image_storage_name: str | None
    image_url: str | None
    created_at: datetime
    updated_at: datetime


class DeviceDetail(DeviceListItem):
    pros: list[str]
    cons: list[str]
    review_detail: str


class DeviceListResponse(BaseModel):
    items: list[DeviceListItem]
    total: int
