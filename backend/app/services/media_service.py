from pathlib import Path
from uuid import uuid4

import httpx
from fastapi import UploadFile

from app.core.config import Settings
from app.core.enums import ImageSourceType
from app.core.exceptions import MediaCacheError
from app.schemas.media import MediaAsset


IMAGE_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _build_media_response(
    settings: Settings,
    source_type: ImageSourceType,
    storage_path: str,
    storage_name: str,
    original_url: str | None = None,
) -> MediaAsset:
    normalized_path = storage_path.replace("\\", "/")
    return MediaAsset(
        source_type=source_type,
        original_url=original_url,
        storage_path=storage_path,
        storage_name=storage_name,
        url=f"{settings.media_url_prefix.rstrip('/')}/{normalized_path}",
    )


def _safe_suffix(content_type: str | None, fallback_name: str = "") -> str:
    if content_type and content_type in IMAGE_SUFFIXES:
        return IMAGE_SUFFIXES[content_type]
    guessed = Path(fallback_name).suffix.lower()
    if guessed in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        return ".jpg" if guessed == ".jpeg" else guessed
    return ".bin"


def _write_bytes(target_path: Path, payload: bytes) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    target_path.write_bytes(payload)


async def store_upload(upload: UploadFile, settings: Settings) -> MediaAsset:
    suffix = _safe_suffix(upload.content_type, upload.filename or "")
    if suffix == ".bin":
        raise MediaCacheError("Only image uploads are supported.")

    filename = f"{uuid4().hex}{suffix}"
    storage_path = f"uploads/{filename}"
    payload = await upload.read()
    _write_bytes(settings.media_root / storage_path, payload)
    return _build_media_response(settings, ImageSourceType.UPLOAD, storage_path, filename)


async def cache_remote_image(image_url: str, settings: Settings) -> MediaAsset:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            response = await client.get(image_url)
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise MediaCacheError(f"Failed to fetch remote image: {exc}") from exc

    content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
    if not content_type.startswith("image/"):
        raise MediaCacheError("Remote URL did not return an image.")

    suffix = _safe_suffix(content_type, image_url)
    if suffix == ".bin":
        raise MediaCacheError("Unsupported remote image format.")

    filename = f"{uuid4().hex}{suffix}"
    storage_path = f"remote-cache/{filename}"
    _write_bytes(settings.media_root / storage_path, response.content)
    return _build_media_response(settings, ImageSourceType.CACHED_REMOTE, storage_path, filename, image_url)
