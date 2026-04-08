from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import bootstrap, dashboard, devices, media
from app.core.config import get_settings
from app.db.init_db import init_db, seed_if_needed
from app.db.session import SessionLocal


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    init_db()
    with SessionLocal() as session:
        seed_if_needed(session, enabled=settings.seed_sample_data)
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(settings.media_url_prefix, StaticFiles(directory=settings.media_root), name="media")

app.include_router(devices.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(media.router, prefix=settings.api_v1_prefix)
app.include_router(bootstrap.router, prefix=settings.api_v1_prefix)


@app.get(f"{settings.api_v1_prefix}/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
