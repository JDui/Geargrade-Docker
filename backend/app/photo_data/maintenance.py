"""Safe, explicitly authorized photo index maintenance and v2 migration.

The last published photo snapshot is never destroyed on migration failure.
All heavy work runs in a dedicated task; a migration keeps a SQLite backup.
"""
from __future__ import annotations

import shutil
import sqlite3
import threading
import uuid
from contextlib import closing
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from .db import MAINTENANCE_LOCK, SCHEMA_VERSION, connect, database_path

_STATE_LOCK = threading.Lock()
_JOB: dict[str, Any] | None = None
RETAIN_SCAN_RUNS = 50
RETAIN_HISTORY_DAYS = 90
TOMBSTONE_DAYS = 30
TOMBSTONE_SCANS = 3


def _iso(days_ago: int) -> str:
    return (datetime.now(timezone.utc) - timedelta(days=days_ago)).isoformat()


def _running(db: sqlite3.Connection) -> bool:
    return db.execute(
        "SELECT 1 FROM scan_runs WHERE status IN ('queued','running') LIMIT 1"
    ).fetchone() is not None


def _schema(db: sqlite3.Connection) -> int:
    return int(db.execute("PRAGMA user_version").fetchone()[0])


def _size(path: Path) -> int:
    try:
        return path.stat().st_size
    except OSError:
        return 0


def _metrics() -> dict:
    dbpath = database_path()
    with closing(connect()) as db:
        version = _schema(db)
        page_size = db.execute("PRAGMA page_size").fetchone()[0]
        pages = db.execute("PRAGMA page_count").fetchone()[0]
        free_pages = db.execute("PRAGMA freelist_count").fetchone()[0]
        photo_rows = db.execute(
            "SELECT COUNT(*),SUM(CASE WHEN present=1 THEN 1 ELSE 0 END),"
            "SUM(CASE WHEN present=0 THEN 1 ELSE 0 END) FROM photos"
        ).fetchone()
        candidate = 0
        if version >= SCHEMA_VERSION:
            candidate = db.execute(
                "SELECT COUNT(*) FROM photos WHERE present=0 AND "
                "missing_scans>=? AND updated_at<?",
                (TOMBSTONE_SCANS, _iso(TOMBSTONE_DAYS)),
            ).fetchone()[0]
        stage_rows = 0
        if version < SCHEMA_VERSION:
            stage = db.execute("SELECT 1 FROM sqlite_master WHERE name='scan_seen'").fetchone()
            if stage:
                stage_rows = db.execute("SELECT COUNT(*) FROM scan_seen").fetchone()[0]
        scan_rows = db.execute("SELECT COUNT(*) FROM scan_runs").fetchone()[0]
        active = _running(db)
    stage_files = list(dbpath.parent.glob(dbpath.stem + ".scan-stage-*.sqlite"))
    return {
        "schema_version": version,
        "target_schema_version": SCHEMA_VERSION,
        "migration_required": version < SCHEMA_VERSION,
        "db_bytes": _size(dbpath),
        "wal_bytes": _size(dbpath.with_name(dbpath.name + "-wal")),
        "freelist_bytes": int(free_pages * page_size),
        "page_count": pages,
        "page_size": page_size,
        "physical_files": int(photo_rows[0] or 0),
        "active_photos": int(photo_rows[1] or 0),
        "missing_photos": int(photo_rows[2] or 0),
        "eligible_for_purge": int(candidate),
        "legacy_stage_rows": stage_rows,
        "stage_bytes": sum(_size(p) for p in stage_files),
        "scan_runs": scan_rows,
        "scan_active": active,
        "policy": {
            "missing_confirmations": TOMBSTONE_SCANS,
            "missing_days": TOMBSTONE_DAYS,
            "retain_run_count": RETAIN_SCAN_RUNS,
            "retain_run_days": RETAIN_HISTORY_DAYS,
        },
    }


def status() -> dict:
    metrics = _metrics()
    with _STATE_LOCK:
        job = dict(_JOB) if _JOB else None
    return {**metrics, "job": job}


def _check_space(multiplier: float = 1.2) -> None:
    path = database_path()
    reserve = int(_size(path) * multiplier) + 16 * 1024 * 1024
    if shutil.disk_usage(path.parent).free < reserve:
        raise ValueError(
            "数据库所在磁盘剩余空间不足；请先为备份/整理预留额外空间"
        )


def _backup(db: sqlite3.Connection) -> Path:
    path = database_path()
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%f")
    destination = path.with_name(path.stem + ".pre-v2-" + stamp + ".sqlite.bak")
    try:
        with closing(sqlite3.connect(str(destination))) as target:
            db.backup(target, pages=1000, sleep=0.05)
            check = target.execute("PRAGMA quick_check").fetchone()[0]
            if check != "ok":
                raise RuntimeError("备份完整性校验未通过")
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    return destination


def _migrate() -> dict:
    from .service import EXIF_STRUCTURED_TAGS
    with closing(connect()) as db:
        version = _schema(db)
        if version >= SCHEMA_VERSION:
            return {"message": "数据库已是最新版"}
        if _running(db):
            raise ValueError("扫描期间无法迁移，请先完成或取消扫描")
        _check_space(1.2)
        backup = _backup(db)
        _stage("backup_done", backup_file=backup.name)
        # All changes to the main index occur in one SQLite transaction.
        try:
            db.execute("BEGIN IMMEDIATE")
            if _running(db):
                raise ValueError("扫描正在执行，迁移已停止")
            columns = {r[1] for r in db.execute("PRAGMA table_info(photos)")}
            if "missing_scans" not in columns:
                db.execute("ALTER TABLE photos ADD COLUMN missing_scans INTEGER NOT NULL DEFAULT 0")
            db.execute("UPDATE photos SET missing_scans=1 WHERE present=0 AND missing_scans=0")
            paths = ["$." + x for x in sorted(EXIF_STRUCTURED_TAGS)]
            placeholders = ",".join("?" for _ in paths)
            db.execute(
                "UPDATE photos SET tags_json=CASE WHEN json_valid(tags_json) "
                "THEN json_remove(tags_json," + placeholders + ") ELSE tags_json END "
                "WHERE tags_json!='{}'",
                paths,
            )
            db.execute("DROP TABLE IF EXISTS scan_seen")
            db.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
            db.commit()
        except BaseException:
            db.rollback()
            raise
        _stage("checkpointing")
        # WAL checkpoint is opportunistic; failure does not invalidate migration.
        try:
            db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        except sqlite3.Error:
            pass
        return {
            "message": "数据库已迁移至 v2；旧库备份已保留，可在维护页手动回收空闲页",
            "backup_file": backup.name,
        }


def _cleanup() -> dict:
    with closing(connect()) as db:
        if _schema(db) < SCHEMA_VERSION:
            raise ValueError("请先迁移旧版数据库")
        if _running(db):
            raise ValueError("扫描进行中，不能清理数据")
        with db:
            deleted = db.execute(
                "DELETE FROM photos WHERE present=0 AND missing_scans>=? "
                "AND updated_at<?",
                (TOMBSTONE_SCANS, _iso(TOMBSTONE_DAYS)),
            ).rowcount
            # Keep recent history and source.last_run_id even after retention.
            histories = db.execute(
                "DELETE FROM scan_runs WHERE status NOT IN ('queued','running') "
                "AND ended_at IS NOT NULL AND started_at<? "
                "AND id NOT IN (SELECT id FROM scan_runs ORDER BY started_at DESC LIMIT ?) "
                "AND id NOT IN (SELECT last_run_id FROM sources WHERE last_run_id IS NOT NULL)",
                (_iso(RETAIN_HISTORY_DAYS), RETAIN_SCAN_RUNS),
            ).rowcount
        return {
            "message": "已清理符合条件的旧记录，物理文件回收请另行执行压缩",
            "removed_photos": deleted,
            "removed_scan_runs": histories,
        }


def _vacuum() -> dict:
    with closing(connect()) as db:
        if _schema(db) < SCHEMA_VERSION:
            raise ValueError("请先迁移旧版数据库")
        if _running(db):
            raise ValueError("扫描进行中，不能压缩数据库")
        _check_space(1.25)
        start = _size(database_path())
        # VACUUM requires no open transaction; SQLite manages the copy atomically.
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        _stage("vacuum")
        db.execute("VACUUM")
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        return {
            "message": "数据库物理空间整理完成",
            "bytes_before": start,
            "bytes_after": _size(database_path()),
        }


def _stage(phase: str, **details) -> None:
    with _STATE_LOCK:
        if _JOB:
            _JOB.update(phase=phase, **details)


def _worker(operation: str) -> None:
    global _JOB
    try:
        _stage("working")
        result = {"migrate": _migrate, "cleanup": _cleanup, "vacuum": _vacuum}[operation]()
        with _STATE_LOCK:
            if _JOB:
                _JOB.update(status="completed", phase="completed", result=result,
                            ended_at=datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        with _STATE_LOCK:
            if _JOB:
                _JOB.update(status="failed", phase="failed", error=str(exc)[:1200],
                            ended_at=datetime.now(timezone.utc).isoformat())
    finally:
        MAINTENANCE_LOCK.release()


def start(operation: str, confirmed: bool = False) -> dict:
    global _JOB
    if operation not in ("migrate", "cleanup", "vacuum"):
        raise ValueError("不支持的维护操作")
    if not confirmed:
        raise ValueError("请先确认维护操作以及可能需要的备份磁盘空间")
    if not MAINTENANCE_LOCK.acquire(blocking=False):
        raise ValueError("已有数据库维护正在进行")
    try:
        with closing(connect()) as db:
            if _running(db):
                raise ValueError("当前扫描尚未结束，无法执行数据库维护")
            version = _schema(db)
            if operation != "migrate" and version < SCHEMA_VERSION:
                raise ValueError("请先迁移旧版数据库")
        job_id = str(uuid.uuid4())
        with _STATE_LOCK:
            _JOB = {
                "id": job_id, "operation": operation,
                "status": "running", "phase": "starting", "error": None,
                "started_at": datetime.now(timezone.utc).isoformat(),
            }
        threading.Thread(target=_worker,args=(operation,),daemon=True,
                         name="photo-maintenance-" + job_id[:8]).start()
        return dict(_JOB)
    except BaseException:
        MAINTENANCE_LOCK.release()
        raise
