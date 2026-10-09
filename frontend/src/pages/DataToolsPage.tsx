import { DataToolsSection } from "../components/tools/DataToolsSection";
import { PhotoDatabaseMaintenance } from "../components/photo-data/PhotoDatabaseMaintenance";

export default function DataToolsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Data Tools</div>
        <h1 className="mt-1 text-3xl font-semibold text-textPrimary">数据工具</h1>
        <p className="mt-2 text-sm text-textSecondary">
          设备数据导入导出、照片索引数据库容量与维护统一在此管理。
        </p>
      </div>

      <PhotoDatabaseMaintenance mode="manage" />
      <DataToolsSection />
    </div>
  );
}
