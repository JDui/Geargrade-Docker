from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import DeviceCategory, ImageSourceType, MountSystemKey, RatingLabel
from app.schemas.device import _normalize_string_list


WishlistSortBy = Literal["name", "brand", "category", "score", "updated_at", "created_at"]
WishlistSortOrder = Literal["asc", "desc"]


class WishlistDeviceBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    brand: str = Field(min_length=1, max_length=255)
    category: DeviceCategory
    mount_system_key: MountSystemKey | None = None
    mount_system_custom: str | None = Field(default=None, max_length=255)
    score: int = Field(ge=-1)
    acquisition_iteration: int = Field(default=1, ge=1)
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)
    review_detail: str = ""
    tags: list[str] = Field(default_factory=list)
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


class WishlistDeviceCreate(WishlistDeviceBase):
    pass


class WishlistDeviceUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, min_length=1, max_length=255)
    category: DeviceCategory | None = None
    mount_system_key: MountSystemKey | None = None
    mount_system_custom: str | None = Field(default=None, max_length=255)
    score: int | None = Field(default=None, ge=-1)
    acquisition_iteration: int | None = Field(default=None, ge=1)
    pros: list[str] | None = None
    cons: list[str] | None = None
    review_detail: str | None = None
    tags: list[str] | None = None
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


class WishlistDeviceListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    brand: str
    category: DeviceCategory
    mount_system_key: MountSystemKey | None
    mount_system_custom: str | None
    mount_system_label: str | None
    score: int
    rating_label: RatingLabel | None
    acquisition_iteration: int
    tags: list[str]
    image_source_type: ImageSourceType | None
    image_original_url: str | None
    image_storage_path: str | None
    image_storage_name: str | None
    image_url: str | None
    created_at: datetime
    updated_at: datetime


class WishlistDeviceDetail(WishlistDeviceListItem):
    pros: list[str]
    cons: list[str]
    review_detail: str


class WishlistDeviceListResponse(BaseModel):
    items: list[WishlistDeviceListItem]
    total: int


class WishlistRedeemRequest(BaseModel):
    purchase_price: float = Field(gt=0)
    purchase_date: date
    name: str | None = Field(default=None, min_length=1, max_length=255)
    brand: str | None = Field(default=None, min_length=1, max_length=255)
    category: DeviceCategory | None = None
    mount_system_key: MountSystemKey | None = None
    mount_system_custom: str | None = Field(default=None, max_length=255)
    score: int | None = Field(default=None, ge=-1)
    acquisition_iteration: int | None = Field(default=None, ge=1)
    pros: list[str] | None = None
    cons: list[str] | None = None
    review_detail: str | None = None
    tags: list[str] | None = None
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
