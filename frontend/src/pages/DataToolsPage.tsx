import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataToolsSection } from "../components/tools/DataToolsSection";
import { PhotoDatabaseMaintenance } from "../components/photo-data/PhotoDatabaseMaintenance";
import { PhotoDataWorkspace } from "../components/photo-data/PhotoDataWorkspace";

export default function DataToolsPage() {
  const [params, setParams] = useSearchParams();
  const filesOpen = params.get("photo_files") === "1";
  const [hasOpened, setHasOpened] = useState(filesOpen);

  function toggleFiles() {
    setHasOpened(true);
    setParams(current => {
      const next = new URLSearchParams(current);
      if (filesOpen) next.delete("photo_files");
      else next.set("photo_files", "1");
      return next;
    }, { replace: true });
  }
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.22em] text-accent/80">Data Tools</div>
        <h1 className="mt-1 text-3xl font-semibold text-textPrimary">数据工具</h1>
        <p className="mt-2 text-sm text-textSecondary">
          照片明细检索、设备数据导入导出、照片索引数据库维护统一在此管理。
        </p>
      </div>

      <section className="panel p-4 sm:p-5 space-y-4">
        <button type="button" onClick={toggleFiles} aria-expanded={filesOpen}
          aria-controls="photo-files-workspace" className="flex w-full items-center justify-between gap-4 text-left rounded-lg focus-visible:outline-accent">
          <span>
            <span className="block text-lg font-semibold text-textPrimary">照片明细</span>
            <span className="mt-1 block text-sm text-textSecondary">搜索索引文件、查看元数据及导出，展开后加载</span>
          </span>
          <span className="button-secondary shrink-0">{filesOpen ? "收起" : "展开"}</span>
        </button>
        <div id="photo-files-workspace" hidden={!filesOpen}>
          {filesOpen || hasOpened ? <PhotoDataWorkspace key={JSON.stringify([params.get("photo_filter"), params.get("camera"), params.get("lens")])} workspace="files" /> : null}
        </div>
      </section>
      <PhotoDatabaseMaintenance mode="manage" />
      <DataToolsSection />
    </div>
  );
}
