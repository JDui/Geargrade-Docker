import { useRef, useState } from "react";
import { exportPhotoStatistics, type PhotoFilter } from "../../api/photoData";

export function PhotoStatisticsExport({filter,pending}:{filter:PhotoFilter;pending:boolean}) {
  const [exporting,setExporting]=useState(false);
  const [error,setError]=useState("");
  const active=useRef(false);

  async function download() {
    if(active.current||pending)return;
    active.current=true;setExporting(true);setError("");
    try {await exportPhotoStatistics(filter);}
    catch(error){setError(error instanceof Error?error.message:"图表统计导出失败，请重试");}
    finally {active.current=false;setExporting(false);}
  }

  return <section className="panel p-4 sm:p-5 space-y-3" aria-busy={exporting}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold text-textPrimary">图表统计导出</h2>
      <button type="button" className="button-secondary" disabled={pending||exporting} onClick={()=>void download()}>
        {exporting?"正在导出图表统计…":"导出当前筛选的图表统计"}
      </button>
    </div>
    <p className="text-sm text-textSecondary">
      下载 JSON 与各图表 CSV 汇总包，附筛选条件和统计时间。包含当前全局筛选及文件名/路径搜索，不限当前页，保留图表的 Top N 口径。
    </p>
    {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
  </section>;
}
