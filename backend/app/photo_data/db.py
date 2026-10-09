"""Independent SQLite index for photo metadata. No filesystem source access at startup."""
from __future__ import annotations

import os
import sqlite3
from pathlib import Path


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
        CREATE TABLE IF NOT EXISTS scan_seen (
          run_id TEXT NOT NULL, source_id TEXT NOT NULL, relpath TEXT NOT NULL,
          payload TEXT NOT NULL, PRIMARY KEY(run_id,source_id,relpath)
        );
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
        db.execute("DELETE FROM scan_seen WHERE run_id IN "
                   "(SELECT id FROM scan_runs WHERE status='interrupted')")
        db.commit()
