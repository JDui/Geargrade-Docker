"""Photo Data API. Reading these endpoints never reads source directories."""
from typing import Any

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.photo_data import service as photos

router = APIRouter(prefix="/photo-data", tags=["photo-data"])


class SourceInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    root_path: str


class ScanInput(BaseModel):
    source_ids: list[str] | None = None
    mode: str = "incremental"
    confirm_large_removal: bool = False


class FilterInput(BaseModel):
    filter: dict[str, Any] | None = None
    limit: int = 100
    offset: int = 0


class FacetInput(BaseModel):
    filter: dict[str, Any] | None = None
    field: str
    limit: int = 100


class LeaderInput(BaseModel):
    filter: dict[str, Any] | None = None
    kind: str = "camera"
    limit: int = 100
    sort_order: str = "desc"


class PresetInput(BaseModel):
    name: str
    filter: dict[str, Any] = Field(default_factory=dict)
    columns: list[str] = Field(default_factory=list)


def call(fn, *args, **kwargs):
    try:
        return fn(*args, **kwargs)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sources")
def sources():
    return photos.get_sources()


@router.post("/sources", status_code=201)
def add_source(payload: SourceInput):
    return call(photos.add_source, payload.model_dump())


@router.delete("/sources/{source_id}")
def delete_source(source_id: str):
    call(photos.delete_source, source_id)
    return {"ok": True}


class MaintenanceInput(BaseModel):
    confirm: bool = False


@router.get("/maintenance/status")
def maintenance_status():
    from app.photo_data.maintenance import status as maintenance_stats
    return call(maintenance_stats)


@router.post("/maintenance/{operation}", status_code=202)
def maintenance_action(operation: str, payload: MaintenanceInput):
    from app.photo_data.maintenance import start as maintenance_start
    return call(maintenance_start, operation, payload.confirm)


@router.get("/status")
def status():
    return photos.status()


@router.post("/scan", status_code=202)
def scan(payload: ScanInput):
    if payload.mode not in ("incremental", "deep"):
        raise HTTPException(status_code=422, detail="扫描模式必须是 incremental 或 deep")
    return {"job_id": call(photos.launch_scan, payload.source_ids,
                           payload.mode == "deep", payload.confirm_large_removal)}


@router.get("/scan/{run_id}")
def scan_status(run_id: str):
    return call(photos.get_scan, run_id)


@router.post("/scan/{run_id}/cancel")
def cancel_scan(run_id: str):
    return call(photos.cancel_scan, run_id)


@router.get("/filter-fields")
def filter_fields():
    return photos.field_registry()


@router.post("/query")
def query(payload: FilterInput):
    return call(photos.query, payload.filter, payload.limit, payload.offset)


@router.post("/facets")
def facets(payload: FacetInput):
    return call(photos.facets, payload.filter, payload.field, payload.limit)


@router.post("/analytics/query")
def analytics_query(payload: FilterInput):
    from app.photo_data.analytics import analyze
    return call(analyze, payload.filter)


@router.get("/summary")
def summary():
    return photos.summary()


@router.post("/stats/query")
def stats_query(payload: FilterInput):
    return call(photos.summary, payload.filter)


@router.get("/leaderboard")
def leaderboard(kind: str = "camera", sort_order: str = "desc",
                limit: int = Query(default=100, ge=1, le=500)):
    return call(photos.leaderboard, kind, None, limit, sort_order == "asc")


@router.post("/leaderboard/query")
def leaderboard_query(payload: LeaderInput):
    return call(photos.leaderboard, payload.kind, payload.filter, payload.limit,
                payload.sort_order == "asc")


@router.get("/filter-presets")
def filter_presets():
    return photos.presets()


@router.post("/filter-presets", status_code=201)
def create_preset(payload: PresetInput):
    return call(photos.save_preset, payload.name, payload.filter, payload.columns)


@router.delete("/filter-presets/{preset_id}")
def delete_preset(preset_id: str):
    photos.remove_preset(preset_id)
    return {"ok": True}


@router.post("/exports")
def export(payload: FilterInput):
    return Response(content=call(photos.export_zip, payload.filter), media_type="application/zip",
                    headers={"Content-Disposition": "attachment; filename=geargrade-photo-data.zip"})
