"""Manual photo scanner: concurrency, deduplication, corrupt RAW and offline protection."""
import os
import time
from pathlib import Path

import pytest
from app.photo_data import db, scanner, service


@pytest.fixture
def photo_env(tmp_path, monkeypatch):
    monkeypatch.setenv("PHOTO_DATA_DB_PATH", str(tmp_path / "index.db"))
    monkeypatch.setenv("PHOTO_DATA_ALLOWED_ROOTS", str(tmp_path))
    monkeypatch.setattr(scanner.shutil, "which", lambda _: "/usr/bin/exiftool")
    db.initialize()
    root = tmp_path / "photos"
    root.mkdir()
    return root


def fake_exif(paths):
    return [{
        "DateTimeOriginal": "2025:01:02 03:04:05", "Make": "SONY",
        "Model": "ILCE-7M4", "LensModel": "Tamron 28-200mm",
        "FNumber": 4.0, "ISO": 1600, "ExposureTime": 0.004,
        "FocalLength": 50, "GPSLatitude": 35.0,
    } for _ in paths]


def complete(job_id):
    end = time.monotonic() + 15
    while time.monotonic() < end:
        info = service.get_scan(job_id)
        if info["status"] not in ("queued", "running"):
            return info
        time.sleep(0.05)
    pytest.fail("photo scan did not terminate")


def test_plan_local_network_and_low_cpu():
    remote = scanner.choose_scan_plan(
        "/mnt/nas/2025", cpu_count=16,
        mounts_text="server:/pictures /mnt/nas nfs4 rw 0 0\n",
    )
    assert remote.remote and remote.initial_workers == 2
    assert remote.max_workers == 4 and remote.batch_size == 24
    local = scanner.choose_scan_plan(
        "/data/photos", cpu_count=16,
        mounts_text="/dev/nvme0n1 /data ext4 rw 0 0\n",
    )
    assert not local.remote and local.initial_workers == 3
    assert local.max_workers == 8
    assert scanner.choose_scan_plan("/x",cpu_count=1,mounts_text="").max_workers == 1


def test_source_configuration_and_index_reads_do_not_open_original_files(photo_env, monkeypatch):
    service.add_source({"name": "Archive", "root_path": str(photo_env)})
    def forbidden(*args, **kwargs):
        raise AssertionError("source touched outside manual scan")
    monkeypatch.setattr(os,"scandir",forbidden)
    assert len(service.get_sources()) == 1
    assert service.status()["last_success"] is None
    assert service.query()["total_files"] == 0
    assert service.summary()["physical_files"] == 0
    assert service.facets(None,"camera.model_norm")["options"] == []


def test_full_incremental_delete_and_offline(photo_env, monkeypatch):
    monkeypatch.setattr(service,"extract_batch",fake_exif)
    for name in ("a.arw","a.jpg","b.orf"):
        (photo_env/name).write_bytes(b"test fixture")
    source_id = service.add_source({"name":"Archive","root_path":str(photo_env)})["id"]
    first = complete(service.launch_scan([source_id]))
    assert first["status"] == "completed", first["error"]
    assert first["seen"] == 3 and first["extracted"] == 3
    assert first["processed"] == 3 and first["enumeration_done"] == 1
    assert service.summary()["physical_files"] == 3
    assert service.summary()["logical_captures"] == 2
    assert service.leaderboard()["items"][0]["capture_count"] == 2
    second = complete(service.launch_scan([source_id]))
    assert second["status"] == "completed", second["error"]
    assert second["extracted"] == 0 and second["unchanged"] == 3
    (photo_env/"a.jpg").unlink()
    third = complete(service.launch_scan([source_id]))
    assert third["status"] == "completed", third["error"]
    assert third["removed"] == 1
    assert service.summary()["physical_files"] == 2
    photo_env.rename(photo_env.with_name("offline"))
    failed = complete(service.launch_scan([source_id]))
    assert failed["status"] == "failed"
    assert service.summary()["physical_files"] == 2


def test_corrupted_raw_is_isolated_and_gps_is_stripped(photo_env,monkeypatch):
    (photo_env/"normal.arw").write_bytes(b"valid")
    (photo_env/"broken.nef").write_bytes(b"bad")
    def extractor(paths):
        if any(Path(path).name == "broken.nef" for path in paths):
            raise RuntimeError("Bad RAW")
        return fake_exif(paths)
    monkeypatch.setattr(service,"extract_batch",extractor)
    sid=service.add_source({"name":"Photos","root_path":str(photo_env)})["id"]
    run=complete(service.launch_scan([sid]))
    assert run["status"] == "completed",run["error"]
    assert run["failed"] == 1 and run["extracted"] == 1
    assert service.query()["total_files"] == 2
    with db.connect() as conn:
        result=conn.execute("SELECT tags_json,parse_status FROM photos").fetchall()
    assert sorted(row["parse_status"] for row in result) == ["error","ok"]
    assert all("GPS" not in row["tags_json"] for row in result)


def test_nested_filter_and_injection_guard(photo_env,monkeypatch):
    monkeypatch.setattr(service,"extract_batch",fake_exif)
    (photo_env/"one.arw").write_bytes(b"x")
    sid=service.add_source({"name":"Photos","root_path":str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"] == "completed"
    ast={"version":"photo-filter.v1","group":{"op":"and","children":[
        {"op":"or","children":[
            {"field":"exposure.iso","op":"gte","value":1600},
            {"field":"camera.make","op":"eq","value":"Other"}
        ]},
        {"op":"not","children":[{"field":"lens.model_norm","op":"is_missing"}]}
    ]}}
    assert service.query(ast)["total_files"] == 1
    with pytest.raises(ValueError):
        service.compile_filter({"group":{"field":"hack;DROP TABLE photos","op":"eq","value":"x"}})


def test_split_failed_batch():
    original=service.extract_batch
    def extractor(paths):
        if "bad" in paths: raise RuntimeError("Bad metadata")
        return [{"Model":"test"} for _ in paths]
    try:
        service.extract_batch=extractor
        result=scanner._extract_safely(["good1","bad","good2"])
        assert "tags" in result[0] and "error" in result[1] and "tags" in result[2]
    finally:
        service.extract_batch=original


def test_ten_thousand_files_adaptive_parallel_index(photo_env, monkeypatch):
    """Stress smoke test for 10k indexed photos (mock EXIF, not RAW decode speed)."""
    import threading

    for index in range(10000):
        (photo_env / f"photo_{index:05d}.arw").write_bytes(b"raw")

    state = {"running": 0, "max_running": 0, "calls": 0}
    lock = threading.Lock()

    def timed_exif(paths):
        with lock:
            state["running"] += 1
            state["calls"] += 1
            state["max_running"] = max(state["max_running"], state["running"])
        try:
            time.sleep(0.025)
            return fake_exif(paths)
        finally:
            with lock:
                state["running"] -= 1

    monkeypatch.setattr(service, "extract_batch", timed_exif)
    monkeypatch.setattr(
        scanner, "choose_scan_plan",
        lambda root: scanner.ScanPlan("ext4", False, 4, 2, 48),
    )
    sid = service.add_source({"name": "Large photo archive", "root_path": str(photo_env)})["id"]

    job_id = service.launch_scan([sid])
    deadline = time.monotonic() + 100
    while time.monotonic() < deadline:
        current = service.get_scan(job_id)
        if current["status"] not in ("queued", "running"):
            break
        time.sleep(0.1)
    else:
        pytest.fail("10k index did not finish in a reasonable synthetic test time")
    assert current["status"] == "completed", current["error"]
    assert current["seen"] == 10000
    assert current["processed"] == 10000
    assert current["extracted"] == 10000
    assert 2 <= state["max_running"] <= 4
    assert service.summary()["logical_captures"] == 10000
    assert service.summary()["physical_files"] == 10000

    second = complete(service.launch_scan([sid]))
    assert second["status"] == "completed", second["error"]
    assert second["seen"] == 10000
    assert second["unchanged"] == 10000
    assert second["extracted"] == 0

    # Aggregation also runs server-side over all 10,000 logical captures.
    # These are synthetic files with mocked EXIF, not actual RAW benchmarks.
    from app.photo_data.analytics import analyze
    analytics = analyze()
    assert analytics["overview"]["captures"] == 10000
    assert analytics["overview"]["files"] == 10000
    assert sum(item["count"] for item in analytics["exposure"]["iso"]) == 10000
    assert sum(item["count"] for item in analytics["timeline"]["yearly"]) == 10000
    assert sum(item["count"] for item in analytics["gear"]["cameras"]) == 10000


def test_analytics_all_views_and_physical_vs_capture(photo_env, monkeypatch):
    """Every analytics view uses the published index and correct count denominators."""
    from app.photo_data.analytics import analyze

    for name in ("a.arw", "a.jpg", "b.raf", "c.heic"):
        (photo_env / name).write_bytes(b"image")

    def tags(paths):
        out = []
        for path in paths:
            name = Path(path).name
            common = {
                "DateTimeOriginal": "2025:03:17 14:20:00",
                "Make": "SONY", "Model": "ILCE-7M4",
                "LensModel": "FE 35mm F1.8",
                "ISO": 1600, "ExposureTime": 0.004, "FNumber": 2.0,
                "FocalLength": 35, "ImageWidth": 6000, "ImageHeight": 4000,
                "Flash": "Off",
                "GPSLongitude": 121.5,
            }
            if name.startswith("b"):
                common.update(DateTimeOriginal="2024:10:09 20:00:00",
                              ISO=400, LensModel="Tamron 28-200mm", FocalLength=200)
            elif name.startswith("c"):
                common = {"DateTimeOriginal": "2025:03:18 09:00:00",
                          "ImageWidth": 4000, "ImageHeight": 6000}
            out.append(common)
        return out

    monkeypatch.setattr(service, "extract_batch", tags)
    sid = service.add_source({"name": "Analytics sample", "root_path": str(photo_env)})["id"]
    result = complete(service.launch_scan([sid]))
    assert result["status"] == "completed", result["error"]

    details = analyze()
    assert details["overview"]["files"] == 4
    assert details["overview"]["captures"] == 3
    assert details["overview"]["raw_files"] == 2
    assert details["overview"]["raw_captures"] == 2
    assert details["overview"]["paired_captures"] == 1
    assert sum(x["count"] for x in details["files"]["formats"]) == 4
    assert sum(x["count"] for x in details["files"]["capture_formats"]) == 3
    assert sum(x["count"] for x in details["timeline"]["yearly"]) == 3
    assert sum(x["count"] for x in details["timeline"]["weekday_hour"]) == 3
    assert sum(x["count"] for x in details["exposure"]["iso"]) == 2
    assert sum(x["count"] for x in details["exposure"]["iso_shutter"]) == 2
    assert sum(x["count"] for x in details["exposure"]["focal_aperture"]) == 2
    assert sum(x["count"] for x in details["files"]["orientation"]) == 3
    assert details["quality"][0]["count"] == 3
    assert next(x for x in details["quality"] if x["name"] == "镜头")["count"] == 2
    assert "GPS" not in str(details)


def test_numeric_distributions_preserve_values_merge_drift_and_filter_counts(photo_env):
    from app.photo_data.analytics import analyze

    sid = service.add_source({"name": "Value distributions", "root_path": str(photo_env)})["id"]
    samples = [
        ("a", "raw", 100, 2.799999, 0.00400004, 24, -0.333333),
        ("a", "jpeg", 100, 2.799999, 0.00400004, 24, -0.333333),
        ("b", "raw", 125, 2.8, 0.004, 24.5, -0.33),
        ("c", "raw", 160, 2.828427, 0.004, 35, 0.4999),
        ("d", "raw", 200, 3.200000049, 0.005, 50, 0.5),
        ("e", "raw", 200, 3.5, 0.00500004, 85, 0.666667),
        ("f", "raw", 6400, 2.4, 0.1, 200, 0.67),
        ("g", "raw", None, None, None, None, None),
        ("h", "raw", 0, 0, 0, 0, 0),
    ]
    with db.connect() as connection:
        for key, family, iso, aperture, shutter, focal, ev in samples:
            filename = key + (".arw" if family == "raw" else ".jpg")
            connection.execute("""
                INSERT INTO photos (source_id,relpath,filename,ext,format_family,size_bytes,
                    mtime_ns,capture_key,camera_norm,camera_model,iso,aperture,shutter,focal_mm,
                    exposure_comp,parse_status,updated_at)
                VALUES (?,?,?,?,?,1,1,?,?,'ILCE-7M4',?,?,?,?,?,'ok','2026-10-10')
            """, (sid, filename, filename, Path(filename).suffix, family,
                  key, "sony:ilce-7m4", iso, aperture, shutter, focal, ev))
    result = analyze()
    distributions = result["exposure"]["distributions"]
    assert result["overview"]["captures"] == 8
    assert result["overview"]["files"] == 9
    assert [point["value"] for point in distributions["iso"]] == [100, 125, 160, 200, 6400]
    assert [point["count"] for point in distributions["iso"]] == [1, 1, 1, 2, 1]
    assert [point["value"] for point in distributions["focal"]] == [24, 24.5, 35, 50, 85, 200]
    assert [point["value"] for point in distributions["aperture"]] == [2.4, 2.8, 3.2, 3.5]
    merged = next(point for point in distributions["aperture"] if point["value"] == 2.8)
    assert merged["count"] == 3
    assert merged["min"] == 2.799999 and merged["max"] == 2.828427
    assert [point["count"] for point in distributions["shutter"]] == [3, 2, 1]
    assert [point["value"] for point in distributions["ev"]] == [-1 / 3, 0, 0.5, 2 / 3]
    assert [point["count"] for point in distributions["ev"]] == [2, 1, 2, 2]
    for name, points in distributions.items():
        for point in points:
            rules = ([{"field": point["field"], "op": "eq", "value": point["min"]}]
                     if point["min"] == point["max"] else [
                         {"field": point["field"], "op": "gte", "value": point["min"]},
                         {"field": point["field"], "op": "lte", "value": point["max"]},
                     ])
            filtered = service.query({"version": "photo-filter.v1", "group": {"op": "and", "children": rules}})
            assert filtered["total_captures"] == point["count"], (name, point)
    selected = analyze({"version": "photo-filter.v1", "group": {"field": "exposure.iso", "op": "eq", "value": 200}})
    assert [point["value"] for point in selected["exposure"]["distributions"]["iso"]] == [200]


def test_aperture_stops_absorb_apex_rounding_but_keep_intermediate_apertures():
    from app.photo_data.analytics import APERTURE_STOPS, _near_stop

    assert _near_stop(2 ** 3.5, APERTURE_STOPS, 0.03) == 11
    assert _near_stop(2 ** 4.5, APERTURE_STOPS, 0.03) == 22
    assert _near_stop(3.10000001, APERTURE_STOPS, 0.03) == 3.10000001
    assert _near_stop(2.4, APERTURE_STOPS, 0.03) == 2.4


def test_analytics_filtered_consistently_and_no_source_access(photo_env, monkeypatch):
    from app.photo_data.analytics import analyze

    for name in ("a.arw","a.jpg","b.nef"):
        (photo_env / name).write_bytes(b"demo")
    monkeypatch.setattr(service,"extract_batch",fake_exif)
    sid=service.add_source({"name":"Archive","root_path":str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"] == "completed"

    def forbidden(*args, **kwargs):
        raise AssertionError("analytics accessed the original photo folder")
    monkeypatch.setattr(os,"scandir",forbidden)

    filtered = {"version":"photo-filter.v1","group":{"op":"and","children":[
        {"field":"capture.month","op":"eq","value":"2025-01"},
        {"field":"exposure.iso","op":"gte","value":1600}
    ]}}
    result=analyze(filtered)
    assert result["overview"]["captures"] == 2
    assert result["overview"]["files"] == 3
    assert result["overview"]["paired_captures"] == 1

    impossible={"version":"photo-filter.v1","group":{
        "field":"exposure.iso","op":"gt","value":999999}}
    empty=analyze(impossible)
    assert empty["overview"]["captures"] == 0
    assert empty["timeline"]["daily"] == []
    assert empty["gear"]["combos"] == []
    assert sum(x["count"] for x in empty["exposure"]["iso"]) == 0


def test_analytics_source_filter_cannot_execute_sql(photo_env):
    from app.photo_data.analytics import analyze
    with pytest.raises(ValueError):
        analyze({"version":"photo-filter.v1","group":{
            "field":"camera_norm); DELETE FROM photos;--",
            "op":"eq","value":"Sony"}})


def test_incremental_retries_failed_metadata_without_file_changes(photo_env, monkeypatch):
    (photo_env / "retry.arw").write_bytes(b"raw")
    sid = service.add_source({"name": "Retry", "root_path": str(photo_env)})["id"]
    monkeypatch.setattr(service, "extract_batch", lambda paths: [{"Error": "temporary failure"} for _ in paths])
    assert complete(service.launch_scan([sid]))["failed"] == 1
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    retried = complete(service.launch_scan([sid]))
    assert retried["status"] == "completed"
    assert retried["extracted"] == 1 and retried["unchanged"] == 0
    assert service.query()["items"][0]["parse_status"] == "ok"


def test_removed_count_accumulates_across_sources(photo_env, monkeypatch):
    second_root = photo_env.parent / "second"
    second_root.mkdir()
    for root in (photo_env, second_root):
        for name in ("keep.arw", "remove.arw"):
            (root / name).write_bytes(b"raw")
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    ids = [service.add_source({"name": root.name, "root_path": str(root)})["id"]
           for root in (photo_env, second_root)]
    assert complete(service.launch_scan(ids))["status"] == "completed"
    for root in (photo_env, second_root):
        (root / "remove.arw").unlink()
    result = complete(service.launch_scan(ids))
    assert result["status"] == "completed"
    assert result["removed"] == 2
    assert service.summary()["physical_files"] == 2


def test_weekday_numeric_filter_and_self_excluding_facets(photo_env, monkeypatch):
    for name in ("a.arw", "a.jpg"):
        (photo_env / name).write_bytes(b"raw")
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    sid = service.add_source({"name": "Weekdays", "root_path": str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"] == "completed"
    field = next(f for f in service.field_registry() if f["field_id"] == "capture.weekday")
    assert field["value_type"] == "number"
    condition = {"version": "photo-filter.v1", "group": {"op": "and", "children": [
        {"field": "capture.weekday", "op": "in", "value": [3], "column_id": "capture.weekday"}
    ]}}
    assert service.query(condition)["total_captures"] == 1
    assert service.facets(condition, "capture.weekday")["options"] == [{"value": 3, "count": 1}]


@pytest.mark.parametrize("rule", [
    None, [], {"op": "and", "children": [None]},
    {"field": "exposure.iso", "op": "in", "value": ["1600"]},
    {"field": "exposure.iso", "op": "between", "value": [{}, 3200]},
    {"field": "exposure.iso", "op": "between", "value": ["100", "3200"]},
])
def test_invalid_filter_shapes_return_validation_error(photo_env, rule):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes.photo_data import router
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        response = client.post("/photo-data/query", json={"filter": {"group": rule}})
    assert response.status_code == 422


def test_cancelled_scan_keeps_last_published_snapshot(photo_env, monkeypatch):
    import threading
    for name in ("a.arw", "b.arw"):
        (photo_env / name).write_bytes(b"raw")
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    sid = service.add_source({"name": "Cancel", "root_path": str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"] == "completed"
    before = service.summary()
    started, release = threading.Event(), threading.Event()
    def blocked_exif(paths):
        started.set()
        assert release.wait(5)
        return fake_exif(paths)
    monkeypatch.setattr(service, "extract_batch", blocked_exif)
    job = service.launch_scan([sid], deep=True)
    try:
        assert started.wait(5)
        service.cancel_scan(job)
    finally:
        release.set()
    result = complete(job)
    assert result["status"] == "cancelled"
    assert result["active_workers"] == 0
    assert service.summary() == before
    # v2 keeps staging outside the main DB; no temporary records remain.
    with db.connect() as conn:
        assert not conn.execute(
            "SELECT 1 FROM sqlite_master WHERE name='scan_seen'"
        ).fetchone()
    assert not list(db.database_path().parent.glob(
        db.database_path().stem + ".scan-stage-*.sqlite"
    ))


def test_metadata_explorer_path_search_uses_index_and_escapes_like(photo_env, monkeypatch):
    folder = photo_env / "Vacation"
    folder.mkdir()
    (folder / "DSC001.arw").write_bytes(b"raw")
    (photo_env / "other.jpg").write_bytes(b"jpg")
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    sid = service.add_source({"name": "Library", "root_path": str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"] == "completed"

    def search(term):
        return {"version": "photo-filter.v1", "group": {
            "field": "files.relpath", "op": "contains", "value": term,
        }}
    assert service.query(search("Vacation"))["total_files"] == 1
    assert service.query(search("DSC001"))["total_files"] == 1
    assert service.query(search("other"))["total_files"] == 1
    assert service.query(search("%"))["total_files"] == 0
    assert service.query(search("_"))["total_files"] == 0
    assert service.query(search("x' OR 1=1--"))["total_files"] == 0

    def forbidden(*args, **kwargs):
        raise AssertionError("file search must not access original photos")
    monkeypatch.setattr(os, "scandir", forbidden)
    assert service.query(search("Vacation"))["total_files"] == 1


def test_v1_database_opt_in_migration_preserves_data_and_backup(photo_env, monkeypatch):
    """A real v1 shape remains readable and unchanged until explicit migration."""
    import json
    from app.photo_data import maintenance

    for name in ("a.arw", "a.jpg"):
        (photo_env/name).write_bytes(b"raw")
    monkeypatch.setattr(service, "extract_batch", fake_exif)
    sid=service.add_source({"name":"old-source","root_path":str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"]=="completed"
    preset_filter={"version":"photo-filter.v1","group":{"op":"and","children":[]}}
    preset=service.save_preset("Old preset",preset_filter,["camera.model_norm"])
    with db.connect() as conn:
        conn.execute("CREATE TABLE scan_seen (run_id TEXT,source_id TEXT,relpath TEXT,payload TEXT,"
                     "PRIMARY KEY(run_id,source_id,relpath))")
        conn.execute("ALTER TABLE photos DROP COLUMN missing_scans")
        conn.execute("UPDATE photos SET tags_json=?",
                     (json.dumps({"ISO":1600,"Model":"ILCE-7M4","MeteringMode":5,
                                  "GPSLongitude":123}),))
        conn.execute("PRAGMA user_version=0")
    before=service.summary()
    previous=maintenance.status()
    assert previous["migration_required"] is True
    assert previous["schema_version"]==0
    assert maintenance.start.__name__ == "start"
    with pytest.raises(ValueError,match="确认"):
        maintenance.start("migrate",False)
    assert service.summary()==before

    from app.photo_data.db import initialize
    initialize()  # startup must not silently upgrade a pre-existing v1 DB
    assert maintenance.status()["schema_version"]==0

    result=maintenance._migrate()
    assert "backup_file" in result
    backup=db.database_path().with_name(result["backup_file"])
    assert backup.exists()
    with db.connect() as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0]==2
        assert conn.execute("PRAGMA table_info(photos)").fetchall()
        assert not conn.execute(
            "SELECT 1 FROM sqlite_master WHERE name='scan_seen'"
        ).fetchone()
        item=conn.execute("SELECT tags_json,missing_scans FROM photos LIMIT 1").fetchone()
        exif=json.loads(item["tags_json"])
        assert "ISO" not in exif and "Model" not in exif
        assert exif["MeteringMode"]==5
        assert "GPSLongitude" not in exif  # Old stray location tags are sanitized
        assert item["missing_scans"]==0
    with __import__("sqlite3").connect(str(backup)) as old:
        assert old.execute("PRAGMA user_version").fetchone()[0]==0
        assert old.execute("SELECT COUNT(*) FROM photos").fetchone()[0]==2
        assert old.execute("SELECT COUNT(*) FROM scan_seen").fetchone()[0]==0
    assert service.summary()==before
    assert any(p["name"]=="Old preset" for p in service.presets())
    assert preset["name"]=="Old preset"

    # Subsequent deep scan uses the separate stage DB, without touching the backup.
    assert complete(service.launch_scan([sid],deep=True))["status"]=="completed"
    assert {k:v for k,v in service.summary().items() if k!="as_of"} == {
        k:v for k,v in before.items() if k!="as_of"
    }
    assert not list(db.database_path().parent.glob(
        db.database_path().stem+".scan-stage-*.sqlite"
    ))


def test_v2_missing_photo_purge_requires_three_confirmed_scans_and_age(photo_env, monkeypatch):
    from datetime import datetime,timedelta,timezone
    from app.photo_data import maintenance
    monkeypatch.setattr(service,"extract_batch",fake_exif)
    (photo_env/"a.arw").write_bytes(b"photo")
    sid=service.add_source({"name":"source","root_path":str(photo_env)})["id"]
    assert complete(service.launch_scan([sid]))["status"]=="completed"
    (photo_env/"a.arw").unlink()
    for expected in (1,2):
        # An entirely empty source triggers existing NAS-unmount safeguards.
        assert complete(service.launch_scan([sid], confirm_large_removal=True))["status"]=="completed"
        with db.connect() as conn:
            value=conn.execute("SELECT present,missing_scans FROM photos").fetchone()
            assert tuple(value)==(0,expected)
        assert maintenance._cleanup()["removed_photos"]==0
    assert complete(service.launch_scan([sid],confirm_large_removal=True))["status"]=="completed"
    with db.connect() as conn:
        conn.execute("UPDATE photos SET updated_at=?",
          ((datetime.now(timezone.utc)-timedelta(days=32)).isoformat(),))
    assert maintenance.status()["eligible_for_purge"]==1
    assert maintenance._cleanup()["removed_photos"]==1
    assert service.query()["total_files"]==0


def test_maintenance_operations_refuse_active_scan(photo_env, monkeypatch):
    from app.photo_data import maintenance
    import threading
    (photo_env/"a.arw").write_bytes(b"photo")
    started, release=threading.Event(),threading.Event()
    def blocked(paths):
        started.set()
        assert release.wait(5)
        return fake_exif(paths)
    monkeypatch.setattr(service,"extract_batch",blocked)
    sid=service.add_source({"name":"source","root_path":str(photo_env)})["id"]
    run=service.launch_scan([sid])
    try:
        assert started.wait(5)
        with pytest.raises(ValueError,match="扫描"):
            maintenance.start("vacuum",True)
        with pytest.raises(ValueError,match="扫描"):
            maintenance.start("cleanup",True)
    finally:
        release.set()
    assert complete(run)["status"]=="completed"
