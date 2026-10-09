"""Independent SQLite index for photo metadata. No filesystem source access at startup."""
from __future__ import annotations

import os
import sqlite3
import threading
from pathlib import Path


SCHEMA_VERSION = 2
MAINTENANCE_LOCK = threading.Lock()


def database_path() -> Path:
    return Path(os.environ.get("PHOTO_DATA_DB_PATH", "./data/photo_index.db"))


def connect() -> sqlite3.Connection:
    db = sqlite3.connect(str(database_path()), timeout=30, check_same_thread=False)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=30000")
    return db


def initialize() -> None:
    path = database_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        preexisting = db.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name='photos'"
        ).fetchone() is not None
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version > SCHEMA_VERSION:
            raise RuntimeError("photo_index.db 使用了更新的数据库版本；请更新 Geargrade")
        db.execute("PRAGMA journal_mode=WAL")
        db.executescript("""
        CREATE TABLE IF NOT EXISTS sources (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, root_path TEXT NOT NULL UNIQUE,
          enabled INTEGER NOT NULL DEFAULT 1,
          created_at TEXT NOT NULL, last_success TEXT, last_run_id TEXT
        );
        CREATE TABLE IF NOT EXISTS scan_runs (
          id TEXT PRIMARY KEY, started_at TEXT NOT NULL, ended_at TEXT,
          status TEXT NOT NULL, mode TEXT NOT NULL, source_ids TEXT NOT NULL,
          seen INTEGER NOT NULL DEFAULT 0, extracted INTEGER NOT NULL DEFAULT 0,
          unchanged INTEGER NOT NULL DEFAULT 0, failed INTEGER NOT NULL DEFAULT 0,
          removed INTEGER NOT NULL DEFAULT 0, error TEXT,
          cancel_requested INTEGER NOT NULL DEFAULT 0
        );
        CREATE UNIQUE INDEX IF NOT EXISTS one_photo_scan
          ON scan_runs ((1)) WHERE status IN ('queued','running');
        CREATE TABLE IF NOT EXISTS photos (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_id TEXT NOT NULL REFERENCES sources(id),
          relpath TEXT NOT NULL, filename TEXT NOT NULL, ext TEXT NOT NULL,
          format_family TEXT NOT NULL, size_bytes INTEGER NOT NULL,
          mtime_ns INTEGER NOT NULL, capture_key TEXT NOT NULL,
          shot_at TEXT, camera_make TEXT, camera_model TEXT, camera_norm TEXT,
          lens_model TEXT, lens_norm TEXT,
          iso REAL, aperture REAL, shutter REAL, focal_mm REAL,
          width_px INTEGER, height_px INTEGER, exposure_comp REAL,
          flash TEXT, wb TEXT, focus_mode TEXT, shutter_type TEXT,
          drive_mode TEXT, picture_style TEXT, firmware TEXT,
          rating INTEGER, color_space TEXT, software TEXT,
          tags_json TEXT NOT NULL DEFAULT '{}', parse_status TEXT NOT NULL,
          present INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL,
          UNIQUE(source_id,relpath)
        );
        CREATE INDEX IF NOT EXISTS photo_source_presence ON photos(source_id,present);
        CREATE INDEX IF NOT EXISTS photo_camera_date ON photos(camera_norm,shot_at);
        CREATE INDEX IF NOT EXISTS photo_lens_date ON photos(lens_norm,shot_at);
        CREATE INDEX IF NOT EXISTS photo_capture_key ON photos(capture_key);
        CREATE INDEX IF NOT EXISTS photo_format ON photos(format_family);
        CREATE TABLE IF NOT EXISTS filter_presets (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          filter_json TEXT NOT NULL, columns_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        """)
        db.execute(
            "UPDATE scan_runs SET status='interrupted', ended_at=datetime('now'), "
            "error='Server stopped during scan' WHERE status IN ('queued','running')"
        )
        if preexisting and version < SCHEMA_VERSION:
            # Leave legacy databases untouched until the user approves migration.
            db.execute("""CREATE TABLE IF NOT EXISTS scan_seen (
              run_id TEXT NOT NULL, source_id TEXT NOT NULL, relpath TEXT NOT NULL,
              payload TEXT NOT NULL, PRIMARY KEY(run_id,source_id,relpath)
            )""")
            db.execute("DELETE FROM scan_seen WHERE run_id IN "
                       "(SELECT id FROM scan_runs WHERE status='interrupted')")
        if not preexisting:
            db.execute(f"PRAGMA user_version={SCHEMA_VERSION}")
        if not preexisting or version >= SCHEMA_VERSION:
            columns = {r[1] for r in db.execute("PRAGMA table_info(photos)")}
            if "missing_scans" not in columns:
                db.execute("ALTER TABLE photos ADD COLUMN missing_scans INTEGER NOT NULL DEFAULT 0")

        # Small additive migrations for existing installations; no source IO.
        scan_columns = {r[1] for r in db.execute("PRAGMA table_info(scan_runs)")}
        additions = {
            "phase": "TEXT NOT NULL DEFAULT 'queued'",
            "directories_seen": "INTEGER NOT NULL DEFAULT 0",
            "total_candidates": "INTEGER NOT NULL DEFAULT 0",
            "processed": "INTEGER NOT NULL DEFAULT 0",
            "workers": "INTEGER NOT NULL DEFAULT 0",
            "active_workers": "INTEGER NOT NULL DEFAULT 0",
            "enumeration_done": "INTEGER NOT NULL DEFAULT 0",
            "rate_files_per_sec": "REAL NOT NULL DEFAULT 0",
        }
        for column, definition in additions.items():
            if column not in scan_columns:
                db.execute(f"ALTER TABLE scan_runs ADD COLUMN {column} {definition}")
        db.commit()
    # A stage DB belongs to a run, never to the permanent photo index.
    # Reap only jobs that are no longer active after crash-recovery above.
    with connect() as db:
        active = {r[0] for r in db.execute(
            "SELECT id FROM scan_runs WHERE status IN ('queued','running')")}
    for staged in path.parent.glob(path.stem + ".scan-stage-*.sqlite"):
        run_id = staged.name[len(path.stem + ".scan-stage-"):-len(".sqlite")]
        if run_id not in active:
            for suffix in ("", "-journal", "-wal", "-shm"):
                try:
                    staged.with_name(staged.name + suffix).unlink(missing_ok=True)
                except OSError:
                    pass
