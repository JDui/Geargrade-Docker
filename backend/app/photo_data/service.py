"""Manual-only read-only ExifTool scanner and snapshot-backed photo analytics.

All source filesystem operations are inside _scan_worker, which is reachable
only from POST /scan. Database-backed reads never touch a source directory.
"""
from __future__ import annotations

import csv
import io
import json
import os
import posixpath
import re
import shutil
import sqlite3
import subprocess
import threading
import uuid
import zipfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .db import MAINTENANCE_LOCK, connect

IMAGE_EXT = {
    ".arw": "raw", ".sr2": "raw", ".srf": "raw", ".raf": "raw", ".orf": "raw",
    ".ori": "raw", ".nef": "raw", ".nrw": "raw", ".rw2": "raw", ".rwl": "raw",
    ".dng": "raw", ".pef": "raw", ".cr2": "raw", ".cr3": "raw", ".crw": "raw",
    ".gpr": "raw", ".3fr": "raw", ".fff": "raw", ".iiq": "raw", ".erf": "raw",
    ".kdc": "raw", ".dcr": "raw", ".mrw": "raw", ".mos": "raw", ".raw": "raw",
    ".srw": "raw", ".x3f": "raw", ".mef": "raw", ".jpg": "jpeg", ".jpeg": "jpeg",
    ".jpe": "jpeg", ".heic": "heif", ".heif": "heif", ".hif": "heif",
    ".tif": "other", ".tiff": "other", ".png": "other", ".webp": "other",
    ".avif": "other", ".jxl": "other", ".insp": "other",
}
# Explicit allowlist prevents GPS and hidden location tags from reaching storage.
EXIF_TAGS = (
    "DateTimeOriginal", "SubSecDateTimeOriginal", "CreateDate",
    "Make", "Model", "LensModel", "LensID", "LensMake", "ISO",
    "ExposureTime", "FNumber", "FocalLength", "ImageWidth", "ImageHeight",
    "ExifImageWidth", "ExifImageHeight", "ExposureCompensation", "Flash",
    "WhiteBalance", "FocusMode", "ShutterType", "DriveMode", "PictureStyle",
    "FilmMode", "FilmSimulation", "CreativeLook", "FirmwareVersion",
    "Rating", "ColorSpace", "Software", "MeteringMode", "ExposureProgram",
    "FocalLengthIn35mmFormat", "ImageQuality", "HighISONoiseReduction",
    "Stabilization", "AFMode", "HDR", "DigitalZoomRatio",
)
# Store EXIF details not already materialized in dedicated typed columns.
EXIF_STRUCTURED_TAGS = {
    "DateTimeOriginal", "CreateDate", "Make", "Model", "LensModel", "ISO",
    "ExposureTime", "FNumber", "FocalLength", "ImageWidth", "ImageHeight",
    "ExifImageWidth", "ExifImageHeight", "ExposureCompensation", "Flash",
    "WhiteBalance", "FocusMode", "ShutterType", "DriveMode", "PictureStyle",
    "FilmMode", "FilmSimulation", "CreativeLook", "FirmwareVersion",
    "Rating", "ColorSpace", "Software",
}
EXIF_EXTENSION_TAGS = frozenset(EXIF_TAGS) - EXIF_STRUCTURED_TAGS

# Consistent 35mm-equivalent focal length for analytics AND cross-filters.
# Prefer camera-reported EXIF; fall back only for unambiguous camera families.
# Unknown-sensor cameras remain NULL, never silently treated as full frame.
_FOCAL_MODEL = "UPPER(COALESCE(camera_model,''))"
_FOCAL_MAKE = "UPPER(COALESCE(camera_make,''))"
CROP_FACTOR_SQL = f"""CASE
  WHEN {_FOCAL_MODEL} LIKE 'ILCE-7%' OR {_FOCAL_MODEL} LIKE 'ILCE-9%'
       OR {_FOCAL_MODEL} LIKE 'ILCE-1' OR {_FOCAL_MODEL} LIKE 'ZV-E1%'
       OR {_FOCAL_MODEL} LIKE 'DSC-RX1%' THEN 1.0
  WHEN {_FOCAL_MODEL} LIKE 'ILCE-6%' OR {_FOCAL_MODEL} LIKE 'ILCE-5%'
       OR {_FOCAL_MODEL} LIKE 'ZV-E10%' OR {_FOCAL_MODEL} LIKE 'NEX-%' THEN 1.5
  WHEN {_FOCAL_MODEL} LIKE 'X100%' OR {_FOCAL_MODEL} LIKE 'X-T%'
       OR {_FOCAL_MODEL} LIKE 'X-H%' OR {_FOCAL_MODEL} LIKE 'X-E%'
       OR {_FOCAL_MODEL} LIKE 'X-S%' OR {_FOCAL_MODEL} LIKE 'X-PRO%' THEN 1.5
  WHEN {_FOCAL_MODEL} LIKE 'GFX%' THEN 0.79
  WHEN ({_FOCAL_MAKE} LIKE 'OLYMPUS%' OR {_FOCAL_MAKE} LIKE 'OM DIGITAL%')
       AND ({_FOCAL_MODEL} LIKE 'E-%' OR {_FOCAL_MODEL} LIKE 'OM-%'
            OR {_FOCAL_MODEL} LIKE 'PEN-%') THEN 2.0
  WHEN ({_FOCAL_MAKE} LIKE 'PANASONIC%' OR {_FOCAL_MAKE} LIKE 'LEICA%')
       AND ({_FOCAL_MODEL} LIKE 'DC-G%' OR {_FOCAL_MODEL} LIKE 'DMC-G%'
            OR {_FOCAL_MODEL} LIKE 'DMC-GH%' OR {_FOCAL_MODEL} LIKE 'DMC-GX%') THEN 2.0
  WHEN {_FOCAL_MODEL} LIKE 'DC-S%' OR {_FOCAL_MODEL} LIKE 'LEICA SL%' THEN 1.0
  WHEN {_FOCAL_MODEL} LIKE 'NIKON Z F%' OR {_FOCAL_MODEL} LIKE 'NIKON Z 5%'
       OR {_FOCAL_MODEL} LIKE 'NIKON Z 6%' OR {_FOCAL_MODEL} LIKE 'NIKON Z 7%'
       OR {_FOCAL_MODEL} LIKE 'NIKON Z 8%' OR {_FOCAL_MODEL} LIKE 'NIKON Z 9%'
       OR {_FOCAL_MODEL} LIKE 'NIKON Z 30%' OR {_FOCAL_MODEL} LIKE 'NIKON Z 50%'
       OR {_FOCAL_MODEL} LIKE 'NIKON Z FC%' THEN
       CASE WHEN {_FOCAL_MODEL} LIKE 'NIKON Z 30%' OR {_FOCAL_MODEL} LIKE 'NIKON Z 50%'
                 OR {_FOCAL_MODEL} LIKE 'NIKON Z FC%' THEN 1.5 ELSE 1.0 END
  WHEN {_FOCAL_MODEL} LIKE 'CANON EOS R7%' OR {_FOCAL_MODEL} LIKE 'CANON EOS R10%'
       OR {_FOCAL_MODEL} LIKE 'CANON EOS R50%' OR {_FOCAL_MODEL} LIKE 'CANON EOS R100%'
       OR {_FOCAL_MODEL} LIKE 'CANON EOS M%' THEN 1.6
  WHEN {_FOCAL_MODEL} LIKE 'CANON EOS R5%' OR {_FOCAL_MODEL} LIKE 'CANON EOS R6%'
       OR {_FOCAL_MODEL} LIKE 'CANON EOS R8%' OR {_FOCAL_MODEL} LIKE 'CANON EOS R3%'
       OR {_FOCAL_MODEL} LIKE 'CANON EOS R1%' OR {_FOCAL_MODEL} LIKE 'CANON EOS RP%'
       THEN 1.0
  ELSE NULL END"""
# SQLite JSON1 is present in supported Python builds. Keep all JSON paths static.
_EXPLICIT_EQ = """CASE WHEN json_valid(tags_json)
    THEN CAST(json_extract(tags_json, '$.FocalLengthIn35mmFormat') AS REAL)
    ELSE NULL END"""
FOCAL_EQ_SQL = (f"""CASE
  WHEN {_EXPLICIT_EQ} > 0 AND {_EXPLICIT_EQ} < 5000 THEN {_EXPLICIT_EQ}
  WHEN focal_mm > 0 AND focal_mm < 5000 AND ({CROP_FACTOR_SQL}) > 0
    THEN focal_mm * ({CROP_FACTOR_SQL})
  ELSE NULL END""")
FOCAL_EQ_SOURCE_SQL = (f"""CASE
  WHEN {_EXPLICIT_EQ} > 0 AND {_EXPLICIT_EQ} < 5000 THEN 'EXIF'
  WHEN focal_mm > 0 AND focal_mm < 5000 AND ({CROP_FACTOR_SQL}) > 0
    THEN 'camera_profile'
  ELSE 'unknown' END""")

COLUMNS = (
    "source_id", "relpath", "filename", "ext", "format_family", "size_bytes",
    "mtime_ns", "capture_key", "shot_at", "camera_make", "camera_model",
    "camera_norm", "lens_model", "lens_norm", "iso", "aperture", "shutter",
    "focal_mm", "width_px", "height_px", "exposure_comp", "flash", "wb",
    "focus_mode", "shutter_type", "drive_mode", "picture_style", "firmware",
    "rating", "color_space", "software", "tags_json", "parse_status",
    "present", "updated_at",
)
FIELDS: dict[str, tuple[str, str, str]] = {
    "capture.year": ("substr(shot_at,1,4)", "enum", "拍摄年份"),
    "capture.month": ("substr(shot_at,1,7)", "enum", "拍摄年月"),
    "capture.date": ("substr(shot_at,1,10)", "date", "拍摄日期"),
    "capture.hour": ("substr(shot_at,12,2)", "enum", "拍摄小时"),
    "capture.weekday": ("(CAST(strftime('%w',shot_at) AS INTEGER)+6)%7", "number", "星期（周一为0）"),
    "camera.make": ("camera_make", "enum", "相机品牌"),
    "camera.model_norm": ("camera_norm", "enum", "相机型号"),
    "lens.model_norm": ("lens_norm", "enum", "镜头型号"),
    "files.format_family": ("format_family", "enum", "格式大类"),
    "files.extension": ("ext", "enum", "扩展名"),
    "files.filename": ("filename", "enum", "文件名"),
    "files.relpath": ("relpath", "enum", "相对路径"),
    "files.source_id": ("source_id", "enum", "扫描来源"),
    "files.size_bytes": ("size_bytes", "number", "文件大小（字节）"),
    "files.width_px": ("width_px", "number", "宽度（像素）"),
    "files.height_px": ("height_px", "number", "高度（像素）"),
    "files.megapixels": ("(width_px*height_px/1000000.0)", "number", "分辨率（MP）"),
    "files.parse_status": ("parse_status", "enum", "解析状态"),
    "exposure.iso": ("iso", "number", "ISO"),
    "exposure.aperture": ("aperture", "number", "光圈 F"),
    "exposure.shutter": ("shutter", "number", "快门（秒）"),
    "exposure.focal_mm": ("focal_mm", "number", "焦距（mm）"),
    "exposure.focal_eq_mm": (FOCAL_EQ_SQL, "number", "35mm 等效焦距（mm）"),
    "exposure.compensation": ("exposure_comp", "number", "曝光补偿（EV）"),
    "exposure.flash": ("flash", "enum", "闪光"),
    "camera.focus_mode": ("focus_mode", "enum", "对焦模式"),
    "camera.white_balance": ("wb", "enum", "白平衡模式"),
    "camera.shutter_type": ("shutter_type", "enum", "快门类型"),
    "camera.drive_mode": ("drive_mode", "enum", "驱动模式"),
    "camera.picture_style": ("picture_style", "enum", "机内色彩风格"),
    "files.color_space": ("color_space", "enum", "色彩空间"),
    "files.software": ("software", "enum", "处理软件"),
}
OPS = {"eq", "ne", "in", "not_in", "gte", "gt", "lte", "lt", "between",
       "contains", "not_contains", "is_missing", "is_present"}
SCAN_LOCK = threading.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def rows(sql: str, args: tuple[Any, ...] = ()) -> list[dict]:
    with connect() as db:
        return [dict(x) for x in db.execute(sql, args)]


def allowed_path(value: str) -> str:
    if not value or not value.startswith("/") or "\0" in value or ".." in value.split("/"):
        raise ValueError("目录必须是 Docker 容器内的绝对路径，且不能包含 ..")
    norm = posixpath.normpath(value)
    allow = [posixpath.normpath(x.strip()) for x in
             os.environ.get("PHOTO_DATA_ALLOWED_ROOTS", "").split(",") if x.strip()]
    if not allow or not any(root != "/" and (norm == root or norm.startswith(root + "/")) for root in allow):
        raise ValueError("目录不在 PHOTO_DATA_ALLOWED_ROOTS 允许范围内；请先配置只读 Docker 挂载")
    if norm.startswith(("/proc/", "/sys/", "/app/data/")) or norm in ("/", "/proc", "/sys", "/app/data"):
        raise ValueError("不能索引应用数据目录或系统目录")
    return norm


def get_sources() -> list[dict]:
    return rows("SELECT * FROM sources ORDER BY created_at")


def add_source(data: dict) -> dict:
    root = allowed_path(data.get("root_path", ""))
    name = str(data.get("name") or root).strip()[:120]
    source_id = str(uuid.uuid4())
    try:
        with connect() as db:
            db.execute("INSERT INTO sources(id,name,root_path,created_at) VALUES(?,?,?,?)",
                       (source_id, name, root, now()))
    except sqlite3.IntegrityError as exc:
        raise ValueError("该扫描目录已经添加") from exc
    return next(x for x in get_sources() if x["id"] == source_id)


def delete_source(source_id: str) -> None:
    with connect() as db:
        if db.execute("SELECT 1 FROM scan_runs WHERE status IN ('queued','running')").fetchone():
            raise ValueError("扫描进行中，不能删除来源")
        if not db.execute("SELECT 1 FROM sources WHERE id=?", (source_id,)).fetchone():
            raise LookupError("来源不存在")
        db.execute("DELETE FROM photos WHERE source_id=?", (source_id,))
        db.execute("DELETE FROM sources WHERE id=?", (source_id,))


def normalize_camera(make: Any, model: Any) -> str | None:
    if not model:
        return None
    maker = str(make or "").strip().lower().replace("corporation", "").replace("imaging", "").strip()
    if "sony" in maker: maker = "sony"
    elif "olympus" in maker or "om digital" in maker: maker = "olympus"
    elif "fujifilm" in maker: maker = "fujifilm"
    elif "nikon" in maker: maker = "nikon"
    elif "panasonic" in maker: maker = "panasonic"
    elif "canon" in maker: maker = "canon"
    elif "dji" in maker: maker = "dji"
    elif "pentax" in maker: maker = "pentax"
    elif "ricoh" in maker: maker = "ricoh"
    elif "leica" in maker: maker = "leica"
    model_key = re.sub(r"\s+", " ", str(model).strip().lower())
    if maker == "sony": model_key = model_key.replace("sony ", "")
    if maker == "fujifilm": model_key = model_key.replace("fujifilm ", "")
    if maker == "nikon": model_key = model_key.replace("nikon ", "")
    return (maker + ":" if maker else "") + model_key


def number(value: Any) -> float | None:
    if value is None or value == "": return None
    try:
        if isinstance(value, str) and "/" in value:
            a, b = value.split("/", 1)
            n = float(a) / float(b)
        else:
            n = float(value)
        return n if -1e15 < n < 1e15 else None
    except (ValueError, ZeroDivisionError, TypeError):
        return None


def parse_time(value: Any) -> str | None:
    if not value: return None
    match = re.match(r"^(\d{4})[:\-](\d{2})[:\-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})", str(value))
    if not match: return None
    try:
        return datetime(*map(int, match.groups())).isoformat()
    except ValueError:
        return None


def sanitize_tags(tags: dict) -> dict:
    # ExifTool is explicitly asked for only these tags. Never persist unknown tags.
    return {key: val for key, val in tags.items()
            if key in EXIF_TAGS and isinstance(val, (str, int, float, bool, type(None)))}


def metadata(tags: dict, relpath: str, size: int, mtime_ns: int, source_id: str) -> dict:
    tags = sanitize_tags(tags)
    shot = parse_time(tags.get("SubSecDateTimeOriginal") or tags.get("DateTimeOriginal")
                      or tags.get("CreateDate"))
    ext = Path(relpath).suffix.lower()
    make = tags.get("Make")
    model = tags.get("Model")
    camera = normalize_camera(make, model)
    lens = str(tags["LensModel"]).strip() if tags.get("LensModel") else None
    lens_norm = lens.lower() if lens else None
    parent = posixpath.dirname(relpath)
    stem = Path(relpath).stem.lower()
    # Multiple independently taken files keep different stems (e.g. bursts).
    key = json.dumps([source_id, parent, stem, camera, (shot or "")[:19]], ensure_ascii=False)
    return {
        "source_id": source_id, "relpath": relpath, "filename": posixpath.basename(relpath),
        "ext": ext, "format_family": IMAGE_EXT[ext], "size_bytes": size,
        "mtime_ns": mtime_ns, "capture_key": key, "shot_at": shot,
        "camera_make": str(make) if make else None,
        "camera_model": str(model) if model else None, "camera_norm": camera,
        "lens_model": lens, "lens_norm": lens_norm,
        "iso": number(tags.get("ISO")), "aperture": number(tags.get("FNumber")),
        "shutter": number(tags.get("ExposureTime")),
        "focal_mm": number(tags.get("FocalLength")),
        "width_px": number(tags.get("ExifImageWidth") or tags.get("ImageWidth")),
        "height_px": number(tags.get("ExifImageHeight") or tags.get("ImageHeight")),
        "exposure_comp": number(tags.get("ExposureCompensation")),
        "flash": str(tags["Flash"]) if tags.get("Flash") is not None else None,
        "wb": str(tags["WhiteBalance"]) if tags.get("WhiteBalance") is not None else None,
        "focus_mode": str(tags["FocusMode"]) if tags.get("FocusMode") is not None else None,
        "shutter_type": str(tags["ShutterType"]) if tags.get("ShutterType") is not None else None,
        "drive_mode": str(tags["DriveMode"]) if tags.get("DriveMode") is not None else None,
        "picture_style": str(tags.get("FilmSimulation") or tags.get("CreativeLook")
                             or tags.get("PictureStyle") or tags.get("FilmMode") or "") or None,
        "firmware": str(tags["FirmwareVersion"]) if tags.get("FirmwareVersion") else None,
        "rating": number(tags.get("Rating")),
        "color_space": str(tags["ColorSpace"]) if tags.get("ColorSpace") else None,
        "software": str(tags["Software"]) if tags.get("Software") else None,
        "tags_json": json.dumps({key: value for key, value in tags.items() if key in EXIF_EXTENSION_TAGS}, ensure_ascii=False),
        "parse_status": "ok", "present": 1, "updated_at": now(),
    }


def extract_batch(paths: list[str]) -> list[dict]:
    args = ["exiftool", "-j", "-n", "-q", "-q", "-charset", "filename=utf8"]
    args.extend("-" + tag for tag in EXIF_TAGS)
    args.extend(paths)  # absolute paths; no shell expansion and no "-" leading filenames
    try:
        result = subprocess.run(args, capture_output=True, timeout=max(60, len(paths) * 6), check=False)
        if result.returncode not in (0, 1):
            raise RuntimeError("ExifTool exited with code " + str(result.returncode))
        parsed = json.loads(result.stdout.decode("utf-8", errors="replace"))
        if not isinstance(parsed, list) or len(parsed) != len(paths):
            raise RuntimeError("ExifTool returned an unexpected file count")
        return parsed
    except (subprocess.TimeoutExpired, json.JSONDecodeError, UnicodeError, OSError) as exc:
        raise RuntimeError("ExifTool batch failed: " + str(exc)) from exc


def _run_update(db: sqlite3.Connection, run_id: str, **kwargs: Any) -> None:
    if not kwargs: return
    keys = list(kwargs)
    db.execute("UPDATE scan_runs SET " + ", ".join(k + "=?" for k in keys) + " WHERE id=?",
               (*[kwargs[k] for k in keys], run_id))


def launch_scan(source_ids: list[str] | None = None, deep: bool = False,
                confirm_large_removal: bool = False) -> str:
    if not MAINTENANCE_LOCK.acquire(blocking=False):
        raise ValueError("数据库维护或迁移正在执行，不能开始扫描")
    try:
        with SCAN_LOCK:
            with connect() as db:
                selected = db.execute("SELECT id FROM sources WHERE enabled=1 ORDER BY created_at").fetchall()
                available = {x["id"] for x in selected}
                targets = list(dict.fromkeys(source_ids if source_ids is not None else list(available)))
                if not targets or any(source not in available for source in targets):
                    raise ValueError("没有已启用的有效扫描来源")
                run_id = str(uuid.uuid4())
                try:
                    db.execute(
                        "INSERT INTO scan_runs(id,started_at,status,mode,source_ids) VALUES(?,?,?,?,?)",
                        (run_id, now(), "queued", "deep" if deep else "incremental",
                         json.dumps(targets))
                    )
                except sqlite3.IntegrityError as exc:
                    raise ValueError("已有扫描作业正在执行") from exc
    finally:
        MAINTENANCE_LOCK.release()
    from .scanner import scan_worker
    threading.Thread(target=scan_worker, args=(run_id, targets, deep, confirm_large_removal),
                     daemon=True, name="photo-scan-" + run_id[:8]).start()
    return run_id


# All source traversal and metadata extraction lives in scanner.scan_worker.

def get_scan(run_id: str) -> dict:
    result = rows("SELECT * FROM scan_runs WHERE id=?", (run_id,))
    if not result: raise LookupError("扫描任务不存在")
    return result[0]


def cancel_scan(run_id: str) -> dict:
    with connect() as db:
        db.execute("UPDATE scan_runs SET cancel_requested=1 WHERE id=? AND status IN ('queued','running')", (run_id,))
    return get_scan(run_id)


def status() -> dict:
    scans = rows("SELECT * FROM scan_runs ORDER BY started_at DESC LIMIT 10")
    sources = get_sources()
    return {"sources": sources, "recent_scans": scans,
            "last_success": max((x["last_success"] for x in sources if x["last_success"]), default=None)}


def field_registry() -> list[dict]:
    return [{"field_id": fid, "label": label, "value_type": kind, "operators":
             sorted(OPS), "scope": "file", "nullable": True}
            for fid, (_, kind, label) in FIELDS.items()]


def _where_node(node: dict, params: list, depth: int = 0) -> str:
    if not isinstance(node, dict): raise ValueError("筛选规则必须是对象")
    if depth > 5: raise ValueError("筛选规则嵌套过深")
    if "group" in node and isinstance(node["group"], dict):
        return _where_node(node["group"], params, depth + 1)
    if "children" in node:
        op = node.get("op")
        kids = node["children"]
        if op not in ("and", "or", "not") or not isinstance(kids, list) or len(kids) > 50:
            raise ValueError("无效的条件组合")
        if op == "not":
            if len(kids) != 1: raise ValueError("NOT 条件必须且只能包含一条子规则")
            return "NOT (" + _where_node(kids[0], params, depth + 1) + ")"
        return "(" + (" AND " if op == "and" else " OR ").join(
            _where_node(x, params, depth + 1) for x in kids) + ")" if kids else "1=1"
    field = node.get("field")
    op = node.get("op")
    if field not in FIELDS or op not in OPS: raise ValueError("不支持的筛选字段或操作符")
    col, kind, _ = FIELDS[field]
    if op == "is_missing": return col + " IS NULL"
    if op == "is_present": return col + " IS NOT NULL"
    value = node.get("value")
    if op in ("in", "not_in"):
        if not isinstance(value, list) or not value or len(value) > 500: raise ValueError("IN 条件必须提供1至500项")
        if any(not isinstance(v, (str,int,float)) for v in value): raise ValueError("IN 条件值无效")
        if kind == "number" and any(not isinstance(v, (int, float)) or isinstance(v, bool) for v in value):
            raise ValueError("数值字段必须使用数字比较")
        params.extend(value)
        return col + (" IN " if op == "in" else " NOT IN ") + "(" + ",".join("?" for _ in value) + ")"
    if op == "between":
        if not isinstance(value, list) or len(value) != 2: raise ValueError("between 需要两个端点")
        if any(not isinstance(v, (str, int, float)) or isinstance(v, bool) for v in value):
            raise ValueError("between 端点值无效")
        if kind == "number" and any(not isinstance(v, (int, float)) for v in value):
            raise ValueError("数值字段必须使用数字比较")
        params.extend(value)
        return "(" + col + " BETWEEN ? AND ?)"
    if isinstance(value, (dict, list)) or value is None or len(str(value)) > 256:
        raise ValueError("无效的筛选条件值")
    if kind == "number" and (not isinstance(value, (int,float)) or isinstance(value,bool)):
        raise ValueError("数值字段必须使用数字比较")
    if op in ("contains", "not_contains"):
        if kind == "number": raise ValueError("数值字段不能执行文本搜索")
        escaped = str(value).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        params.append("%" + escaped + "%")
        return col + (" NOT LIKE ? ESCAPE '\\'" if op == "not_contains" else " LIKE ? ESCAPE '\\'")
    params.append(value)
    return col + {"eq":" = ?","ne":" != ?","gte":" >= ?","gt":" > ?","lte":" <= ?","lt":" < ?"}[op]


def compile_filter(filter_ast: dict | None) -> tuple[str, list]:
    if not filter_ast: return "present=1", []
    if filter_ast.get("version") not in ("photo-filter.v1", None):
        raise ValueError("未知的筛选协议版本")
    params: list = []
    # Bound AST size, not only tree depth.
    if len(json.dumps(filter_ast, ensure_ascii=False)) > 15000:
        raise ValueError("筛选条件太长")
    sql = _where_node(filter_ast.get("group", filter_ast), params)
    return "(present=1) AND (" + sql + ")", params


def query(filter_ast: dict | None = None, limit: int = 100, offset: int = 0) -> dict:
    if not 1 <= limit <= 500 or offset < 0 or offset > 10000000:
        raise ValueError("分页范围无效")
    where, params = compile_filter(filter_ast)
    with connect() as db:
        total = db.execute("SELECT COUNT(*) FROM photos WHERE " + where, params).fetchone()[0]
        captures = db.execute("SELECT COUNT(DISTINCT capture_key) FROM photos WHERE " + where, params).fetchone()[0]
        data = [dict(r) for r in db.execute(
            "SELECT id,source_id,relpath,filename,ext,format_family,size_bytes,shot_at,"
            "camera_make,camera_model,camera_norm,lens_model,lens_norm,iso,aperture,shutter,"
            "focal_mm,width_px,height_px,parse_status FROM photos WHERE " + where +
            " ORDER BY COALESCE(shot_at,updated_at) DESC,id DESC LIMIT ? OFFSET ?",
            (*params, limit, offset))]
    return {"total_files": total, "total_captures": captures, "items": data,
            "limit": limit, "offset": offset, "as_of": status()["last_success"]}


def facets(filter_ast: dict | None, field_id: str, limit: int = 100) -> dict:
    if field_id not in FIELDS or not 1 <= limit <= 200:
        raise ValueError("无效的分面字段或大小")
    compile_filter(filter_ast)
    # Removing a top-level column predicate gives Lightroom-style self-excluding facets.
    filter_copy = json.loads(json.dumps(filter_ast)) if filter_ast else {}
    group = filter_copy.get("group")
    if isinstance(group, dict) and group.get("op") == "and":
        group["children"] = [x for x in group.get("children", []) if
                             x.get("field") != field_id and x.get("column_id") != field_id]
    where, params = compile_filter(filter_copy)
    col, _, _ = FIELDS[field_id]
    with connect() as db:
        values = [dict(r) for r in db.execute(
            "SELECT " + col + " AS value,COUNT(DISTINCT capture_key) AS count "
            "FROM photos WHERE " + where + " GROUP BY " + col +
            " ORDER BY count DESC,value LIMIT ?", (*params, limit))]
    return {"field": field_id, "options": values}


def summary(filter_ast: dict | None = None) -> dict:
    where, params = compile_filter(filter_ast)
    with connect() as db:
        row = db.execute(
            "SELECT COUNT(*) AS physical_files,COUNT(DISTINCT capture_key) AS logical_captures,"
            "COALESCE(SUM(size_bytes),0) AS total_bytes,"
            "SUM(CASE WHEN format_family='raw' THEN 1 ELSE 0 END) AS raw_files,"
            "MIN(shot_at) AS first_shot,MAX(shot_at) AS last_shot "
            "FROM photos WHERE " + where, params).fetchone()
        years = [dict(x) for x in db.execute(
            "SELECT substr(shot_at,1,7) AS month,COUNT(DISTINCT capture_key) AS count "
            "FROM photos WHERE " + where + " AND shot_at IS NOT NULL "
            "GROUP BY month ORDER BY month", params)]
    return {**dict(row), "months": years, "as_of": status()["last_success"]}


def leaderboard(kind: str = "camera", filter_ast: dict | None = None, limit: int = 100,
                ascending: bool = False) -> dict:
    if kind not in ("camera", "lens") or not 1 <= limit <= 500: raise ValueError("无效榜单类型")
    col = "camera_norm" if kind == "camera" else "lens_norm"
    where, params = compile_filter(filter_ast)
    with connect() as db:
        all_count = db.execute("SELECT COUNT(DISTINCT capture_key) FROM photos WHERE " + where, params).fetchone()[0]
        attributed = db.execute("SELECT COUNT(DISTINCT capture_key) FROM photos WHERE " + where +
                                " AND " + col + " IS NOT NULL", params).fetchone()[0]
        records = [dict(x) for x in db.execute(
            "SELECT " + col + " AS canonical_key,COUNT(DISTINCT capture_key) AS capture_count,"
            "COUNT(DISTINCT substr(shot_at,1,10)) AS active_days,"
            "MIN(shot_at) AS first_shot_at,MAX(shot_at) AS last_shot_at "
            "FROM photos WHERE " + where + " AND " + col + " IS NOT NULL "
            "GROUP BY " + col + " ORDER BY capture_count " + ("ASC" if ascending else "DESC") +
            ",canonical_key LIMIT ?", (*params, limit))]
    for i, item in enumerate(records):
        item["rank"] = i + 1
        item["name"] = item["canonical_key"]
        item["usage_share"] = item["capture_count"] / attributed if attributed else 0
    return {"items": records, "total_captures": all_count,
            "attributable_captures": attributed, "unknown_captures": all_count - attributed,
            "kind": kind, "as_of": status()["last_success"]}


def presets() -> list[dict]:
    return [{"id":r["id"], "name":r["name"], "filter":json.loads(r["filter_json"]),
             "columns":json.loads(r["columns_json"])} for r in rows(
                 "SELECT * FROM filter_presets ORDER BY updated_at DESC")]


def save_preset(name: str, filter_ast: dict, columns: list) -> dict:
    compile_filter(filter_ast)
    if not name.strip() or len(name)>120 or not isinstance(columns, list) or len(columns)>8:
        raise ValueError("无效的预设名称或列布局")
    new_id = str(uuid.uuid4())
    with connect() as db:
        db.execute("INSERT INTO filter_presets VALUES(?,?,?,?,?)",
                   (new_id,name.strip(),json.dumps(filter_ast),json.dumps(columns),now()))
    return {"id":new_id, "name":name, "filter":filter_ast, "columns":columns}


def remove_preset(preset_id: str) -> None:
    with connect() as db:
        db.execute("DELETE FROM filter_presets WHERE id=?", (preset_id,))


def export_zip(filter_ast: dict | None) -> bytes:
    where, params = compile_filter(filter_ast)
    result = io.BytesIO()
    columns = ("id","source_id","relpath","filename","format_family","size_bytes",
               "shot_at","camera_norm","lens_norm","iso","aperture","shutter",
               "focal_mm","width_px","height_px","parse_status","capture_key")
    with zipfile.ZipFile(result,"w",compression=zipfile.ZIP_DEFLATED) as output:
        output.writestr("manifest.json",json.dumps({
            "format":"geargrade.photo-data.v1","exported_at":now(),
            "as_of":status()["last_success"],"gps_included":False,
            "fields":list(columns)},ensure_ascii=False,indent=2))
        with connect() as db:
            cursor = db.execute("SELECT "+",".join(columns)+" FROM photos WHERE "+where+
                                " ORDER BY id",params)
            part = []
            n = 0
            while batch := cursor.fetchmany(1000):
                for r in batch:
                    obj=dict(r)
                    obj.pop("relpath",None)  # export privacy by default
                    obj.pop("filename",None)
                    part.append(json.dumps(obj,ensure_ascii=False))
                    n += 1
                if len(part)>=10000:
                    output.writestr("photos-%05d.jsonl"% (n//10000),"\n".join(part)+"\n")
                    part.clear()
            if part: output.writestr("photos-last.jsonl","\n".join(part)+"\n")
        output.writestr("summary.json",json.dumps(summary(filter_ast),ensure_ascii=False,indent=2))
    return result.getvalue()
