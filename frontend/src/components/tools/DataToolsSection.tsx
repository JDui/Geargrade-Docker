import { useState } from "react";

import { exportGGPack, importGGPack, previewGGPack, resetAllData } from "../../api/data";
import type {
  DataResetResponse,
  GGPack,
  GGPackImportResponse,
  GGPackPreviewResponse,
  GGPackScope,
  GGPackTable,
  GGPackTableName
} from "../../types/device";
import { useDashboardSummary } from "../layout/DashboardSummaryProvider";

type ActiveTab = GGPackTableName | "reset";
type BusyState = "export" | "preview" | "import" | "reset" | null;

const DATA_TABS: Array<{ key: ActiveTab; label: string }> = [
  { key: "devices", label: "主库" },
  { key: "wishlist", label: "心愿池" },
  { key: "reset", label: "重置" }
];

const TABLE_LABELS: Record<GGPackTableName, string> = {
  devices: "主设备库",
  wishlist: "心愿池"
};

const PREVIEW_COLUMNS: Record<GGPackTableName, string[]> = {
  devices: ["name", "brand", "category", "status", "score", "acquisition_iteration", "purchase_date"],
  wishlist: ["name", "brand", "category", "score", "acquisition_iteration", "tags"]
};

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function filenameFor(scope: GGPackScope) {
  const date = new Date().toISOString().slice(0, 10);
  return `geargrade-${scope}-${date}.ggpack.json`;
}

function parseImportPayload(text: string): GGPack {
  const parsed = JSON.parse(text) as Partial<GGPack>;
  if (
    parsed &&
    parsed.format === "geargrade.ggpack.v1" &&
    Array.isArray(parsed.tables) &&
    parsed.tables.every((table) => table && Array.isArray(table.columns) && Array.isArray(table.rows))
  ) {
    return parsed as GGPack;
  }
  throw new Error("导入文件格式无效，必须是 GGPack JSON。");
}

function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => reject(reader.error ?? new Error("读取文件失败。")));
    reader.readAsText(file);
  });
}

function findTable(packagePayload: GGPack | null, tableName: GGPackTableName): GGPackTable | null {
  return packagePayload?.tables.find((table) => table.name === tableName) ?? null;
}

function selectedFromPreview(preview: GGPackPreviewResponse, tableName: GGPackTableName): number[] {
  const table = preview.tables.find((candidate) => candidate.name === tableName);
  return table?.rows.filter((row) => row.action !== "error").map((row) => row.index) ?? [];
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) {
    return value.join(" / ");
  }
  if (value === null || value === undefined || value === "") {
    return "-";
  }
  return String(value);
}

export function DataToolsSection() {
  const { refreshSummary } = useDashboardSummary();
  const [activeTab, setActiveTab] = useState<ActiveTab>("devices");
  const [busy, setBusy] = useState<BusyState>(null);
  const [packagePayload, setPackagePayload] = useState<GGPack | null>(null);
  const [preview, setPreview] = useState<GGPackPreviewResponse | null>(null);
  const [result, setResult] = useState<GGPackImportResponse | null>(null);
  const [resetResult, setResetResult] = useState<DataResetResponse | null>(null);
  const [selection, setSelection] = useState<Partial<Record<GGPackTableName, number[]>>>({});
  const [error, setError] = useState<string | null>(null);
  const [resetStep, setResetStep] = useState(0);
  const [selectedFileName, setSelectedFileName] = useState("");

  const tableName = activeTab === "reset" ? "devices" : activeTab;
  const activePreview = preview?.tables.find((table) => table.name === tableName) ?? null;
  const activeTable = findTable(packagePayload, tableName);
  const selectedRows = selection[tableName] ?? [];
  const previewColumns = activeTable?.columns.filter((column) => PREVIEW_COLUMNS[tableName].includes(column)) ?? [];
  const visibleColumns = previewColumns.length ? previewColumns : PREVIEW_COLUMNS[tableName];

  async function handleExport(scope: GGPackScope) {
    setBusy("export");
    setError(null);
    try {
      const payload = await exportGGPack(scope);
      downloadJson(filenameFor(scope), payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "导出失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handlePreview(file: File | null) {
    if (!file || activeTab === "reset") return;

    setBusy("preview");
    setError(null);
    setResult(null);
    setResetResult(null);
    setSelectedFileName(file.name);

    try {
      const parsed = parseImportPayload(await readFileText(file));
      const nextPreview = await previewGGPack(parsed);
      setPackagePayload(parsed);
      setPreview(nextPreview);
      setSelection({ [tableName]: selectedFromPreview(nextPreview, tableName) });
    } catch (err) {
      setPackagePayload(null);
      setPreview(null);
      setSelection({});
      setError(err instanceof Error ? err.message : "预览失败。");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    if (!packagePayload || activeTab === "reset") return;

    setBusy("import");
    setError(null);
    setResult(null);
    try {
      const response = await importGGPack({
        package: packagePayload,
        mode: "update",
        selection: { [tableName]: selectedRows }
      });
      setResult(response);
      if (response.created > 0 || response.updated > 0) {
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

  function toggleRow(index: number) {
    setSelection((current) => {
      const currentRows = current[tableName] ?? [];
      const nextRows = currentRows.includes(index)
        ? currentRows.filter((candidate) => candidate !== index)
        : [...currentRows, index].sort((left, right) => left - right);
      return { ...current, [tableName]: nextRows };
    });
  }

  return (
    <section id="data-tools" className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {DATA_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={activeTab === tab.key ? "button-primary" : "button-secondary"}
            onClick={() => {
              setActiveTab(tab.key);
              setError(null);
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error ? <div className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-danger">{error}</div> : null}

      {activeTab !== "reset" ? (
        <>
          <section className="grid gap-6 lg:grid-cols-2">
            <div className="panel p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">GGPack 导出</div>
              <h2 className="mt-2 text-xl font-semibold text-textPrimary">{TABLE_LABELS[tableName]}</h2>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                导出为 Geargrade 自有表格包，字段按列声明，记录按 rows 保存。
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="button-primary" type="button" onClick={() => handleExport(tableName)} disabled={busy !== null}>
                  {busy === "export" ? "导出中..." : `导出${TABLE_LABELS[tableName]}`}
                </button>
                <button className="button-secondary" type="button" onClick={() => handleExport("all")} disabled={busy !== null}>
                  导出全部
                </button>
              </div>
            </div>

            <div className="panel p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">GGPack 导入</div>
              <h2 className="mt-2 text-xl font-semibold text-textPrimary">预览后更新覆盖</h2>
              <p className="mt-2 text-sm leading-6 text-textSecondary">
                上传后先校验并展示表格，勾选有效行后执行。重复记录会按导入内容更新。
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <label className={`button-secondary cursor-pointer ${busy !== null ? "pointer-events-none opacity-60" : ""}`}>
                  选择文件
                  <input
                    className="sr-only"
                    type="file"
                    accept=".ggpack.json,.json,application/json"
                    onChange={(event) => handlePreview(event.target.files?.[0] ?? null)}
                    disabled={busy !== null}
                  />
                </label>
                <span className="text-sm text-textSecondary">{selectedFileName || "未选择文件"}</span>
              </div>
            </div>
          </section>

          {activePreview ? (
            <section className="panel p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导入预览</div>
                  <h2 className="mt-1 text-xl font-semibold text-textPrimary">{TABLE_LABELS[tableName]}</h2>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  disabled={busy !== null || selectedRows.length === 0}
                  onClick={handleImport}
                >
                  {busy === "import" ? "导入中..." : `导入选中 ${selectedRows.length} 行`}
                </button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-5">
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">总行数</div>
                  <div className="mt-1 text-2xl font-semibold text-textPrimary">{activePreview.total}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">有效</div>
                  <div className="mt-1 text-2xl font-semibold text-success">{activePreview.valid}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">将新增</div>
                  <div className="mt-1 text-2xl font-semibold text-textPrimary">{activePreview.create}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">将更新</div>
                  <div className="mt-1 text-2xl font-semibold text-warning">{activePreview.update}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">错误</div>
                  <div className="mt-1 text-2xl font-semibold text-danger">{activePreview.errors.length}</div>
                </div>
              </div>

              <div className="mt-5 overflow-x-auto rounded-2xl border border-line">
                <table className="min-w-full divide-y divide-line text-left text-sm">
                  <thead className="bg-panelAlt/70 text-textSecondary">
                    <tr>
                      <th className="w-14 px-3 py-3">选择</th>
                      <th className="px-3 py-3">动作</th>
                      {visibleColumns.map((column) => (
                        <th key={column} className="px-3 py-3">
                          {column}
                        </th>
                      ))}
                      <th className="px-3 py-3">状态</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {activePreview.rows.map((row) => {
                      const sourceRow = activeTable?.rows[row.index] ?? {};
                      const selectable = row.action !== "error";
                      return (
                        <tr key={row.index} className="hover:bg-panelAlt/40">
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selectedRows.includes(row.index)}
                              disabled={!selectable || busy !== null}
                              onChange={() => toggleRow(row.index)}
                            />
                          </td>
                          <td className="px-3 py-3 text-textPrimary">{row.action}</td>
                          {visibleColumns.map((column) => (
                            <td key={column} className="max-w-[14rem] truncate px-3 py-3 text-textSecondary">
                              {formatCell(sourceRow[column])}
                            </td>
                          ))}
                          <td className={row.action === "error" ? "px-3 py-3 text-danger" : "px-3 py-3 text-success"}>
                            {row.reason ?? "OK"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {result ? (
            <section className="panel p-5">
              <div className="text-xs uppercase tracking-[0.22em] text-textSecondary">导入结果</div>
              <div className="mt-4 grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">处理</div>
                  <div className="mt-1 text-2xl font-semibold text-textPrimary">{result.total}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">新增</div>
                  <div className="mt-1 text-2xl font-semibold text-success">{result.created}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">更新</div>
                  <div className="mt-1 text-2xl font-semibold text-warning">{result.updated}</div>
                </div>
                <div className="rounded-2xl bg-panelAlt p-4">
                  <div className="text-sm text-textSecondary">错误</div>
                  <div className="mt-1 text-2xl font-semibold text-danger">{result.errors.length}</div>
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="panel border-danger/30 p-5">
          <div className="text-xs uppercase tracking-[0.22em] text-danger">危险操作</div>
          <h2 className="mt-2 text-xl font-semibold text-textPrimary">重置所有数据</h2>
          <p className="mt-2 text-sm leading-6 text-textSecondary">
            会删除主设备库、心愿池和本地媒体文件。必须连续确认 5 次才会真正执行。
          </p>

          {resetStep > 0 ? (
            <div className="mt-4 rounded-2xl border border-danger/30 bg-danger/8 p-4">
              <div className="text-sm text-textPrimary">当前确认进度：{resetStep}/5</div>
              <div className="mt-1 text-sm text-textSecondary">继续点击推进下一步，第 5 次才会执行重置。</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="button-danger" disabled={busy === "reset"} onClick={handleResetAdvance}>
                  {busy === "reset" ? "重置中..." : `确认第 ${resetStep + 1} / 5 次`}
                </button>
                <button type="button" className="button-secondary" disabled={busy === "reset"} onClick={() => setResetStep(0)}>
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

          {resetResult ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
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
          ) : null}
        </section>
      )}
    </section>
  );
}

export { parseImportPayload };
