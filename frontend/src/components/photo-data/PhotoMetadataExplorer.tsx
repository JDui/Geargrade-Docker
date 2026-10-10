import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { PhotoItem, PhotoQuery } from "../../api/photoData";

const format = (n:number) => n.toLocaleString("zh-CN");
const show = (v:string|number|null|undefined) => v==null||v===""?"—":String(v);
export function PhotoMetadataExplorer({results,loading,page,pageSize,onPageChange,onPageSizeChange,
  search,onSearchChange,onExport}:{
  results:PhotoQuery|null;loading:boolean;page:number;pageSize:number;
  onPageChange:(page:number)=>void;onPageSizeChange:(count:number)=>void;
  search:string;onSearchChange:(text:string)=>void;onExport:()=>void;
}) {
  const [selected,setSelected]=useState<PhotoItem|null>(null);
  const originRef=useRef<HTMLButtonElement|null>(null);
  const detailRef=useRef<HTMLElement>(null);
  const shouldRestore=useRef(false);
  useEffect(()=>{
    if(!selected){
      if(shouldRestore.current){originRef.current?.focus();shouldRestore.current=false;}
      return;
    }
    shouldRestore.current=true;
    detailRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){setSelected(null);return;}
      if(e.key!=="Tab")return;
      const elements=Array.from(detailRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')||[]);
      if(!elements.length)return;
      if(e.shiftKey&&document.activeElement===elements[0]){
        e.preventDefault();elements[elements.length-1].focus();
      }else if(!e.shiftKey&&document.activeElement===elements[elements.length-1]){
        e.preventDefault();elements[0].focus();
      }
    };
    document.addEventListener("keydown",onKey);
    const before=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{
      document.removeEventListener("keydown",onKey);
      document.body.style.overflow=before;
    };
  },[selected]);
  const total=results?.total_files??0;
  const start=total?page*pageSize+1:0;
  const end=Math.min(total,(page+1)*pageSize);
  const properties=(item:PhotoItem):Array<[string,string]>=>[
    ["文件名",item.filename],["相对路径",item.relpath],["扫描来源 ID",show(item.source_id)],
    ["文件类型",item.format_family.toUpperCase()],["扩展名",show(item.ext)],
    ["文件大小",(item.size_bytes/1048576).toFixed(2)+" MiB ("+format(item.size_bytes)+" bytes)"],
    ["拍摄时间",show(item.shot_at)],["相机型号",show(item.camera_model)],
    ["机身归一化型号",show(item.camera_norm)],["镜头",show(item.lens_model)],
    ["镜头归一化型号",show(item.lens_norm)],["ISO",show(item.iso)],
    ["光圈",item.aperture!=null?"F"+Number(item.aperture.toFixed(2)):"—"],
    ["快门",item.shutter!=null?item.shutter+" s":"—"],
    ["焦距",item.focal_mm!=null?Number(item.focal_mm.toFixed(1))+" mm":"—"],
    ["分辨率",item.width_px&&item.height_px?item.width_px+" × "+item.height_px+" px":"—"],
    ["解析状态",item.parse_status]
  ];
  return <section className="space-y-4" aria-busy={loading}>
    <div className="flex flex-wrap gap-3 items-end justify-between">
      <div><div className="dashboard-kicker">Indexed Photo Files</div>
        <h2 className="mt-1 text-2xl font-semibold text-textPrimary">照片明细</h2>
        <p className="text-sm text-textSecondary mt-1">独立的文件检索工作区，只读取索引，不打开原始照片。</p>
      </div>
      <button type="button" className="button-secondary" onClick={onExport}>导出当前明细结果</button>
    </div>
    <div className="panel p-4 space-y-3">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <label className="flex flex-col gap-1 text-xs text-textSecondary flex-1 min-w-[200px]">
          文件名或相对路径搜索
          <input className="input w-full sm:max-w-md" type="search"
            placeholder="搜索文件名、目录等…" aria-label="文件名或相对路径搜索"
            value={search} onChange={e=>onSearchChange(e.target.value)}/>
        </label>
        <label className="flex items-center gap-2 text-xs text-textSecondary">每页
          <select className="input" aria-label="每页显示文件数" value={pageSize}
            onChange={e=>onPageSizeChange(Number(e.target.value))}>
            {[20,40,100].map(x=><option key={x} value={x}>{x}</option>)}
          </select>
        </label>
      </div>
      <p className="text-xs text-textSecondary" aria-live="polite">
        {loading?"正在查询索引…":"匹配 "+format(total)+" 个文件 / "+format(results?.total_captures??0)+" 次拍摄，当前 "+format(start)+"–"+format(end)+" 个文件"}
        {search.trim()?" · 文件名搜索仅影响此视图":""}
      </p>
    </div>
    <div className="panel overflow-x-auto photo-results">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="text-textSecondary bg-panelAlt/60">
          <tr>{["文件名","拍摄时间","机身","镜头","格式","ISO","光圈","焦距","文件大小"].map(h=>
            <th key={h} scope="col" className="px-4 py-3 text-xs font-medium whitespace-nowrap">{h}</th>)}</tr>
        </thead>
        <tbody>{!loading&&results?.items.map(item=><tr key={item.id} className="border-t border-line/50 text-textPrimary hover:bg-panelAlt/55">
          <td className="px-4 py-3 max-w-52">
            <button type="button" className="text-left max-w-full truncate text-accent hover:underline focus-visible:underline"
              title={item.relpath}
              onClick={e=>{originRef.current=e.currentTarget;setSelected(item);}} aria-label={"查看元数据："+item.filename}>{item.filename}</button>
          </td>
          <td className="px-4 py-3 whitespace-nowrap">{item.shot_at?.slice(0,16)||"—"}</td>
          <td className="px-4 py-3">{item.camera_model||"—"}</td>
          <td className="px-4 py-3 max-w-48 truncate" title={item.lens_model||""}>{item.lens_model||"—"}</td>
          <td className="px-4 py-3 uppercase">{item.format_family}</td>
          <td className="px-4 py-3">{item.iso??"—"}</td>
          <td className="px-4 py-3">{item.aperture!=null?"F"+Number(item.aperture.toFixed(2)):"—"}</td>
          <td className="px-4 py-3">{item.focal_mm!=null?Number(item.focal_mm.toFixed(1))+" mm":"—"}</td>
          <td className="px-4 py-3 whitespace-nowrap">{(item.size_bytes/1048576).toFixed(1)} MiB</td>
        </tr>)}</tbody>
      </table>
      {loading?<div role="status" className="text-center p-8 text-accent">正在加载文件明细…</div>:null}
      {!loading&&!results?.items.length?<p className="p-8 text-center text-sm text-textSecondary">没有匹配的索引照片，可调整文件搜索或全局筛选。</p>:null}
    </div>
    <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="照片明细分页">
      <button className="button-secondary" disabled={loading||page===0} type="button"
        onClick={()=>onPageChange(Math.max(0,page-1))}>上一页</button>
      <span className="text-xs text-textSecondary">第 {page+1} / {Math.max(1,Math.ceil(total/pageSize))} 页</span>
      <button className="button-secondary" disabled={loading||end>=total} type="button"
        onClick={()=>onPageChange(page+1)}>下一页</button>
    </nav>
    {selected?createPortal(<div className="photo-modal-layer fixed inset-0 z-[110] flex items-center justify-center p-2 sm:p-5">
      <button className="photo-modal-backdrop absolute inset-0 w-full h-full cursor-default" type="button"
        aria-label="关闭照片详情" onClick={()=>setSelected(null)}/>
      <aside ref={detailRef} role="dialog" aria-modal="true" aria-label={"文件元数据："+selected.filename}
        className="photo-detail-modal relative z-10 flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <header className="shrink-0 flex gap-3 justify-between items-start p-5 sm:px-6 bg-panel border-b border-line">
          <div className="min-w-0"><div className="dashboard-kicker">Metadata Record</div>
            <h3 className="font-semibold mt-1 text-lg text-textPrimary break-all">{selected.filename}</h3></div>
          <button className="button-secondary shrink-0" type="button" onClick={()=>setSelected(null)}>关闭</button>
        </header>
        <div className="photo-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-7 gap-y-1">
          {properties(selected).map(([label,value])=><div key={label} className="border-b border-line/50 pb-3">
            <dt className="text-xs text-textSecondary">{label}</dt>
            <dd className="text-sm mt-1 text-textPrimary break-all select-text">{value}</dd>
          </div>)}
        </dl>
        <p className="text-xs text-textSecondary py-4">仅显示索引已经保存的字段，不读取或修改原始照片。可滚动查看全部字段。</p>
        </div>
      </aside>
    </div>,document.body):null}
  </section>;
}
