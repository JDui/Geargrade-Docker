from pydantic import BaseModel, HttpUrl

from app.core.enums import ImageSourceType


class MediaAsset(BaseModel):
    source_type: ImageSourceType
    original_url: str | None = None
    storage_path: str
    storage_name: str
    url: str


class RemoteCacheRequest(BaseModel):
    image_url: HttpUrl
