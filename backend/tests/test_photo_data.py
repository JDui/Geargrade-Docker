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
