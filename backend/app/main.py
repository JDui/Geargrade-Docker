from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes import bootstrap, dashboard, data, devices, leaderboards, media, wishlist
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
frontend_dist = Path(__file__).resolve().parent.parent / "frontend_dist"
templates_dir = Path(__file__).resolve().parent.parent / "templates"
if not templates_dir.exists():
    templates_dir = Path(__file__).resolve().parent.parent.parent / "templates"
app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(settings.media_url_prefix, StaticFiles(directory=settings.media_root), name="media")
if templates_dir.exists():
    app.mount("/templates", StaticFiles(directory=templates_dir), name="templates")

app.include_router(devices.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(media.router, prefix=settings.api_v1_prefix)
app.include_router(bootstrap.router, prefix=settings.api_v1_prefix)
app.include_router(leaderboards.router, prefix=settings.api_v1_prefix)
app.include_router(data.router, prefix=settings.api_v1_prefix)
app.include_router(wishlist.router, prefix=settings.api_v1_prefix)


@app.get(f"{settings.api_v1_prefix}/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


if frontend_dist.exists():
    assets_dir = frontend_dist / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    def serve_index() -> FileResponse:
        return FileResponse(frontend_dist / "index.html")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str) -> FileResponse:
        if full_path.startswith(("api/", "media/", "assets/")):
            raise HTTPException(status_code=404, detail="Not found.")
        candidate = frontend_dist / full_path
        if candidate.exists() and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(frontend_dist / "index.html")
