import { DataToolsSection } from "../components/tools/DataToolsSection";

export default function DataToolsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Data Tools</div>
        <h1 className="mt-1 text-3xl font-semibold text-textPrimary">数据工具</h1>
        <p className="mt-2 text-sm text-textSecondary">
          使用 Geargrade GGPack 表格包导入导出主设备库和心愿池。
        </p>
      </div>

      <DataToolsSection />
    </div>
  );
}
