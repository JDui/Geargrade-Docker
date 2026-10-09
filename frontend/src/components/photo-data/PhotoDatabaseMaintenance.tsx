import { useEffect, useRef, useState } from "react";
import { getPhotoMaintenance, startPhotoMaintenance,
  type PhotoMaintenanceStatus, type PhotoMaintenanceJob } from "../../api/photoData";

type Operation = "migrate" | "cleanup" | "vacuum";
const bytes = (value:number) => {
  if(value < 1048576)return (value/1024).toFixed(0)+" KiB";
  if(value < 1073741824)return (value/1048576).toFixed(1)+" MiB";
  return (value/1073741824).toFixed(2)+" GiB";
};
const formatted=(x:number)=>x.toLocaleString("zh-CN");

export function PhotoDatabaseMaintenance({onUpdated,mode="manage"}:{
  onUpdated?:()=>void;
  mode?:"manage"|"migration-prompt";
}) {
  const [stats,setStats]=useState<PhotoMaintenanceStatus|null>(null);
  const [error,setError]=useState("");
  const [deferred,setDeferred]=useState(false);
  const [expanded,setExpanded]=useState(false);
  const [submitting,setSubmitting]=useState(false);
  const lastCompleted=useRef<string|null>(null);
  useEffect(()=>{
    let mounted=true;
    void getPhotoMaintenance().then(result=>{if(mounted)setStats(result);})
      .catch(e=>{if(mounted)setError(String(e));});
    return ()=>{mounted=false;};
  },[]);
  const activeJob=stats?.job?.status==="running";
  useEffect(()=>{
    if(!activeJob)return;
    let open=true;
    const timer=window.setInterval(()=>{
      void getPhotoMaintenance().then(result=>{
        if(!open)return;
        setStats(result);
        if(result.job?.status==="completed" && result.job.id!==lastCompleted.current) {
          lastCompleted.current=result.job.id;
          onUpdated?.();
        }
      }).catch(e=>{if(open)setError(String(e));});
    },1200);
    return ()=>{open=false;window.clearInterval(timer);};
  },[activeJob,onUpdated]);
  async function run(op:Operation) {
    if(submitting||activeJob)return;
    if(op==="cleanup"&&!window.confirm(
      "确认清除已经连续 "+stats?.policy.missing_confirmations+
      " 次扫描未发现、且超过 "+stats?.policy.missing_days+" 天的失效照片索引及过期任务历史？原始照片不会被操作。"
    ))return;
    if(op==="vacuum"&&!window.confirm(
      "确认整理 SQLite 数据库并尝试回收物理磁盘空间？需要额外空闲磁盘空间，并且不能与扫描同时执行。"
    ))return;
    setSubmitting(true);
    setError("");
    try {
      const job=await startPhotoMaintenance(op);
      setStats(current=>current?{...current,job}:current);
      setDeferred(true);
      setExpanded(true);
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    finally{setSubmitting(false);}
  }
  const job:PhotoMaintenanceJob|null=stats?.job||null;
  const showPrompt=!!stats?.migration_required&&!deferred&&!activeJob;
  return <>
    {mode==="manage"?<section className="panel p-4 space-y-3" aria-label="照片索引数据库维护">
      <div className="flex flex-wrap justify-between items-center gap-3">
        <div>
          <div className="dashboard-kicker">Index Storage · SQLite</div>
          <h2 className="text-base font-semibold text-textPrimary mt-1">照片索引数据库</h2>
          <p className="text-xs text-textSecondary mt-1">
            {stats?("数据库 v"+stats.schema_version+" / 目标 v"+stats.target_schema_version+
              " · "+bytes(stats.db_bytes)+" 主库 · "+bytes(stats.wal_bytes)+" WAL"): "正在检查数据库版本…"}
          </p>
        </div>
        <button className="button-secondary" type="button" aria-expanded={expanded}
          onClick={()=>setExpanded(v=>!v)}>{expanded?"收起维护工具":"数据库维护 / 容量详情"}</button>
      </div>
      {stats?.migration_required?<div className="rounded-lg border border-warning/50 bg-panelAlt/60 p-3 text-sm text-textPrimary">
        检测到旧版索引数据库（v{stats.schema_version}）。当前仍可按旧结构使用；
        建议确认后生成备份并升级到 v{stats.target_schema_version}，启用独立扫描暂存和维护策略。
        <button className="ml-2 text-accent underline" type="button" onClick={()=>{setDeferred(false);setExpanded(true);}}>
          查看升级提示
        </button>
      </div>:null}
      {stats&&stats.schema_version===stats.target_schema_version&&mode==="manage"?<p className="text-xs leading-6 text-textSecondary">
        v2 已启用独立扫描暂存与精简 EXIF。SQLite 不会因为迁移自动缩小文件；
        {stats.freelist_bytes>0?("当前可复用空闲页约 "+bytes(stats.freelist_bytes)+"，"):"当前没有大量空闲页，"}
        需要在无扫描任务时手动执行下方「压缩数据库」，而迁移备份不会自动删除。
        {stats.backup_count>0?" 当前保留 "+stats.backup_count+" 份备份（共 "+bytes(stats.backup_bytes)+"）。":""}
      </p>:null}
      {job?<div className="text-xs rounded-lg bg-panelAlt p-3 text-textSecondary" role="status">
        <span className="font-semibold text-textPrimary">
          {job.operation==="migrate"?"数据库迁移":job.operation==="cleanup"?"清理历史":"数据库压缩"}：
          {job.status==="running"?"正在执行":job.status==="completed"?"已完成":"失败"}
        </span>
        {" · "+job.phase}
        {job.backup_file?<p className="mt-1">旧库备份：{job.backup_file}</p>:null}
        {job.result?<p className="mt-1">{job.result.message}</p>:null}
        {job.error?<p className="mt-1 text-danger">{job.error}</p>:null}
      </div>:null}
      {error?<p role="alert" className="text-xs text-danger">{error}</p>:null}
      {expanded&&stats?<div className="space-y-4 border-t border-line pt-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {[
            ["主库文件",bytes(stats.db_bytes)],
            ["磁盘总占用",bytes(stats.storage_bytes)],
            ["迁移备份",stats.backup_count+" 份 / "+bytes(stats.backup_bytes)],
            ["WAL 日志",bytes(stats.wal_bytes)],
            ["可复用空闲页",bytes(stats.freelist_bytes)],
            ["扫描暂存",bytes(stats.stage_bytes)],
            ["有效照片",formatted(stats.active_photos)],
            ["已失效记录",formatted(stats.missing_photos)],
            ["可安全清理",formatted(stats.eligible_for_purge)],
            ["扫描历史",formatted(stats.scan_runs)]
          ].map(([title,value])=><div key={title} className="rounded-xl p-3 bg-panelAlt">
            <p className="text-textSecondary">{title}</p><p className="font-semibold text-textPrimary mt-1">{value}</p>
          </div>)}
        </div>
        <p className="text-xs leading-5 text-textSecondary">
          失效记录需至少 {stats.policy.missing_confirmations} 次成功扫描确认缺失且已超过
          {stats.policy.missing_days} 天才能清理。自动保留至少最近 {stats.policy.retain_run_count} 条扫描历史，
          以及最近 {stats.policy.retain_run_days} 天的记录。
          回收操作仅针对索引数据库，不访问或删除原始照片。
          物理空间释放需要另行执行 VACUUM。备份仅用于回退，会单独占用磁盘，不会被自动清理。
        </p>
        <div className="flex flex-wrap gap-2">
          {stats.migration_required?<button type="button" className="button-primary"
            disabled={activeJob||submitting||stats.scan_active}
            onClick={()=>{setDeferred(false);}}>先备份，再升级数据库</button>:<>
            <button type="button" className="button-secondary"
              disabled={activeJob||submitting||stats.scan_active||stats.eligible_for_purge===0&&stats.scan_runs<=stats.policy.retain_run_count}
              onClick={()=>void run("cleanup")}>清理过期索引</button>
            <button type="button" className="button-secondary"
              disabled={activeJob||submitting||stats.scan_active}
              onClick={()=>void run("vacuum")}>压缩数据库 / 回收空间</button>
          </>}
        </div>
      </div>:null}
    </section>:null}
    {showPrompt?<div className="photo-modal-layer fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="photo-modal-backdrop absolute inset-0" aria-hidden="true"/>
      <div role="dialog" aria-modal="true" aria-labelledby="photo-migration-heading"
        className="relative panel p-5 sm:p-6 w-full max-w-xl space-y-4 shadow-2xl">
        <div className="dashboard-kicker">Database Upgrade Required</div>
        <h2 id="photo-migration-heading" className="text-xl font-bold text-textPrimary">检测到旧版照片索引数据库</h2>
        <p className="text-sm text-textSecondary leading-6">
          当前数据库版本 v{stats.schema_version}，可升级到 v{stats.target_schema_version}。
          升级会先在数据库同一目录创建完整的 SQLite 备份并校验，
          然后迁移 EXIF 结构，启用独立扫描暂存及过期记录维护。
        </p>
        <div className="p-3 bg-panelAlt rounded-xl text-xs text-textSecondary space-y-1">
          <p>当前主库大小：{bytes(stats.db_bytes)}；预计需要额外可用空间用于备份。</p>
          <p>保留照片、来源、筛选预设及已发布的历史统计；不会扫描、移动或删除照片原件。</p>
          <p>旧数据库备份不会自动删除。物理空间回收可升级后手动执行。</p>
          {stats.scan_active?<p className="text-warning">检测到扫描进行中，请先完成或取消扫描后再迁移。</p>:null}
        </div>
        {error?<p role="alert" className="text-sm text-danger">{error}</p>:null}
        <div className="flex flex-wrap justify-end gap-2">
          <button className="button-secondary" type="button" onClick={()=>setDeferred(true)}>稍后升级</button>
          <button className="button-primary" type="button"
            disabled={submitting||stats.scan_active}
            onClick={()=>void run("migrate")}>
            {submitting?"提交升级中…":"备份并升级到 v"+stats.target_schema_version}
          </button>
        </div>
      </div>
    </div>:null}
  </>;
}
