from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import DeviceCategory, DeviceStatus, ImageSourceType, MountSystemKey, RatingLabel


SortBy = Literal[
    "name",
    "category",
    "status",
    "purchase_date",
    "sale_date",
    "purchase_price",
    "sale_price",
    "score",
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
    mount_system_key: MountSystemKey | None = None
    mount_system_custom: str | None = Field(default=None, max_length=255)
    status: DeviceStatus
    score: int = Field(ge=-1)
    acquisition_iteration: int = Field(default=1, ge=1)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    review_detail: str = ""
    tags: list[str] = Field(default_factory=list)
    purchase_price: float | None = None
    sale_price: float | None = None
    purchase_date: date | None = None
    sale_date: date | None = None
    image_source_type: ImageSourceType | None = None
    image_original_url: str | None = None
    image_storage_path: str | None = None
    image_storage_name: str | None = None

    @field_validator("tags", "pros", "cons", mode="before")
    @classmethod
    def normalize_lists(cls, value: object) -> list[str]:
        return _normalize_string_list(value)

    @field_validator(
        "mount_system_custom",
        "review_detail",
        "image_original_url",
        "image_storage_path",
        "image_storage_name",
        mode="before",
    )
    @classmethod
    def normalize_optional_strings(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value


class DeviceCreate(DeviceBase):
    pass


class DeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, min_length=1, max_length=255)
    category: DeviceCategory | None = None
    mount_system_key: MountSystemKey | None = None
    mount_system_custom: str | None = Field(default=None, max_length=255)
    status: DeviceStatus | None = None
    score: int | None = Field(default=None, ge=-1)
    acquisition_iteration: int | None = Field(default=None, ge=1)
    pros: list[str] | None = None
    cons: list[str] | None = None
    review_detail: str | None = None
    tags: list[str] | None = None
    purchase_price: float | None = None
    sale_price: float | None = None
    purchase_date: date | None = None
    sale_date: date | None = None
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
    mount_system_key: MountSystemKey | None
    mount_system_custom: str | None
    mount_system_label: str | None
    status: DeviceStatus
    score: int
    rating_label: RatingLabel | None
    acquisition_iteration: int
    tags: list[str]
    purchase_price: float | None
    sale_price: float | None
    purchase_date: date | None
    sale_date: date | None
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
