"""Bounded, adaptive read-only parallel metadata extraction.

The coordinator owns SQLite writes; parallel workers *only* invoke ExifTool.
All source filesystem access lives behind an explicit user scan request.
"""
from __future__ import annotations

import json
import os
import shutil
import time
from collections import deque
from concurrent.futures import FIRST_COMPLETED, Future, ThreadPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ScanPlan:
    filesystem: str
    remote: bool
    max_workers: int
    initial_workers: int
    batch_size: int


def choose_scan_plan(root: str, cpu_count: int | None = None,
                     mounts_text: str | None = None) -> ScanPlan:
    """Use mount type + CPU as a conservative baseline; adapt during a scan."""
    cpu = max(1, cpu_count or os.cpu_count() or 2)
    filesystem = "unknown"
    try:
        text = mounts_text if mounts_text is not None else Path("/proc/mounts").read_text(encoding="utf-8")
        longest = -1
        for line in text.splitlines():
            values = line.split()
            if len(values) < 3:
                continue
            mount_point = values[1].replace("\\040", " ")
            if (root == mount_point or root.startswith(mount_point.rstrip("/") + "/")) and len(mount_point) > longest:
                longest = len(mount_point)
                filesystem = values[2].lower()
    except OSError:
        pass
    remote = filesystem in {"nfs", "nfs4", "cifs", "smb3", "fuse.sshfs", "davfs", "9p"}
    cap = min(8, max(1, cpu // 2))
    if remote:
        # Network-mounted RAW archives usually benefit from gentler queue depth.
        cap = min(cap, 4)
        initial = min(cap, 2)
        batch = 24
    else:
        initial = min(cap, 3)
        batch = 48
    return ScanPlan(filesystem, remote, cap, initial, batch)


def _extract_safely(paths: list[str]) -> list[dict[str, Any]]:
    """Retry failed ExifTool batches by bisection to isolate corrupt photos."""
    from . import service

    try:
        parsed = service.extract_batch(paths)
        if len(parsed) != len(paths):
            raise RuntimeError("metadata result count mismatch")
        return [{"tags": item} if not item.get("Error") else
                {"error": str(item.get("Error"))[:240]} for item in parsed]
    except Exception as exc:
        if len(paths) == 1:
            return [{"error": str(exc)[:240]}]
        middle = len(paths) // 2
        return _extract_safely(paths[:middle]) + _extract_safely(paths[middle:])


def _file_iterator(root: str):
    """Enumerate without following symlinked files or directories."""
    stack = [root]
    while stack:
        folder = stack.pop()
        with os.scandir(folder) as entries:
            for entry in entries:
                if entry.is_symlink():
                    continue
                if entry.is_dir(follow_symlinks=False):
                    stack.append(entry.path)
                elif entry.is_file(follow_symlinks=False):
                    yield entry
        yield None  # Directory boundary; used for progress.


def scan_worker(run_id: str, source_ids: list[str], deep: bool, confirm_large: bool) -> None:
    from . import service as s
    from .db import connect

    with connect() as db:
        progress: dict[str, Any] = {
            "seen": 0, "extracted": 0, "unchanged": 0, "failed": 0,
            "processed": 0, "directories_seen": 0, "total_candidates": 0,
            "phase": "preflight", "workers": 0, "active_workers": 0,
            "enumeration_done": 0, "rate_files_per_sec": 0.0,
        }
        scan_started = time.monotonic()
        last_persist = scan_started

        def report(force: bool = False) -> None:
            nonlocal last_persist
            elapsed = max(time.monotonic() - scan_started, 0.001)
            progress["rate_files_per_sec"] = round(progress["processed"] / elapsed, 2)
            if force or time.monotonic() - last_persist >= 0.5:
                s._run_update(db, run_id, **progress)
                db.commit()
                last_persist = time.monotonic()

        def cancelled() -> bool:
            # Progress is committed periodically, so new requests become visible.
            item = db.execute("SELECT cancel_requested FROM scan_runs WHERE id=?", (run_id,)).fetchone()
            return bool(item and item[0])

        try:
            s._run_update(db, run_id, status="running")
            db.commit()
            if not shutil.which("exiftool"):
                raise RuntimeError("ExifTool 尚未安装；请检查 Docker 镜像构建")
            for source_id in source_ids:
                source = db.execute("SELECT * FROM sources WHERE id=?", (source_id,)).fetchone()
                if not source:
                    raise RuntimeError("扫描来源不存在")
                root = s.allowed_path(source["root_path"])
                if os.path.islink(root) or not os.path.isdir(root):
                    raise RuntimeError("照片目录不可访问或不是合法的只读挂载: " + root)
                plan = choose_scan_plan(root)
                progress["workers"] = plan.initial_workers
                progress["active_workers"] = 0
                progress["phase"] = "enumerating"
                progress["enumeration_done"] = 0
                report(True)
                existing = {
                    row["relpath"]: (row["size_bytes"], row["mtime_ns"])
                    for row in db.execute(
                        "SELECT relpath,size_bytes,mtime_ns FROM photos WHERE source_id=?", (source_id,)
                    )
                }
                staged = 0
                recent_batch_durations: deque[float] = deque(maxlen=12)
                failures_since_adjust = 0
                current_limit = plan.initial_workers
                incomplete = False
                pending: list[tuple[str, str, int, int]] = []
                futures: dict[Future, tuple[list[tuple[str, str, int, int]], float]] = {}

                def stage(rel: str, payload: dict) -> None:
                    nonlocal staged
                    db.execute(
                        "INSERT OR REPLACE INTO scan_seen(run_id,source_id,relpath,payload) VALUES(?,?,?,?)",
                        (run_id, source_id, rel, json.dumps(payload, ensure_ascii=False)),
                    )
                    staged += 1
                    progress["processed"] += 1
                    report(staged % 200 == 0)

                def finish_one() -> None:
                    nonlocal failures_since_adjust, current_limit
                    if not futures:
                        return
                    ready, _ = wait(set(futures), return_when=FIRST_COMPLETED)
                    for future in ready:
                        batch, submitted = futures.pop(future)
                        progress["active_workers"] = len(futures)
                        recent_batch_durations.append(max(time.monotonic() - submitted, 0.001))
                        try:
                            items = future.result()
                        except Exception as exc:
                            items = [{"error": str(exc)[:240]} for _ in batch]
                        for (full, rel, size, mtime_ns), record in zip(batch, items):
                            # A concurrent copy/write is not a reliable complete snapshot.
                            try:
                                st = os.stat(full, follow_symlinks=False)
                                if st.st_size != size or st.st_mtime_ns != mtime_ns:
                                    raise RuntimeError("扫描中源文件变化")
                            except OSError as exc:
                                raise RuntimeError("扫描中源文件不可访问: " + rel) from exc
                            if "error" in record:
                                progress["failed"] += 1
                                failures_since_adjust += 1
                                # Keep the previous valid metadata when a file changes but is unreadable.
                                if rel in existing:
                                    stage(rel, {})
                                else:
                                    obj = s.metadata({}, rel, size, mtime_ns, source_id)
                                    obj["parse_status"] = "error"
                                    stage(rel, obj)
                            else:
                                tags = record["tags"]
                                try:
                                    obj = s.metadata(tags, rel, size, mtime_ns, source_id)
                                    stage(rel, obj)
                                    progress["extracted"] += 1
                                except (TypeError, ValueError):
                                    progress["failed"] += 1
                                    if rel in existing:
                                        stage(rel, {})
                                    else:
                                        obj = s.metadata({}, rel, size, mtime_ns, source_id)
                                        obj["parse_status"] = "error"
                                        stage(rel, obj)
                        if len(recent_batch_durations) >= 4:
                            average = sum(recent_batch_durations) / len(recent_batch_durations)
                            if failures_since_adjust > plan.batch_size:
                                current_limit = max(1, current_limit - 1)
                                failures_since_adjust = 0
                            elif average < 9 and current_limit < plan.max_workers:
                                current_limit += 1
                                recent_batch_durations.clear()
                            progress["workers"] = current_limit
                        report()

                def submit_batch(pool: ThreadPoolExecutor) -> None:
                    nonlocal pending
                    if not pending:
                        return
                    batch = pending
                    pending = []
                    future = pool.submit(_extract_safely, [item[0] for item in batch])
                    futures[future] = (batch, time.monotonic())
                    progress["active_workers"] = len(futures)

                with ThreadPoolExecutor(max_workers=plan.max_workers, thread_name_prefix="photo-exif") as pool:
                    for entry in _file_iterator(root):
                        if cancelled():
                            raise InterruptedError("用户取消扫描")
                        if entry is None:
                            progress["directories_seen"] += 1
                            report()
                            continue
                        ext = os.path.splitext(entry.name)[1].lower()
                        if ext not in s.IMAGE_EXT:
                            continue
                        st = entry.stat(follow_symlinks=False)
                        rel = os.path.relpath(entry.path, root).replace(os.sep, "/")
                        progress["seen"] += 1
                        prior = existing.get(rel)
                        if not deep and prior == (st.st_size, st.st_mtime_ns):
                            stage(rel, {})
                            progress["unchanged"] += 1
                        else:
                            progress["total_candidates"] += 1
                            pending.append((entry.path, rel, st.st_size, st.st_mtime_ns))
                            if len(pending) >= plan.batch_size:
                                submit_batch(pool)
                        while len(futures) >= current_limit:
                            finish_one()
                        report()
                    if pending:
                        submit_batch(pool)
                    progress["phase"] = "extracting"
                    progress["enumeration_done"] = 1
                    report(True)
                    while futures:
                        if cancelled():
                            raise InterruptedError("用户取消扫描")
                        finish_one()
                if cancelled():
                    raise InterruptedError("用户取消扫描")
                progress["phase"] = "publishing"
                progress["active_workers"] = 0
                report(True)
                missing = db.execute(
                    "SELECT COUNT(*) FROM photos p WHERE p.source_id=? AND p.present=1 "
                    "AND NOT EXISTS(SELECT 1 FROM scan_seen x WHERE x.run_id=? "
                    "AND x.source_id=p.source_id AND x.relpath=p.relpath)",
                    (source_id, run_id),
                ).fetchone()[0]
                if missing > max(100, int(len(existing) * 0.5)) and not confirm_large:
                    raise RuntimeError(
                        f"本次发现 {missing} 个文件缺失。为防止 NAS 误挂载清空索引，"
                        "请确认后勾选允许大量移除并再次手动扫描。"
                    )
                # A source is published only after every folder is enumerated successfully.
                with db:
                    placeholders = ",".join("?" for _ in s.COLUMNS)
                    setters = ",".join(
                        f"{c}=excluded.{c}" for c in s.COLUMNS if c not in ("source_id", "relpath")
                    )
                    for row in db.execute(
                        "SELECT relpath,payload FROM scan_seen WHERE run_id=? AND source_id=?",
                        (run_id, source_id),
                    ):
                        if row["payload"] == "{}":
                            db.execute(
                                "UPDATE photos SET present=1 WHERE source_id=? AND relpath=?",
                                (source_id, row["relpath"]),
                            )
                        else:
                            item = json.loads(row["payload"])
                            db.execute(
                                "INSERT INTO photos(" + ",".join(s.COLUMNS) + ") VALUES(" +
                                placeholders + ") ON CONFLICT(source_id,relpath) DO UPDATE SET " + setters,
                                tuple(item.get(key) for key in s.COLUMNS),
                            )
                    db.execute(
                        "UPDATE photos SET present=0,updated_at=? WHERE source_id=? AND present=1 "
                        "AND NOT EXISTS(SELECT 1 FROM scan_seen x WHERE x.run_id=? "
                        "AND x.source_id=photos.source_id AND x.relpath=photos.relpath)",
                        (s.now(), source_id, run_id),
                    )
                    db.execute(
                        "UPDATE sources SET last_success=?, last_run_id=? WHERE id=?",
                        (s.now(), run_id, source_id),
                    )
                    progress["removed"] = missing
                    db.execute("DELETE FROM scan_seen WHERE run_id=? AND source_id=?", (run_id, source_id))
                progress["phase"] = "completed_source"
                report(True)
            progress["phase"] = "completed"
            report(True)
            s._run_update(db, run_id, status="completed", ended_at=s.now())
            db.commit()
        except InterruptedError as exc:
            db.rollback()
            s._run_update(db, run_id, status="cancelled", phase="cancelled",
                          ended_at=s.now(), error=str(exc)[:1200])
            db.execute("DELETE FROM scan_seen WHERE run_id=?", (run_id,))
            db.commit()
        except Exception as exc:
            db.rollback()
            s._run_update(db, run_id, status="failed", phase="failed",
                          ended_at=s.now(), error=str(exc)[:1200])
            db.execute("DELETE FROM scan_seen WHERE run_id=?", (run_id,))
            db.commit()
