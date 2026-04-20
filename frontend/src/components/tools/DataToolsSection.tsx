import { useState } from "react";

import { exportData, importData, resetAllData } from "../../api/data";
import { useDashboardSummary } from "../layout/DashboardSummaryProvider";
import type { DataImportResponse, DataResetResponse, DevicePayload } from "../../types/device";


function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataToolsSection() {
  const { refreshSummary } = useDashboardSummary();
  const [busy, setBusy] = useState<"export" | "import" | "reset" | null>(null);
  const [result, setResult] = useState<DataImportResponse | null>(null);
  const [resetResult, setResetResult] = useState<DataResetResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");

  async function handleExport() {
    setBusy("export");
    setError(null);
    try {
      const payload = await exportData();
      downloadJson(`geargrade-export-${new Date().toISOString().slice(0, 10)}.json`, payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File | null) {
    if (!file) return;
    setBusy("import");
    setError(null);
    setResult(null);
    setResetResult(null);
    setSelectedFileName(file.name);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { items?: DevicePayload[] } | DevicePayload[];
      const items = Array.isArray(parsed) ? parsed : parsed.items;
      if (!items || !Array.isArray(items)) {
        throw new Error("导入文件格式无效，必须是 { items: [...] } 或数组。");
      }
      const response = await importData(items);
      setResult(response);
      if (response.created > 0) {
        await refreshSummary();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handleResetAdvance() {
    setError(null);
    setResult(null);

    if (resetStep < 4) {
      setResetStep((current) => current + 1);
      return;
    }

    setBusy("reset");
    try {
      const response = await resetAllData();
      setResetResult(response);
      setResetStep(0);
      await refreshSummary();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置失败。");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="data-tools" className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">数据工具</div>
        <h2 className="mt-1 text-2xl font-semibold text-textPrimary">导入、导出与重置</h2>
        <p className="mt-2 text-sm leading-6 text-textSecondary">
          这里的导入导出仅针对主设备库，不包含心愿池。重置会清空主设备、心愿池以及本地媒体缓存。
        </p>
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导出</div>
          <h3 className="mt-2 text-xl font-semibold text-textPrimary">导出结构化 JSON</h3>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            导出的结构与导入模板一致，适合交给 AI 整理、补全后再导回系统。
          </p>
          <button className="button-primary mt-5" type="button" onClick={handleExport} disabled={busy !== null}>
            {busy === "export" ? "导出中..." : "导出当前数据"}
          </button>
        </div>

        <div className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导入</div>
          <h3 className="mt-2 text-xl font-semibold text-textPrimary">导入 JSON 文件</h3>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            重复记录会按品牌、名称、购入次数、购入日期组合键跳过，不会覆盖已有数据。
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <label className={`button-secondary cursor-pointer ${busy !== null ? "pointer-events-none opacity-60" : ""}`}>
              选择文件
              <input
                className="sr-only"
                type="file"
                accept=".json,application/json"
                onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
                disabled={busy !== null}
              />
            </label>
            <span className="text-sm text-textSecondary">{selectedFileName || "未选择文件"}</span>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">模板</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <a className="button-secondary justify-center" href="/templates/device-import.template.json" target="_blank" rel="noreferrer">
            查看字段模板
          </a>
          <a className="button-secondary justify-center" href="/templates/device-import.example.json" target="_blank" rel="noreferrer">
            查看示例数据
          </a>
        </div>
      </section>

      <section className="panel border-danger/30 p-5">
        <div className="text-xs uppercase tracking-[0.22em] text-danger">危险操作</div>
        <h3 className="mt-2 text-xl font-semibold text-textPrimary">重置所有数据</h3>
        <p className="mt-2 text-sm leading-6 text-textSecondary">
          该操作会删除主设备库、心愿池和所有本地媒体文件。必须连续确认 5 次才会真正执行。
        </p>

        {resetStep > 0 ? (
          <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/8 p-4">
            <div className="text-sm text-textPrimary">当前确认进度：{resetStep}/5</div>
            <div className="mt-1 text-sm text-textSecondary">继续点击会推进到下一步，第 5 次才会执行重置。</div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="button-danger"
                disabled={busy === "reset"}
                onClick={handleResetAdvance}
              >
                {busy === "reset" ? "重置中..." : `确认第 ${resetStep + 1} / 5 次`}
              </button>
              <button
                type="button"
                className="button-secondary"
                disabled={busy === "reset"}
                onClick={() => setResetStep(0)}
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="button-danger mt-5"
            disabled={busy !== null}
            onClick={() => {
              setResetResult(null);
              setResetStep(1);
            }}
          >
            重置所有数据
          </button>
        )}
      </section>

      {result ? (
        <section className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导入结果</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">总条数</div>
              <div className="mt-1 text-2xl font-semibold text-textPrimary">{result.total}</div>
            </div>
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">成功新增</div>
              <div className="mt-1 text-2xl font-semibold text-success">{result.created}</div>
            </div>
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">重复跳过</div>
              <div className="mt-1 text-2xl font-semibold text-warning">{result.skipped}</div>
            </div>
          </div>

          {result.errors.length ? (
            <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/8 p-4">
              <div className="text-sm font-medium text-danger">错误记录</div>
              <div className="mt-3 space-y-2 text-sm text-textPrimary">
                {result.errors.map((item) => (
                  <div key={`${item.index}-${item.name ?? "unknown"}`}>
                    第 {item.index + 1} 条 {item.name ? `(${item.name})` : ""}: {item.reason}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {resetResult ? (
        <section className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">重置结果</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">主设备删除</div>
              <div className="mt-1 text-2xl font-semibold text-textPrimary">{resetResult.devices_deleted}</div>
            </div>
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">心愿池删除</div>
              <div className="mt-1 text-2xl font-semibold text-textPrimary">{resetResult.wishlist_deleted}</div>
            </div>
            <div className="rounded-2xl bg-panelAlt p-4">
              <div className="text-sm text-textSecondary">媒体文件删除</div>
              <div className="mt-1 text-2xl font-semibold text-textPrimary">{resetResult.media_files_deleted}</div>
            </div>
          </div>
        </section>
      ) : null}
    </section>
  );
}
