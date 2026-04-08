import { useState } from "react";

import { exportData, importData } from "../api/data";
import { useDashboardSummary } from "../components/layout/DashboardSummaryProvider";
import type { DataImportResponse, DevicePayload } from "../types/device";


function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}


export default function DataToolsPage() {
  const { refreshSummary } = useDashboardSummary();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [result, setResult] = useState<DataImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">数据工具</div>
        <h1 className="mt-1 text-3xl font-semibold text-textPrimary">导入与导出</h1>
        <p className="mt-2 text-sm text-textSecondary">
          结构化导出当前数据库内容，或导入 JSON 数据文件。导入采用先去重再追加的策略。
        </p>
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导出</div>
          <h2 className="mt-2 text-xl font-semibold text-textPrimary">导出结构化 JSON</h2>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            导出的结构与导入模板一致，适合交给 AI 扩写、整理后再导回系统。
          </p>
          <button className="button-primary mt-5" type="button" onClick={handleExport} disabled={busy !== null}>
            {busy === "export" ? "导出中..." : "导出当前数据库"}
          </button>
        </div>

        <div className="panel p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导入</div>
          <h2 className="mt-2 text-xl font-semibold text-textPrimary">导入 JSON 文件</h2>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            只接受结构化 JSON。重复记录会按品牌、名称、购入次数、购入日期组合键跳过。
          </p>
          <input
            className="field mt-5"
            type="file"
            accept="application/json"
            onChange={(event) => handleImport(event.target.files?.[0] ?? null)}
            disabled={busy !== null}
          />
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
    </div>
  );
}
