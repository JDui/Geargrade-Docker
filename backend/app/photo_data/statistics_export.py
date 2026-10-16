"""Portable chart aggregates from one filtered index snapshot."""
from __future__ import annotations

import csv
import io
import json
import zipfile
from typing import Any

from . import service
from .analytics import analyze


def export_statistics(filter_ast: dict | None = None) -> bytes:
    snapshot = analyze(filter_ast)
    # Export the supported charts, excluding legacy undecoded enum series.
    statistics = {**snapshot, "exposure": {
        key: snapshot["exposure"][key]
        for key in ("distributions", "focal_coverage", "iso_shutter", "focal_aperture")
    }, "files": {
        key: value for key, value in snapshot["files"].items()
        if key not in ("orientation", "color_space")
    }}
    condition = filter_ast if filter_ast is not None else {
        "version": "photo-filter.v1", "group": {"op": "and", "children": []}
    }
    tables: list[tuple[str, list[dict], tuple[str, ...]]] = [
        ("overview", [statistics["overview"]], tuple(statistics["overview"])),
        ("quality", statistics["quality"], ("name", "count", "total")),
    ]
    columns = {
        "yearly": ("key", "count"), "monthly": ("key", "count"),
        "daily": ("date", "count"), "hours": ("hour", "count"),
        "weekdays": ("weekday", "count"), "weekday_hour": ("weekday", "hour", "count"),
        "cameras": ("name", "count", "is_other"), "lenses": ("name", "count", "is_other"),
        "makers": ("name", "count", "is_other"),
        "combos": ("camera", "lens", "count"), "lens_by_camera": ("camera", "lens", "count"),
        "camera_years": ("year", "camera", "count"), "lens_years": ("year", "lens", "count"),
        "focal_coverage": ("name", "count"), "iso_shutter": ("x", "y", "count"),
        "focal_aperture": ("x", "y", "count"),
        "formats": ("name", "count", "is_other"), "capture_formats": ("name", "count", "is_other"),
        "size": ("label", "bucket", "count", "min", "max", "field"),
        "resolution": ("label", "bucket", "count", "min", "max", "field"),
        "aspect": ("name", "count"), "status": ("name", "count", "is_other"),
        "software": ("name", "count", "is_other"),
    }
    for section in ("timeline", "gear", "exposure", "files"):
        for name, values in statistics[section].items():
            if name == "distributions":
                for parameter, points in values.items():
                    tables.append((f"exposure/distributions/{parameter}", points,
                                   ("value", "label", "count", "min", "max", "field")))
            else:
                tables.append((f"{section}/{name}", values, columns[name]))

    manifest: dict[str, Any] = {
        "format": "geargrade.photo-statistics.v1", "exported_at": service.now(),
        "as_of": statistics["as_of"], "filter": condition, "gps_included": False,
        "notes": {
            **statistics["notes"],
            "scope": "All chart categories for the supplied filter, independent of file pagination",
            "limits": "Chart Top N limits remain: gear categories 16, makers/software 14, "
                      "annual gear 10 per year, combos 50, matrix pairs 250, occupied dates 20000. "
                      "is_other marks merged omitted categories, not a selectable equipment name.",
            "units": "shutter/min/max: seconds for exposure.shutter; focal: 35mm-equivalent mm; "
                     "size/bytes: bytes; resolution: megapixels; weekday: Monday=0",
            "heatmaps": {
                "iso_shutter": {"x_edges": [200, 800, 3200, 12800], "y_edges_seconds": [0.001, 0.01, 0.1, 1]},
                "focal_aperture": {"x_edges_mm": [24, 50, 100, 200], "y_edges_f_number": [2, 4, 8, 16]},
                "intervals": "Edges define half-open intervals; first and last buckets are open-ended",
            },
            "csv": "UTF-8 with BOM; empty cells represent null. Formula-like text has a leading "
                   "apostrophe for spreadsheet safety; analytics.json retains exact text values.",
        },
        "tables": [{"file": name + ".csv", "rows": len(values), "columns": list(headers),
                    "grain": ("physical_files" if name in (
                        "files/formats", "files/size", "files/status"
                    ) else "mixed_overview" if name == "overview" else "logical_captures")}
                   for name, values, headers in tables],
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("README.md", """# 当前筛选的图表统计

- analytics.json：全部受支持图表的汇总数据；不包含照片明细或原片。
- 各目录 CSV：可直接用 Excel、Numbers 或分析工具打开，UTF-8 编码并带 BOM。
- filter.json：本次全局筛选及文件名/路径搜索条件；导出不限明细当前页。
- manifest.json：导出时间、索引时间、单位、各表字段与统计口径。

器材、时间、曝光、画幅和元数据覆盖率按逻辑拍摄统计，RAW+JPEG 配对去重；
文件格式、体积和解析状态按物理文件统计，overview 同时包含两种口径。
时间按相机 EXIF 本地时间，不推断时区；时间序列仅列有记录的时间点，空档视为零。
快门及对应 min/max 单位为秒，焦距为等效 35mm 毫米，分辨率为百万像素，体积为字节。
weekday 为周一 0 至周日 6；热力图 x/y 是从 0 开始的分桶，边界见 manifest.json。
器材等排名沿用图表的 Top N；is_other=true 表示合并的其余类别，并非实际器材名称。
空单元格代表缺失，不能作为 0；CSV 公式样式文本加前导单引号，JSON 保留原文。
未解码的闪光灯等分类、色彩空间和横竖拍统计不在此包中。
""")
        for name, data in (("manifest.json", manifest), ("filter.json", condition),
                           ("analytics.json", statistics)):
            archive.writestr(name, json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False))
        for name, values, headers in tables:
            content = io.StringIO(newline="")
            writer = csv.DictWriter(content, fieldnames=headers)
            writer.writeheader()
            for row in values:
                writer.writerow({column: _csv_value(row.get(column)) for column in headers})
            archive.writestr(name + ".csv", content.getvalue().encode("utf-8-sig"))
    return output.getvalue()


def _csv_value(value: Any) -> Any:
    if isinstance(value, str) and value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value
