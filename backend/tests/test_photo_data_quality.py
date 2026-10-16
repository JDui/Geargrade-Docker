"""Realistic legacy-index regressions; no source photos or NAS access required."""
import io
import csv
import json
import os
import zipfile

import pytest

from app.photo_data import db, service
from app.photo_data.analytics import analyze


@pytest.fixture
def quality_index(tmp_path, monkeypatch):
    monkeypatch.setenv("PHOTO_DATA_DB_PATH", str(tmp_path / "index.db"))
    monkeypatch.setenv("PHOTO_DATA_ALLOWED_ROOTS", str(tmp_path))
    db.initialize()
    sid = service.add_source({"name": "Quality fixture", "root_path": str(tmp_path / "photos")})["id"]

    def insert(filename, **overrides):
        item = service.metadata({
            "Make": "SONY", "Model": "ILCE-7M4", "LensModel": "FE 35mm F1.8",
            "DateTimeOriginal": "2025:03:17 12:00:00", "ISO": 100,
            "FNumber": 2.8, "ExposureTime": 0.004, "FocalLength": 35,
            "ImageWidth": 6000, "ImageHeight": 4000, "ExposureCompensation": 0,
        }, filename, 100, 1, sid)
        item.update(overrides)
        with db.connect() as connection:
            connection.execute(
                "INSERT INTO photos (" + ",".join(service.COLUMNS) + ") VALUES (" +
                ",".join("?" for _ in service.COLUMNS) + ")",
                [item[column] for column in service.COLUMNS],
            )
        return item

    return insert


def missing(field):
    return {"version": "photo-filter.v1", "group": {"field": field, "op": "is_missing"}}


def test_legacy_sentinels_and_invalid_numbers_agree_across_reads(quality_index, monkeypatch):
    quality_index("valid.arw")
    original = quality_index("legacy.arw", lens_norm=" ---- ", camera_norm=" ", shot_at=None,
                             iso=0, aperture=-1, shutter=0, focal_mm=0, height_px=0)

    def forbidden(*args, **kwargs):
        raise AssertionError("index reads must not inspect source directories")
    monkeypatch.setattr(os, "scandir", forbidden)

    result = analyze()
    assert result["overview"]["captures"] == 2
    assert result["overview"]["dated"] == 1
    assert result["overview"]["lens_known"] == 1
    assert result["overview"]["camera_known"] == 1
    coverage = {row["name"]: row["count"] for row in result["quality"]}
    assert all(coverage[name] == 1 for name in ("ISO", "光圈", "快门", "焦距", "分辨率"))
    assert coverage["曝光补偿"] == 2  # Zero EV is a valid measurement.
    for name in ("iso", "aperture", "shutter", "focal"):
        assert sum(row["count"] for row in result["exposure"][name]) == 1
        assert sum(row["count"] for row in result["exposure"]["distributions"][name]) == 1
    assert sum(row["count"] for row in result["exposure"]["focal_coverage"]) == 2

    for field in ("lens.model_norm", "camera.model_norm", "exposure.iso", "exposure.aperture",
                  "exposure.shutter", "exposure.focal_mm", "files.height_px", "capture.date"):
        condition = missing(field)
        assert service.query(condition)["total_files"] == 1
        assert service.summary(condition)["logical_captures"] == 1
        assert analyze(condition)["overview"]["captures"] == 1
        assert {row["value"]: row["count"] for row in service.facets(None, field)["options"]}[None] == 1
    assert service.leaderboard("lens")["unknown_captures"] == 1
    assert service.query(missing("lens.model_norm"))["items"][0]["lens_norm"] is None

    archive = service.export_zip(missing("exposure.aperture"))
    with zipfile.ZipFile(io.BytesIO(archive)) as exported:
        records = [json.loads(line) for filename in exported.namelist() if filename.endswith(".jsonl")
                   for line in exported.read(filename).decode().splitlines()]
    assert len(records) == 1 and records[0]["aperture"] is None
    with db.connect() as connection:
        stored = dict(connection.execute("SELECT * FROM photos WHERE filename='legacy.arw'").fetchone())
        assert stored["lens_norm"] == original["lens_norm"]
        assert stored["aperture"] == -1 and stored["height_px"] == 0


def test_top_categories_retain_unknowns_and_reconcile_to_population(quality_index):
    for i in range(21):
        quality_index(f"body-{i:02}.arw", camera_norm=f"body-{i:02}",
                      lens_norm=f"lens-{i:02}", camera_make=f"brand-{i:02}", software=f"app-{i:02}")
    quality_index("unknown.arw", camera_norm=None, lens_norm=None, camera_make=None)
    result = analyze()
    for items in (result["gear"]["cameras"], result["gear"]["lenses"],
                  result["gear"]["makers"], result["files"]["software"]):
        assert sum(row["count"] for row in items) == 22
        assert next(row["count"] for row in items if row["name"] == "未记录") == 1
        assert next(row["count"] for row in items if row.get("is_other")) > 0
    cameras = result["gear"]["cameras"]
    assert len([row for row in cameras if row["name"] != "未记录" and not row.get("is_other")]) == 16
    assert next(row["count"] for row in cameras if row.get("is_other")) == 5


def test_capture_prefers_complete_metadata_over_raw_format(quality_index):
    quality_index("paired.arw", iso=None, aperture=None, height_px=None)
    quality_index("paired.jpg")
    result = analyze()
    assert result["overview"]["captures"] == 1
    assert result["overview"]["raw_captures"] == 1
    assert result["overview"]["paired_captures"] == 1
    assert result["files"]["capture_formats"] == [{"name": "jpeg", "count": 1}]
    assert next(row["count"] for row in result["quality"] if row["name"] == "ISO") == 1


def test_empty_index_returns_zero_counts(quality_index):
    result = analyze()
    for key in ("captures", "files", "dated", "camera_known", "lens_known", "raw_files", "failed_files"):
        assert result["overview"][key] == 0
    assert service.summary()["raw_files"] == 0


def test_metadata_rejects_invalid_values_and_uses_valid_date_fallback():
    item = service.metadata({
        "Make": "Sony", "Model": " ", "LensModel": "----", "ISO": 0,
        "FNumber": -2, "ExposureTime": 0, "FocalLength": 0,
        "ExposureCompensation": 0, "ExifImageWidth": -1, "ImageWidth": 6000,
        "SubSecDateTimeOriginal": "invalid", "DateTimeOriginal": "2025:03:17 12:00:00",
    }, "sample.arw", 100, 1, "source")
    assert item["shot_at"] == "2025-03-17T12:00:00"
    assert item["camera_norm"] is None and item["lens_norm"] is None
    assert all(item[field] is None for field in ("iso", "aperture", "shutter", "focal_mm"))
    assert item["exposure_comp"] == 0 and item["width_px"] == 6000


def test_statistics_export_matches_filtered_charts_without_pagination(quality_index, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.photo_data import router
    from app.photo_data import statistics_export

    quality_index("selected-pair.arw", camera_make="中文品牌", exposure_comp=-1 / 3)
    quality_index("selected-pair.jpg", camera_make="中文品牌", exposure_comp=-1 / 3)
    quality_index("selected-single.arw", camera_make="中文品牌", exposure_comp=-1 / 3)
    quality_index("excluded.arw")
    condition = {"version": "photo-filter.v1", "group": {"op": "and", "children": [
        {"field": "exposure.iso", "op": "gte", "value": 100},
        {"field": "files.relpath", "op": "contains", "value": "selected"},
    ]}}
    expected = analyze(condition)
    aggregation_calls = []

    def aggregate(filter_ast):
        aggregation_calls.append(filter_ast)
        return analyze(filter_ast)

    def forbidden(*args, **kwargs):
        raise AssertionError("statistics export must not read source directories")

    monkeypatch.setattr(statistics_export, "analyze", aggregate)
    monkeypatch.setattr(os, "scandir", forbidden)
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.post("/photo-data/exports/statistics", json={
            "filter": condition, "limit": 1, "offset": 100,
        })
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "geargrade-photo-statistics.zip" in response.headers["content-disposition"]
    assert aggregation_calls == [condition]
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        statistics = json.loads(archive.read("analytics.json"))
        manifest = json.loads(archive.read("manifest.json"))
        assert json.loads(archive.read("filter.json")) == condition == manifest["filter"]
        assert manifest["as_of"] == expected["as_of"]
        assert manifest["exported_at"] and not manifest["gps_included"]
        assert statistics["overview"] == expected["overview"]
        assert statistics["overview"]["files"] == 3
        assert statistics["overview"]["captures"] == 2
        assert statistics["overview"]["paired_captures"] == 1
        for section in ("timeline", "gear", "quality"):
            assert statistics[section] == expected[section]
        assert set(statistics["exposure"]) == {
            "distributions", "focal_coverage", "iso_shutter", "focal_aperture",
        }
        assert set(statistics["files"]) == set(expected["files"]) - {"orientation", "color_space"}
        assert statistics["exposure"]["distributions"] == expected["exposure"]["distributions"]
        for table in manifest["tables"]:
            encoded = archive.read(table["file"])
            assert encoded.startswith(b"\xef\xbb\xbf")
            reader = csv.DictReader(io.StringIO(encoded.decode("utf-8-sig")))
            assert reader.fieldnames == table["columns"]
            assert len(list(reader)) == table["rows"]
        assert "中文品牌" in archive.read("gear/makers.csv").decode("utf-8-sig")
        assert not any(name.endswith((".arw", ".jpg", ".jsonl")) for name in archive.namelist())


def test_statistics_export_preserves_top_n_unknowns_and_safe_csv(quality_index):
    from app.photo_data.statistics_export import export_statistics

    for i in range(21):
        quality_index(f"shot-{i}.arw", camera_norm=f"camera-{i}", camera_make="=1+1",
                      exposure_comp=-1 / 3)
    quality_index("unknown.arw", camera_norm=None)
    with zipfile.ZipFile(io.BytesIO(export_statistics())) as archive:
        statistics = json.loads(archive.read("analytics.json"))
        cameras = statistics["gear"]["cameras"]
        assert sum(row["count"] for row in cameras) == 22
        assert next(row["count"] for row in cameras if row.get("is_other")) == 5
        assert next(row["count"] for row in cameras if row["name"] == "未记录") == 1
        assert any(row["name"] == "=1+1" for row in statistics["gear"]["makers"])
        brands = list(csv.DictReader(io.StringIO(archive.read("gear/makers.csv").decode("utf-8-sig"))))
        assert any(row["name"] == "'=1+1" for row in brands)
        ev = list(csv.DictReader(io.StringIO(archive.read("exposure/distributions/ev.csv").decode("utf-8-sig"))))
        assert float(ev[0]["value"]) == pytest.approx(-1 / 3)


def test_statistics_export_empty_filter_and_invalid_filter(quality_index):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.photo_data import router

    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.post("/photo-data/exports/statistics", json={})
        assert response.status_code == 200
        invalid = client.post("/photo-data/exports/statistics", json={"filter": {
            "version": "photo-filter.v1", "group": {"field": "invalid", "op": "eq", "value": 1},
        }})
        assert invalid.status_code == 422
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        assert json.loads(archive.read("analytics.json"))["overview"]["captures"] == 0
        assert json.loads(archive.read("filter.json"))["group"]["children"] == []
        assert archive.read("gear/cameras.csv").decode("utf-8-sig").strip() == "name,count,is_other"
