"""Aggregated photography charts built solely from the published SQLite index.

No source directory reads and no GPS. File-level totals and logical captures
are explicitly separate. The filtered snapshot is materialized once as two
connection-local TEMP tables so a 100k+ library is not transferred to the UI.
"""
from __future__ import annotations

import sqlite3
from typing import Any

from . import service
from .db import connect

# Edges define [lower, upper) ranges. Extremes remain open-ended.
ISO_EDGES = (100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600)
FOCAL_EDGES = (12, 24, 35, 50, 70, 100, 135, 200, 300, 400, 600)
APERTURE_EDGES = (1.4, 2, 2.8, 4, 5.6, 8, 11, 16, 22)
SHUTTER_EDGES = (1 / 8000, 1 / 4000, 1 / 2000, 1 / 1000, 1 / 500, 1 / 250,
                 1 / 125, 1 / 60, 1 / 30, 1 / 15, 1 / 8, 1 / 4, 1 / 2,
                 1, 2, 5, 15, 30)
EV_EDGES = (-3, -2, -1, -0.33, 0.33, 1, 2, 3)
MP_EDGES = (2, 6, 12, 16, 20, 24, 32, 40, 50, 60, 80, 100)
SIZE_EDGES = (1, 5, 10, 20, 40, 80, 150, 300, 600)


def grouped(db: sqlite3.Connection, sql: str, values: tuple = ()) -> list[dict]:
    return [dict(row) for row in db.execute(sql, values)]


def _buckets(db: sqlite3.Connection, column: str, edges: tuple[float, ...],
             field: str, labeler=None, where: str = "1=1",
             source: str = "captures") -> list[dict]:
    # Both SQL column and WHERE are exclusively internal static strings.
    condition = "CASE " + " ".join(
        f"WHEN {column} < {float(edge)} THEN {index}" for index, edge in enumerate(edges)
    ) + f" ELSE {len(edges)} END"
    counts = {
        row["bucket"]: row["count"] for row in grouped(
            db, f"SELECT {condition} AS bucket,COUNT(*) AS count FROM {source} "
                f"WHERE {column} IS NOT NULL AND {where} GROUP BY bucket"
        )
    }
    result = []
    for i in range(len(edges) + 1):
        lower = edges[i - 1] if i else None
        upper = edges[i] if i < len(edges) else None
        label = labeler(lower, upper) if labeler else (
            (f"< {upper:g}" if lower is None else
             f"≥ {lower:g}" if upper is None else f"{lower:g}–{upper:g}")
        )
        result.append({"label": label, "bucket": i, "count": counts.get(i, 0),
                       "min": lower, "max": upper, "field": field})
    return result


def _duration_label(lower, upper):
    def fmt(v):
        if v is None:
            return ""
        if v < 1:
            return f"1/{round(1 / v)}s"
        return f"{v:g}s"
    if lower is None: return "< " + fmt(upper)
    if upper is None: return "≥ " + fmt(lower)
    return fmt(lower) + "–" + fmt(upper)


def _metric(db: sqlite3.Connection, sql: str) -> int:
    return int(db.execute(sql).fetchone()[0] or 0)


def _top(db: sqlite3.Connection, column: str, limit: int = 12,
         source: str = "captures", extra: str = "1=1") -> list[dict]:
    return grouped(db,
        f"SELECT COALESCE(NULLIF(TRIM({column}),''),'未记录') AS name,"
        f"COUNT(*) AS count FROM {source} WHERE {extra} "
        f"GROUP BY name ORDER BY count DESC,name LIMIT ?", (limit,))


def _calendar(db: sqlite3.Connection) -> list[dict]:
    # One point per occupied date; the browser fills the empty grid cells.
    return grouped(db,
        "SELECT substr(shot_at,1,10) AS date,COUNT(*) AS count FROM captures "
        "WHERE shot_at IS NOT NULL GROUP BY date ORDER BY date LIMIT 20000")


def analyze(filter_ast: dict | None = None) -> dict[str, Any]:
    """Return bounded aggregated series. No entire source-file listing is returned."""
    where, args = service.compile_filter(filter_ast)
    with connect() as db:
        # Prevent a long read from starving other indexed requests.
        db.execute("PRAGMA busy_timeout=30000")
        db.execute("CREATE TEMP TABLE selected_files AS "
                   "SELECT capture_key,format_family,size_bytes,parse_status,"
                   "shot_at,camera_make,camera_model,camera_norm,lens_model,lens_norm,"
                   "iso,aperture,shutter,focal_mm,exposure_comp,flash,wb,focus_mode,"
                   "shutter_type,drive_mode,picture_style,width_px,height_px,"
                   "color_space,software," + service.FOCAL_EQ_SQL + " AS focal_eq_mm," +
                   service.FOCAL_EQ_SOURCE_SQL + " AS focal_eq_source "
                   "FROM photos WHERE " + where, args)
        db.execute("CREATE INDEX sf_capture ON selected_files(capture_key,format_family)")
        # Prefer metadata-complete variants within a single RAW+JPEG logical capture.
        db.execute("""
            CREATE TEMP TABLE captures AS
            SELECT capture_key,shot_at,camera_make,camera_model,camera_norm,lens_model,
                   lens_norm,iso,aperture,shutter,focal_mm,focal_eq_mm,focal_eq_source,exposure_comp,flash,wb,
                   focus_mode,shutter_type,drive_mode,picture_style,width_px,
                   height_px,color_space,software,format_family
            FROM (
              SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY capture_key ORDER BY
                  (shot_at IS NULL),(camera_norm IS NULL),(lens_norm IS NULL),
                  CASE format_family WHEN 'raw' THEN 0 WHEN 'jpeg' THEN 1
                                     WHEN 'heif' THEN 2 ELSE 3 END
                ) AS rn FROM selected_files
            ) WHERE rn=1
        """)
        db.execute("CREATE INDEX cp_time ON captures(shot_at)")
        db.execute("CREATE INDEX cp_camera ON captures(camera_norm)")
        db.execute("CREATE INDEX cp_lens ON captures(lens_norm)")
        overview = dict(db.execute("""
            SELECT COUNT(*) AS captures,
              SUM(CASE WHEN shot_at IS NOT NULL THEN 1 ELSE 0 END) AS dated,
              SUM(CASE WHEN camera_norm IS NOT NULL THEN 1 ELSE 0 END) AS camera_known,
              SUM(CASE WHEN lens_norm IS NOT NULL THEN 1 ELSE 0 END) AS lens_known,
              MIN(shot_at) AS first_shot,MAX(shot_at) AS last_shot
            FROM captures
        """).fetchone())
        file_totals = dict(db.execute("""
            SELECT COUNT(*) AS files,COALESCE(SUM(size_bytes),0) AS bytes,
              SUM(CASE WHEN format_family='raw' THEN 1 ELSE 0 END) AS raw_files,
              SUM(CASE WHEN parse_status!='ok' THEN 1 ELSE 0 END) AS failed_files
            FROM selected_files
        """).fetchone())
        paired = _metric(db, """
            SELECT COUNT(*) FROM
              (SELECT capture_key FROM selected_files GROUP BY capture_key
               HAVING SUM(CASE WHEN format_family='raw' THEN 1 ELSE 0 END)>0
                  AND SUM(CASE WHEN format_family='jpeg' THEN 1 ELSE 0 END)>0)
        """)
        raw_captures = _metric(db, """
            SELECT COUNT(DISTINCT capture_key) FROM selected_files
            WHERE format_family='raw'
        """)
        overview.update(file_totals)
        overview["paired_captures"] = paired
        overview["raw_captures"] = raw_captures

        timeline = {
            "yearly": grouped(db,
                "SELECT substr(shot_at,1,4) AS key,COUNT(*) AS count FROM captures "
                "WHERE shot_at IS NOT NULL GROUP BY key ORDER BY key"),
            "monthly": grouped(db,
                "SELECT substr(shot_at,1,7) AS key,COUNT(*) AS count FROM captures "
                "WHERE shot_at IS NOT NULL GROUP BY key ORDER BY key"),
            "daily": _calendar(db),
            "hours": grouped(db,
                "SELECT CAST(substr(shot_at,12,2) AS INTEGER) AS hour,COUNT(*) AS count "
                "FROM captures WHERE shot_at IS NOT NULL GROUP BY hour ORDER BY hour"),
            "weekdays": grouped(db,
                "SELECT (CAST(strftime('%w',shot_at) AS INTEGER)+6)%7 AS weekday,"
                "COUNT(*) AS count FROM captures WHERE shot_at IS NOT NULL "
                "GROUP BY weekday ORDER BY weekday"),
            "weekday_hour": grouped(db,
                "SELECT (CAST(strftime('%w',shot_at) AS INTEGER)+6)%7 AS weekday,"
                "CAST(substr(shot_at,12,2) AS INTEGER) AS hour,COUNT(*) AS count "
                "FROM captures WHERE shot_at IS NOT NULL "
                "GROUP BY weekday,hour ORDER BY weekday,hour"),
        }
        gear = {
            "cameras": _top(db, "camera_norm", 16),
            "lenses": _top(db, "lens_norm", 16),
            "makers": _top(db, "camera_make", 14),
            "combos": grouped(db,
                "SELECT COALESCE(camera_norm,'未记录') AS camera,"
                "COALESCE(lens_norm,'未记录') AS lens,COUNT(*) AS count "
                "FROM captures GROUP BY camera,lens ORDER BY count DESC LIMIT 50"),
            "camera_years": grouped(db,
                "SELECT substr(shot_at,1,4) AS year,COALESCE(camera_norm,'未记录') AS camera,"
                "COUNT(*) AS count FROM captures WHERE shot_at IS NOT NULL "
                "GROUP BY year,camera ORDER BY year,camera LIMIT 1500"),
            "lens_by_camera": grouped(db,
                "SELECT COALESCE(camera_norm,'未记录') AS camera,"
                "COALESCE(lens_norm,'未记录') AS lens,COUNT(*) AS count "
                "FROM captures GROUP BY camera,lens ORDER BY count DESC LIMIT 250"),
        }
        exposure = {
            "iso": _buckets(db,"iso",ISO_EDGES,"exposure.iso"),
            "focal": _buckets(db,"focal_eq_mm",FOCAL_EDGES,"exposure.focal_eq_mm"),
            "focal_coverage": grouped(db,
                "SELECT focal_eq_source AS name,COUNT(*) AS count FROM captures "
                "WHERE focal_mm IS NOT NULL GROUP BY focal_eq_source ORDER BY count DESC"),
            "aperture": _buckets(db,"aperture",APERTURE_EDGES,"exposure.aperture"),
            "shutter": _buckets(db,"shutter",SHUTTER_EDGES,"exposure.shutter",_duration_label),
            "ev": _buckets(db,"exposure_comp",EV_EDGES,"exposure.compensation"),
            "flash": _top(db,"flash",10),
            "wb": _top(db,"wb",12),
            "focus": _top(db,"focus_mode",12),
            "drive": _top(db,"drive_mode",12),
            "shutter_type": _top(db,"shutter_type",10),
            "picture_style": _top(db,"picture_style",14),
            "iso_shutter": grouped(db, """
                SELECT CASE
                  WHEN iso < 200 THEN 0 WHEN iso < 800 THEN 1
                  WHEN iso < 3200 THEN 2 WHEN iso < 12800 THEN 3 ELSE 4 END AS x,
                CASE WHEN shutter < 0.001 THEN 0 WHEN shutter < 0.01 THEN 1
                  WHEN shutter < 0.1 THEN 2 WHEN shutter < 1 THEN 3 ELSE 4 END AS y,
                COUNT(*) AS count FROM captures
                WHERE iso IS NOT NULL AND shutter IS NOT NULL AND shutter>0
                GROUP BY x,y ORDER BY x,y
            """),
            "focal_aperture": grouped(db, """
                SELECT CASE WHEN focal_eq_mm<24 THEN 0 WHEN focal_eq_mm<50 THEN 1
                  WHEN focal_eq_mm<100 THEN 2 WHEN focal_eq_mm<200 THEN 3 ELSE 4 END AS x,
                CASE WHEN aperture<2 THEN 0 WHEN aperture<4 THEN 1
                  WHEN aperture<8 THEN 2 WHEN aperture<16 THEN 3 ELSE 4 END AS y,
                COUNT(*) AS count FROM captures
                WHERE focal_eq_mm IS NOT NULL AND aperture IS NOT NULL
                GROUP BY x,y ORDER BY x,y
            """),
        }
        files = {
            "formats": _top(db,"format_family",12,"selected_files"),
            "capture_formats": _top(db,"format_family",12,"captures"),
            "size": _buckets(db,"size_bytes",
                 tuple(edge*1048576 for edge in SIZE_EDGES),
                 "files.size_bytes",
                 lambda low,high: (f"<{high/1048576:g} MiB" if low is None
                       else f"≥{low/1048576:g} MiB" if high is None
                       else f"{low/1048576:g}–{high/1048576:g} MiB"),
                 source="selected_files"),
            "resolution": _buckets(db,
                "(width_px*height_px/1000000.0)", MP_EDGES,
                "files.megapixels", where="width_px>0 AND height_px>0"),
            "orientation": grouped(db, """
                SELECT CASE WHEN width_px IS NULL OR height_px IS NULL
                                  OR width_px<=0 OR height_px<=0 THEN '未知'
                            WHEN width_px>height_px THEN '横向'
                            WHEN height_px>width_px THEN '竖向' ELSE '正方形' END AS name,
                       COUNT(*) AS count
                FROM captures GROUP BY name ORDER BY count DESC
            """),
            "aspect": grouped(db, """
                SELECT CASE WHEN width_px IS NULL OR height_px IS NULL
                                  OR height_px<=0 THEN '未知'
                            WHEN ABS(width_px*1.0/height_px-1)<0.03 THEN '1:1'
                            WHEN ABS(width_px*1.0/height_px-1.5)<0.04
                              OR ABS(width_px*1.0/height_px-0.6667)<0.04 THEN '3:2'
                            WHEN ABS(width_px*1.0/height_px-1.3333)<0.04
                              OR ABS(width_px*1.0/height_px-0.75)<0.04 THEN '4:3'
                            WHEN ABS(width_px*1.0/height_px-1.7778)<0.04
                              OR ABS(width_px*1.0/height_px-0.5625)<0.04 THEN '16:9'
                            ELSE '其他' END AS name,COUNT(*) AS count
                FROM captures GROUP BY name ORDER BY count DESC
            """),
            "status": _top(db,"parse_status",8,"selected_files"),
            "software": _top(db,"software",14,"captures"),
            "color_space": _top(db,"color_space",10,"captures"),
        }

        quality_fields = (
            ("拍摄时间", "shot_at"), ("机身", "camera_norm"), ("镜头", "lens_norm"),
            ("ISO", "iso"), ("光圈", "aperture"), ("快门", "shutter"),
            ("焦距", "focal_mm"), ("曝光补偿", "exposure_comp"),
            ("分辨率", "width_px"), ("闪光灯", "flash"),
            ("白平衡", "wb"), ("对焦模式", "focus_mode"),
        )
        completeness = grouped(db,
            "SELECT " + ",".join(
                "SUM(CASE WHEN " + name + " IS NOT NULL THEN 1 ELSE 0 END) AS c" + str(i)
                for i, (_, name) in enumerate(quality_fields)
            ) + " FROM captures")[0]
        quality = [{"name": title, "count": int(completeness["c"+str(i)] or 0),
                    "total": int(overview["captures"] or 0)} for i,(title,_) in enumerate(quality_fields)]
    return {
        "schema_version": "photo-analytics.v1",
        "as_of": service.status()["last_success"],
        "overview": overview, "timeline": timeline, "gear": gear,
        "exposure": exposure, "files": files, "quality": quality,
        "notes": {
            "captures": "One chosen metadata record per logical capture in the filtered snapshot",
            "files": "File metrics count physical files; format totals may exceed capture totals",
            "time": "Camera-local EXIF date/time; time zone is not inferred",
            "gaps": "Missing metadata is kept as unknown, not inferred",
        },
    }
