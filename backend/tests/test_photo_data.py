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
