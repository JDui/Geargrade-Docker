import { Link } from "react-router-dom";

import { DataToolsSection } from "../components/tools/DataToolsSection";

export default function DataToolsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Data Tools</div>
          <h1 className="mt-1 text-3xl font-semibold text-textPrimary">数据工具</h1>
          <p className="mt-2 text-sm text-textSecondary">
            该页面已并入“新增设备”页底部，这里保留兼容展示。
          </p>
        </div>
        <Link to="/devices/new#data-tools" className="button-secondary">
          前往新增设备页
        </Link>
      </div>

      <DataToolsSection />
    </div>
  );
}
