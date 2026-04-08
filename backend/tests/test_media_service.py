import asyncio
from httpx import HTTPError

from app.core.config import Settings
from app.core.exceptions import MediaCacheError
from app.services import media_service


class DummyClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, *_args, **_kwargs):
        raise HTTPError("boom")


def test_remote_cache_failure(monkeypatch, tmp_path):
    monkeypatch.setattr(media_service.httpx, "AsyncClient", lambda **_kwargs: DummyClient())
    settings = Settings(media_root=tmp_path)

    try:
        asyncio.run(media_service.cache_remote_image("https://example.com/image.jpg", settings))
    except MediaCacheError:
        return

    raise AssertionError("Expected MediaCacheError to be raised.")
