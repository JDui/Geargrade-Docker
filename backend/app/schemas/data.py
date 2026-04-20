from pydantic import BaseModel

from app.schemas.device import DeviceCreate


class DataExportResponse(BaseModel):
    items: list[DeviceCreate]


class DataImportRequest(BaseModel):
    items: list[DeviceCreate]


class DataImportError(BaseModel):
    index: int
    name: str | None = None
    reason: str


class DataImportResponse(BaseModel):
    total: int
    created: int
    skipped: int
    errors: list[DataImportError]


class DataResetResponse(BaseModel):
    devices_deleted: int
    wishlist_deleted: int
    media_files_deleted: int
