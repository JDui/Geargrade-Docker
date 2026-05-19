from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.schemas.device import DeviceCreate
class DataExportResponse(BaseModel):
    schema_version: str = "geargrade.data.v1"
    exported_at: datetime
    item_count: int
    source: str = "geargrade.main_devices"
    items: list[DeviceCreate]


class DataImportRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    items: list[DeviceCreate]

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, value: object) -> object:
        if isinstance(value, list):
            return {"items": value}
        if isinstance(value, dict):
            return value
        raise TypeError("导入文件格式无效，必须是 { items: [...] }、新版导出包，或数组。")


class DataImportError(BaseModel):
    index: int
    name: str | None = None
    reason: str


class DataImportSkippedDetail(BaseModel):
    index: int
    name: str | None = None
    reason: str


class DataImportResponse(BaseModel):
    total: int
    created: int
    skipped: int
    skipped_details: list[DataImportSkippedDetail] = Field(default_factory=list)
    errors: list[DataImportError]


GGPackScope = Literal["devices", "wishlist", "all"]
GGPackTableName = Literal["devices", "wishlist"]
GGPackImportMode = Literal["update"]


class GGPackTable(BaseModel):
    name: GGPackTableName
    columns: list[str]
    rows: list[dict[str, Any]]
    dedup_key: list[str]


class GGPack(BaseModel):
    format: Literal["geargrade.ggpack.v1"] = "geargrade.ggpack.v1"
    schema_version: str = "geargrade.ggpack.v1"
    exported_at: datetime
    tables: list[GGPackTable]
    counts: dict[str, int]


class GGPackRowError(BaseModel):
    table: GGPackTableName
    index: int
    name: str | None = None
    reason: str


class GGPackRowPreview(BaseModel):
    index: int
    name: str | None = None
    action: Literal["create", "update", "skip", "error"]
    selected: bool = True
    reason: str | None = None


class GGPackTablePreview(BaseModel):
    name: GGPackTableName
    total: int
    valid: int
    create: int
    update: int
    skipped: int
    errors: list[GGPackRowError] = Field(default_factory=list)
    rows: list[GGPackRowPreview] = Field(default_factory=list)


class GGPackPreviewResponse(BaseModel):
    format: str = "geargrade.ggpack.v1"
    mode: GGPackImportMode = "update"
    tables: list[GGPackTablePreview]


class GGPackImportRequest(BaseModel):
    package: GGPack
    mode: GGPackImportMode = "update"
    selection: dict[GGPackTableName, list[int]] | None = None

    @model_validator(mode="before")
    @classmethod
    def normalize_payload(cls, value: object) -> object:
        if isinstance(value, dict) and "package" in value:
            return value
        if isinstance(value, dict):
            return {"package": value}
        return value


class GGPackImportResponse(BaseModel):
    total: int
    created: int
    updated: int
    skipped: int
    errors: list[GGPackRowError] = Field(default_factory=list)


class DataResetResponse(BaseModel):
    devices_deleted: int
    wishlist_deleted: int
    media_files_deleted: int
