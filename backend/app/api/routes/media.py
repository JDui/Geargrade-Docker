from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.core.config import Settings, get_settings
from app.core.exceptions import MediaCacheError
from app.schemas.media import MediaAsset, RemoteCacheRequest
from app.services.media_service import cache_remote_image, store_upload


router = APIRouter(prefix="/media", tags=["media"])


@router.post("/upload", response_model=MediaAsset, status_code=status.HTTP_201_CREATED)
async def upload_media(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
) -> MediaAsset:
    try:
        return await store_upload(file, settings)
    except MediaCacheError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/cache-remote", response_model=MediaAsset, status_code=status.HTTP_201_CREATED)
async def cache_remote_media(
    payload: RemoteCacheRequest,
    settings: Settings = Depends(get_settings),
) -> MediaAsset:
    try:
        return await cache_remote_image(str(payload.image_url), settings)
    except MediaCacheError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
