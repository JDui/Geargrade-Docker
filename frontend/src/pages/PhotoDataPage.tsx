import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import { PhotoAnalyticsDashboard } from "../components/photo-data/PhotoAnalyticsDashboard";
import { PhotoMetadataExplorer } from "../components/photo-data/PhotoMetadataExplorer";
import { PhotoDatabaseMaintenance } from "../components/photo-data/PhotoDatabaseMaintenance";
import {
  cancelPhotoScan, createPhotoPreset, deletePhotoPreset, emptyPhotoFilter, exportPhotoData,
  getPhotoFacet, getPhotoFields, getPhotoPresets, getPhotoQuery, getPhotoScan, getPhotoStatus,
  getPhotoSummary, startPhotoScan, type Facet, type PhotoField, type PhotoFilter,
  type PhotoPreset, type PhotoQuery, type PhotoRule, type PhotoScan, type PhotoStatus,
  type PhotoSummary
} from "../api/photoData";

type Column = { id: number; field: string; selected: string[] };
const initialColumns:Column[] = [
  {id:1,field:"capture.month",selected:[]},
  {id:2,field:"camera.model_norm",selected:[]},
  {id:3,field:"lens.model_norm",selected:[]},
  {id:4,field:"files.format_family",selected:[]}
];
const emptyGroup = ():PhotoRule => ({op:"and",children:[]});
const newLeaf = ():PhotoRule => ({field:"exposure.iso",op:"gte",value:1600});
const formatCount = (value:number|null|undefined) => (value??0).toLocaleString("zh-CN");
const displayDate = (value:string|null|undefined) => value ? new Date(value).toLocaleString("zh-CN") : "尚无成功扫描";
const showError = (e:unknown) => e instanceof Error ? e.message : String(e);
const isGroup = (rule:PhotoRule):rule is Extract<PhotoRule,{children:PhotoRule[]}> => "children" in rule;
const ruleCount=(rule:PhotoRule):number=>isGroup(rule)?rule.children.reduce((sum,child)=>sum+ruleCount(child),0):1;

function RuleListInput({value,numeric,onChange}:{
  value:string|number|Array<string|number>|undefined;numeric:boolean;onChange:(values:Array<string|number>)=>void;
}) {
  const normalized=String(value??"");
  const [draft,setDraft]=useState(normalized);
  const committed=useRef(normalized);
  useEffect(()=>{
    if(normalized!==committed.current){setDraft(normalized);committed.current=normalized;}
  },[normalized]);
  return <input className="input w-36" aria-label="比较值" placeholder="逗号分隔多个值"
    value={draft} onBlur={()=>setDraft(normalized)} onChange={e=>{
      setDraft(e.target.value);
      const values=e.target.value.split(/[,，]/).map(v=>v.trim());
      if(values.some(v=>!v||numeric&&!Number.isFinite(Number(v))))return;
      const parsed=values.map(v=>numeric?Number(v):v);
      committed.current=String(parsed);onChange(parsed);
    }}/>;
}

function AdvancedRules({rule,fields,onChange,onRemove,level=0}:{
  rule:PhotoRule; fields:PhotoField[]; onChange:(node:PhotoRule)=>void;
  onRemove?:()=>void; level?:number;
}) {
  if (isGroup(rule)) {
    return <div className="space-y-2 border-l-2 border-accent/30 pl-3 py-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input" aria-label="条件组逻辑" value={rule.op}
          onChange={(e)=>onChange({op:e.target.value as "and"|"or"|"not",children:e.target.value==="not"?[rule.children[0]??newLeaf()]:rule.children})}>
          <option value="and">全部满足 (AND)</option><option value="or">任意满足 (OR)</option>
          <option value="not">排除组 (NOT)</option>
        </select>
        <button className="button-secondary" type="button" disabled={level>=4||(rule.op==="not"&&rule.children.length>0)}
          onClick={()=>onChange({...rule,children:[...rule.children,newLeaf()]})}>+ 条件</button>
        <button className="button-secondary" type="button" disabled={level>=3||(rule.op==="not"&&rule.children.length>0)}
          onClick={()=>onChange({...rule,children:[...rule.children,{op:"and",children:[newLeaf()]}]})}>+ 分组</button>
        {onRemove?<button className="button-secondary" type="button" onClick={onRemove}>删除组</button>:null}
      </div>
      {rule.children.map((child,index)=><AdvancedRules key={index} rule={child} fields={fields} level={level+1}
        onChange={(next)=>onChange({...rule,children:rule.children.map((n,i)=>i===index?next:n)})}
        onRemove={()=>onChange({...rule,op:rule.op==="not"?"and":rule.op,children:rule.children.filter((_,i)=>i!==index)})}/>)}
      {!rule.children.length?<p className="text-xs text-textSecondary">尚无条件，该组不会限制结果。</p>:null}
    </div>;
  }
  const selected=fields.find(f=>f.field_id===rule.field)??fields[0];
  const op=rule.op;
  const twoValues=Array.isArray(rule.value)?rule.value: [0,100];
  const isNum=selected?.value_type==="number";
  const changeField=(field:string)=>{
    const matched=fields.find(f=>f.field_id===field);
    onChange({field,op:"eq",value:matched?.value_type==="number"?0:""});
  };
  return <div className="flex flex-wrap items-center gap-2 rounded-xl bg-panelAlt/80 p-2">
    <select className="input max-w-full" aria-label="筛选字段" value={rule.field} onChange={e=>changeField(e.target.value)}>
      {fields.map(f=><option key={f.field_id} value={f.field_id}>{f.label}</option>)}
    </select>
    <select className="input" aria-label="筛选操作符" value={op}
      onChange={e=>onChange({...rule,op:e.target.value,value:
        e.target.value==="between"?[0,100]:["in","not_in"].includes(e.target.value)?[isNum?0:""]:(isNum?0:"")})}>
      <option value="eq">等于</option><option value="ne">不等于</option>
      <option value="in">属于列表</option><option value="not_in">不属于列表</option>
      <option value="gte">大于等于</option><option value="gt">大于</option>
      <option value="lte">小于等于</option><option value="lt">小于</option>
      <option value="between">介于（含两端）</option>
      {!isNum?<option value="contains">包含文字</option>:null}
      <option value="is_missing">未记录</option><option value="is_present">有值</option>
    </select>
    {op!=="is_missing"&&op!=="is_present"?(op==="between"?
      <div className="flex gap-2 items-center">
        {[0,1].map(index=><input key={index} className="input w-24" aria-label={index?"最大值":"最小值"}
          type={isNum?"number":"text"} value={String(twoValues[index]??"")}
          onChange={e=>{
            const next=[...twoValues] as Array<string|number>;
            next[index]=isNum?Number(e.target.value):e.target.value;
            onChange({...rule,value:next});
          }}/>)}
      </div>:["in","not_in"].includes(op)?
      <RuleListInput value={rule.value} numeric={isNum} onChange={value=>onChange({...rule,value})}/>:
      <input className="input w-36" aria-label="比较值" type={isNum?"number":"text"}
        value={String(rule.value??"")} onChange={e=>onChange({...rule,value:isNum?Number(e.target.value):e.target.value})}/>
    ):null}
    {onRemove?<button type="button" className="button-secondary" onClick={onRemove}>移除</button>:null}
  </div>;
}

function enummerationDoneGuard(run:PhotoScan|null):number|null {
  if(!run?.enumeration_done||!run.rate_files_per_sec||run.rate_files_per_sec<=0) return null;
  return Math.max(0,Math.round((run.seen-run.processed)/run.rate_files_per_sec));
}

export default function PhotoDataPage() {
  const [queryParams,setQueryParams] = useSearchParams();
  const workspace=queryParams.get("view")==="files"?"files":"charts";
  const [filtersOpen,setFiltersOpen]=useState(false);
  const filterButtonRef=useRef<HTMLButtonElement>(null);
  const filterDrawerRef=useRef<HTMLElement>(null);
  const filterWasOpen=useRef(false);
  const [fileSearch,setFileSearch]=useState("");
  const [committedFileSearch,setCommittedFileSearch]=useState("");
  const [pageSize,setPageSize]=useState(40);
  const [fields,setFields]=useState<PhotoField[]>([]);
  const [columns,setColumns]=useState<Column[]>(()=>{
    const camera=queryParams.get("camera");
    const lens=queryParams.get("lens");
    return initialColumns.map(c=>({...c,selected:
      c.field==="camera.model_norm"&&camera?[camera]:
      c.field==="lens.model_norm"&&lens?[lens]:[]}));
  });
  const [advanced,setAdvanced]=useState<PhotoRule>(emptyGroup());
  const [mode,setMode]=useState<"columns"|"advanced">("columns");
  const [status,setStatus]=useState<PhotoStatus|null>(null);
  const [run,setRun]=useState<PhotoScan|null>(null);
  const [runId,setRunId]=useState<string|null>(null);
  const [scanMode,setScanMode]=useState("incremental");
  const [confirmRemovals,setConfirmRemovals]=useState(false);
  const [summary,setSummary]=useState<PhotoSummary|null>(null);
  const [results,setResults]=useState<PhotoQuery|null>(null);
  const [facets,setFacets]=useState<Record<number,Facet>>({});
  const [presets,setPresets]=useState<PhotoPreset[]>([]);
  const [page,setPage]=useState(0);
  const [message,setMessage]=useState("");
  const [loading,setLoading]=useState(false);
  const [starting,setStarting]=useState(false);
  const [cancelling,setCancelling]=useState(false);
  const startPending=useRef(false);
  const [refresh,setRefresh]=useState(0);

  const filter=useMemo<PhotoFilter>(()=>{
    const children:PhotoRule[]=[];
    for(const col of columns) {
      if(!col.selected.length)continue;
      const selectedField=fields.find(f=>f.field_id===col.field);
      const chosen=col.selected.filter(v=>v!=="__MISSING__").map(v=>
        selectedField?.value_type==="number"?Number(v):v);
      const groupChildren:PhotoRule[]=[];
      if(chosen.length)groupChildren.push({field:col.field,op:"in",value:chosen,column_id:col.field});
      if(col.selected.includes("__MISSING__"))groupChildren.push({field:col.field,op:"is_missing",column_id:col.field});
      if(groupChildren.length===1)children.push(groupChildren[0]);
      else if(groupChildren.length)children.push({op:"or",children:groupChildren,column_id:col.field});
    }
    if(isGroup(advanced)&&advanced.children.length)children.push(advanced);
    return {version:"photo-filter.v1",group:{op:"and",children}};
  },[columns,advanced,fields]);

  const filterKey=JSON.stringify(filter);
  useEffect(()=>{
    const timer=window.setTimeout(()=>setCommittedFileSearch(fileSearch.trim().slice(0,256)),240);
    return ()=>window.clearTimeout(timer);
  },[fileSearch]);
  const fileFilter=useMemo<PhotoFilter>(()=>{
    if(!committedFileSearch)return filter;
    return {version:"photo-filter.v1",group:{op:"and",children:[
      filter.group,{field:"files.relpath",op:"contains",value:committedFileSearch}
    ]}};
  },[filterKey,committedFileSearch]);
  const fileFilterKey=JSON.stringify(fileFilter);
  useEffect(()=>{
    if(!filtersOpen){
      if(filterWasOpen.current){
        filterButtonRef.current?.focus();
        filterWasOpen.current=false;
      }
      return;
    }
    filterWasOpen.current=true;
    filterDrawerRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const onKey=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){event.preventDefault();setFiltersOpen(false);return;}
      if(event.key!=="Tab")return;
      const elements=Array.from(filterDrawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')||[]);
      if(!elements.length)return;
      if(event.shiftKey&&document.activeElement===elements[0]){
        event.preventDefault();elements[elements.length-1].focus();
      }else if(!event.shiftKey&&document.activeElement===elements[elements.length-1]){
        event.preventDefault();elements[0].focus();
      }
    };
    document.addEventListener("keydown",onKey);
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow="hidden";
    return ()=>{
      document.removeEventListener("keydown",onKey);
      document.body.style.overflow=oldOverflow;
    };
  },[filtersOpen]);
  function changeWorkspace(next:"charts"|"files"){
    setQueryParams(current=>{
      const updated=new URLSearchParams(current);
      if(next==="files")updated.set("view","files");
      else updated.delete("view");
      return updated;
    },{replace:true});
  }
  const columnsKey=JSON.stringify(columns.map(({id,field})=>({id,field})));
  useEffect(()=>{
    let mounted=true;
    Promise.all([getPhotoStatus(),getPhotoFields(),getPhotoPresets()])
      .then(([s,f,p])=>{if(mounted){setStatus(s);setFields(f);setPresets(p);}})
      .catch(e=>{if(mounted)setMessage(showError(e));});
    return ()=>{mounted=false;};
  },[refresh]);

  useEffect(()=>{
    const active=status?.recent_scans.find(x=>["queued","running"].includes(x.status));
    if(active && !runId)setRunId(active.id);
  },[status,runId]);

  useEffect(()=>{
    if(!runId)return;
    const id=runId;
    let active=true;
    let timer:number|undefined;
    async function poll(){
      try {
        const r=await getPhotoScan(id);
        if(!active)return;
        setRun(r);
        if(!["running","queued"].includes(r.status)){
          setStatus(s=>s?{...s,recent_scans:s.recent_scans.map(item=>item.id===r.id?r:item)}:s);
          setRunId(null);
          setRefresh(x=>x+1);
          if(r.error)setMessage(r.error);
          return;
        }
      } catch(e){if(active)setMessage(showError(e));}
      if(active)timer=window.setTimeout(()=>void poll(),1200);
    }
    void poll();
    return ()=>{active=false;window.clearTimeout(timer);};
  },[runId]);

  useEffect(()=>{
    let active=true;
    void getPhotoSummary(filter).then(value=>{if(active)setSummary(value);})
      .catch(e=>{if(active)setMessage(showError(e));});
    return ()=>{active=false;};
  },[filterKey,refresh]);

  useEffect(()=>{
    if(workspace!=="files")return;
    let active=true;
    setLoading(true);
    setResults(null);
    void getPhotoQuery(fileFilter,pageSize,page*pageSize)
      .then(value=>{if(active){setResults(value);setLoading(false);}})
      .catch(e=>{if(active){setMessage(showError(e));setLoading(false);}});
    return ()=>{active=false;};
  },[workspace,fileFilterKey,pageSize,page,refresh]);

  useEffect(()=>{
    if(!filtersOpen||mode!=="columns")return;
    let active=true;
    void Promise.all(columns.map(async col=>[col.id,await getPhotoFacet(filter,col.field)] as const))
      .then(pairs=>{if(active)setFacets(Object.fromEntries(pairs));})
      .catch(e=>{if(active)setMessage(showError(e));});
    return ()=>{active=false;};
  },[filtersOpen,mode,filterKey,columnsKey,refresh]);

  async function start() {
    if(startPending.current)return;
    startPending.current=true;
    setStarting(true);
    setMessage("");
    try {
      const result=await startPhotoScan(scanMode,confirmRemovals);
      setRunId(result.job_id);
      setRun(null);
    } catch(e) {setMessage(showError(e));}
    finally {startPending.current=false;setStarting(false);}
  }

  async function cancel() {
    if(!runId||cancelling)return;
    setCancelling(true);
    try {await cancelPhotoScan(runId);setMessage("已请求取消，等待当前解析任务结束。");}
    catch(e){setMessage(showError(e));}
    finally {setCancelling(false);}
  }

  async function save() {
    const name=window.prompt("为当前筛选条件命名");
    if(!name?.trim())return;
    try {
      await createPhotoPreset(name,filter,columns.map(x=>x.field));
      setPresets(await getPhotoPresets());
      setMessage("已保存筛选预设");
    } catch(e){setMessage(showError(e));}
  }

  function applyPreset(p:PhotoPreset) {
    const group=p.filter.group;
    const presetColumns=p.columns.length?p.columns:initialColumns.map(column=>column.field);
    setColumns(presetColumns.slice(0,8).map((field,i)=>({id:i+1,field,selected:[]})));
    setAdvanced(group);
    setMode("advanced");
    setPage(0);
    setMessage("已加载完整高级条件；切换到元数据列时仍会保留高级规则。");
  }

  function toggleOption(col:Column,value:string){
    setColumns(items=>items.map(item=>item.id===col.id?
      {...item,selected:item.selected.includes(value)?
        item.selected.filter(v=>v!==value):[...item.selected,value]}:item));
    setPage(0);
  }

  function applyChartFilter(rules:PhotoRule[]) {
    if(!rules.length)return;
    const fields=new Set(rules.flatMap(rule=>"field" in rule?[rule.field]:[]));
    // A chart replaces only its previous chart rules for matching fields.
    // Explicitly authored advanced rules for other purposes remain intact.
    const marked=rules.map(rule=>"field" in rule
      ? {...rule,column_id:"chart:"+rule.field}
      : rule);
    setColumns(current=>current.map(column=>fields.has(column.field)
      ? {...column,selected:[]} : column));
    setAdvanced(current=>{
      const children=isGroup(current)&&current.op==="and" ? current.children : [current];
      const kept=children.filter(child=>!("column_id" in child
        && typeof child.column_id==="string"
        && child.column_id.startsWith("chart:")
        && fields.has(child.column_id.slice(6))));
      return {op:"and",children:[...kept,...marked]};
    });
    setMode("advanced");
    setPage(0);
    setMessage("已应用图表筛选：相同字段的旧图表条件已替换，可在全局筛选面板中继续调整。");
  }

  const selectedCount=columns.reduce((total,c)=>total+c.selected.length,0);
  const advancedCount=ruleCount(advanced);
  const filterCount=selectedCount+advancedCount;
  const columnPreview=columns.flatMap(col=>col.selected.map(value=>({
    field:fields.find(f=>f.field_id===col.field)?.label||col.field,
    label:value==="__MISSING__"?"未记录":value
  })));
  const sourceReady=!!status?.sources.length;
  const isRunning=starting||!!runId||!!status?.recent_scans.some(x=>["queued","running"].includes(x.status));
  const latestRun=run??status?.recent_scans.find(x=>["queued","running"].includes(x.status))??status?.recent_scans[0]??null;
  const enumerationDone=!!latestRun?.enumeration_done;
  const doneCount=latestRun?.processed??0;
  const foundCount=latestRun?.seen??0;
  const progressPercent=latestRun?.status==="completed"?100:
    enumerationDone&&foundCount>0?Math.min(99,Math.round(doneCount/foundCount*100)):null;
  const scanActive=!!latestRun&&["queued","running"].includes(latestRun.status);
  const progressText=progressPercent===null?
    (scanActive?"正在发现文件，尚无法确定总量":"扫描已停止，文件总量未确定"):progressPercent+"%";
  const remaining=enummerationDoneGuard(latestRun);
  const phaseName:Record<string,string>={
    queued:"排队中",preflight:"检查挂载",enumerating:"发现文件并解析元数据",
    extracting:"等待剩余解析任务",publishing:"发布完整索引",
    completed_source:"来源完成",completed:"已完成",
    interrupted:"意外中断",failed:"失败",cancelled:"已取消"
  };

  return <div className="photo-data-page space-y-6">
    <section className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="dashboard-kicker">Photography Analytics · 1.0.0</div>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">拍摄数据</h1>
          <p className="mt-2 text-sm text-textSecondary">离线 EXIF 索引 · 只读照片目录 · 手动扫描更新</p>
          <p className="mt-2 text-xs text-textSecondary">上次成功扫描：{displayDate(status?.last_success)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="扫描模式" className="input" value={scanMode} onChange={e=>setScanMode(e.target.value)}
            disabled={isRunning}>
            <option value="incremental">增量扫描</option><option value="deep">深度重扫</option>
          </select>
          <button className="button-primary" type="button" disabled={!sourceReady||isRunning} onClick={()=>void start()}>
            {isRunning?"扫描中…":"扫描更新"}
          </button>
          {isRunning&&runId?<button type="button" className="button-secondary" disabled={cancelling}
            onClick={()=>void cancel()}>{cancelling?"取消请求中…":"取消"}</button>:null}
        </div>
      </div>
      <label className="mt-4 flex gap-2 items-center text-xs text-textSecondary">
        <input type="checkbox" checked={confirmRemovals} disabled={isRunning}
          onChange={e=>setConfirmRemovals(e.target.checked)} />
        已确认当前 NAS 挂载完整，允许本次扫描发布大规模文件移除
      </label>
      {latestRun?<div className="mt-4 rounded-xl bg-panelAlt/70 p-4 space-y-3 text-sm text-textSecondary" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-textPrimary">扫描状态：{phaseName[latestRun.phase]||phaseName[latestRun.status]||latestRun.status}</strong>
          <span>{progressText}</span>
        </div>
        <div role="progressbar" aria-label="扫描进度" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progressPercent??undefined} aria-valuetext={progressText}
          className="h-3 w-full overflow-hidden rounded-full bg-line">
          <div className={"photo-scan-fill "+(progressPercent===null&&scanActive?"photo-scan-indeterminate":"")}
            style={{transform:progressPercent===null&&scanActive?undefined:`scaleX(${progressPercent===null?(foundCount?Math.min(1,doneCount/foundCount):0):progressPercent/100})`}} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["已发现照片",formatCount(foundCount)],
            ["已处理照片",formatCount(doneCount)],
            ["新增解析",formatCount(latestRun.extracted)],
            ["未变化跳过",formatCount(latestRun.unchanged)],
            ["解析失败",formatCount(latestRun.failed)],
            ["检测目录",formatCount(latestRun.directories_seen)]
          ].map(([title,value])=><div key={title} className="rounded-lg border border-line/70 p-2">
            <div className="text-[11px] text-textSecondary">{title}</div>
            <div className="mt-1 font-semibold text-textPrimary">{value}</div>
          </div>)}
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <span>自适应并发：{latestRun.workers||0} 个工作线程</span>
          <span>运行任务：{latestRun.active_workers||0}</span>
          <span>吞吐：{(latestRun.rate_files_per_sec||0).toFixed(1)} 文件/秒</span>
          <span>等待解析：{Math.max(0,foundCount-doneCount).toLocaleString("zh-CN")}</span>
          {remaining!==null&&latestRun.status==="running"?
            <span>估算剩余：约 {remaining<120?remaining+" 秒":Math.ceil(remaining/60)+" 分钟"}（仅文件枚举完成后估算）</span>:null}
        </div>
        {latestRun.error?<div className="text-danger">{latestRun.error}</div>:null}
      </div>:null}
      {!sourceReady?<p className="mt-4 text-sm text-textSecondary">
        尚未添加扫描目录。请先到 <a href="/settings" className="text-accent underline">设置 / 拍摄数据源</a>
        添加 Docker 内的只读目录；保存目录不会开始扫描。
      </p>:null}
      {message?<p role="alert" className="mt-3 text-sm font-medium text-textPrimary">{message}</p>:null}
    </section>

    <PhotoDatabaseMaintenance mode="migration-prompt" onUpdated={()=>setRefresh(value=>value+1)}/>

    <section className="panel p-3 sm:p-4 space-y-3 photo-workspace-toolbar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2" role="tablist" aria-label="拍摄数据工作区">
          <button type="button" role="tab" aria-selected={workspace==="charts"}
            className={workspace==="charts"?"button-primary":"button-secondary"}
            onClick={()=>changeWorkspace("charts")}>统计分析</button>
          <button type="button" role="tab" aria-selected={workspace==="files"}
            className={workspace==="files"?"button-primary":"button-secondary"}
            onClick={()=>changeWorkspace("files")}>照片明细</button>
        </div>
        <button type="button" ref={filterButtonRef} className="button-secondary"
          aria-haspopup="dialog" aria-expanded={filtersOpen} aria-controls="photo-global-filters"
          onClick={()=>setFiltersOpen(true)}>
          全局筛选{filterCount?" · "+filterCount+" 项":""}
        </button>
      </div>
      <div className="flex flex-wrap gap-2 items-center text-xs text-textSecondary">
        <span className="shrink-0">当前范围：</span>
        {columnPreview.slice(0,4).map((item,index)=>
          <button type="button" key={index} className="rounded-full border border-line bg-panelAlt px-2.5 py-1 text-textPrimary hover:border-accent"
            onClick={()=>{setMode("columns");setFiltersOpen(true);}}>{item.field}：{item.label}</button>)}
        {columnPreview.length>4?<button type="button" className="text-accent" onClick={()=>setFiltersOpen(true)}>
          另有 {columnPreview.length-4} 项
        </button>:null}
        {advancedCount>0?<button type="button" className="rounded-full border border-accent/40 bg-panelAlt px-2.5 py-1 text-textPrimary"
          onClick={()=>{setMode("advanced");setFiltersOpen(true);}}>高级规则 · {advancedCount} 条</button>:null}
        {!filterCount?<span>全部照片（未启用筛选）</span>:null}
        <span className="ml-auto tabular-nums">匹配 {formatCount(summary?.logical_captures)} 次拍摄 · {formatCount(summary?.physical_files)} 个文件</span>
        {filterCount?<button type="button" className="text-accent hover:underline"
          onClick={()=>{setColumns(initialColumns);setAdvanced(emptyGroup());setPage(0);}}>清除条件</button>:null}
      </div>
    </section>

    {filtersOpen?createPortal(<div className="photo-modal-layer fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-5">
      <button type="button" aria-label="关闭筛选遮罩"
        className="photo-modal-backdrop absolute inset-0 w-full h-full cursor-default"
        onClick={()=>setFiltersOpen(false)}/>
      <section id="photo-global-filters" ref={filterDrawerRef} role="dialog" aria-modal="true" aria-label="照片全局筛选"
        className="photo-filter-modal relative z-10 flex w-full min-h-0 flex-col overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <header className="shrink-0 p-4 sm:px-6 sm:py-5 bg-panel border-b border-line flex items-center justify-between gap-3">
          <div>
            <div className="dashboard-kicker">Global Filter Tool</div>
            <h2 className="text-xl font-semibold text-textPrimary mt-1">全局筛选</h2>
            <p className="text-xs text-textSecondary mt-1">条件自动应用于统计分析和照片明细</p>
          </div>
          <button type="button" className="button-secondary" onClick={()=>setFiltersOpen(false)}>完成 / 关闭</button>
        </header>
        <div className="photo-modal-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="dashboard-kicker">Filter Workspace</div>
          
          <div className="mt-1 text-xs text-textSecondary">同列多选 OR · 多列 AND · 高级嵌套条件</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className={mode==="columns"?"button-primary":"button-secondary"} type="button"
            onClick={()=>setMode("columns")}>元数据列</button>
          <button className={mode==="advanced"?"button-primary":"button-secondary"} type="button"
            onClick={()=>setMode("advanced")}>高级规则</button>
          <button className="button-secondary" type="button" onClick={()=>void save()}>保存预设</button>
          <button className="button-secondary" type="button" onClick={()=>void exportPhotoData(filter).catch(e=>setMessage(showError(e)))}>
            导出筛选结果
          </button>
        </div>
      </div>
      {mode==="columns"?<div key="columns" className="photo-view-enter space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {columns.map(col=><div key={col.id} className="photo-view-enter min-w-0 rounded-xl border border-line bg-panelAlt/60 p-3 space-y-2">
            <div className="flex items-center gap-1">
              <select className="input min-w-0 flex-1" aria-label="列字段" value={col.field}
                onChange={e=>{setColumns(items=>items.map(item=>item.id===col.id?{...item,field:e.target.value,selected:[]}:item));setPage(0);}}>
                {fields.map(f=><option key={f.field_id} value={f.field_id}>{f.label}</option>)}
              </select>
              <button type="button" aria-label="移除筛选列" className="button-secondary px-2"
                disabled={columns.length===1} onClick={()=>{setColumns(items=>items.filter(x=>x.id!==col.id));setPage(0);}}>×</button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {(facets[col.id]?.field===col.field?facets[col.id].options:[]).map(item=>{
                const key=item.value==null?"__MISSING__":String(item.value);
                return <label className="flex gap-2 items-center text-xs cursor-pointer" key={key}>
                  <input type="checkbox" checked={col.selected.includes(key)}
                    onChange={()=>toggleOption(col,key)} />
                  <span className="min-w-0 truncate flex-1 text-textPrimary" title={key}>
                    {item.value==null?"未记录":String(item.value)}
                  </span>
                  <span className="text-textSecondary">{item.count}</span>
                </label>;
              })}
              {!(facets[col.id]?.field===col.field&&facets[col.id].options.length)?<p className="text-xs text-textSecondary">当前无选项</p>:null}
            </div>
          </div>)}
          {columns.length<8?<button className="button-secondary self-start min-h-[56px] w-full border-dashed" type="button"
            onClick={()=>setColumns(items=>[...items,{id:Math.max(...items.map(x=>x.id))+1,
              field:fields.find(f=>!items.some(x=>x.field===f.field_id))?.field_id||"exposure.iso",selected:[]}])}>
            + 添加列
          </button>:null}
        </div>
        <p className="text-xs text-textSecondary">已选 {selectedCount} 项。高级条件始终叠加生效，切换视图不会清除高级规则。</p>
      </div>:<div key="advanced" className="photo-view-enter space-y-3">
        <p className="text-sm text-textSecondary">条件组可以嵌套 AND / OR / NOT；与元数据列条件同时生效。</p>
        <AdvancedRules rule={advanced} fields={fields} onChange={node=>{setAdvanced(node);setPage(0);}}/>
      </div>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="button-secondary" type="button" onClick={()=>{setColumns(initialColumns);setAdvanced(emptyGroup());setPage(0);}}>
          清除全部条件
        </button>
        <span className="text-xs text-textSecondary">符合条件 {formatCount(summary?.logical_captures)} 次拍摄 / {formatCount(summary?.physical_files)} 个文件</span>
      </div>
      {presets.length?<div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <span className="text-xs text-textSecondary self-center">已存预设：</span>
        {presets.map(p=><span key={p.id} className="inline-flex gap-1 items-center rounded-xl bg-panelAlt px-2 py-1">
          <button type="button" className="text-xs text-textPrimary" onClick={()=>applyPreset(p)}>{p.name}</button>
          <button type="button" aria-label={"删除预设"+p.name} className="text-xs text-textSecondary"
            onClick={()=>void deletePhotoPreset(p.id).then(()=>getPhotoPresets()).then(setPresets).catch(e=>setMessage(showError(e)))}>×</button>
        </span>)}
      </div>:null}
    
        </div>
      </section>
    </div>,document.body):null}

    {workspace==="charts"?
      <PhotoAnalyticsDashboard filter={filter} refresh={refresh} onApplyRules={applyChartFilter}/>:
      <PhotoMetadataExplorer
        results={results} loading={loading} page={page} pageSize={pageSize}
        search={fileSearch} onSearchChange={value=>{setFileSearch(value);setPage(0);}}
        onPageChange={setPage} onPageSizeChange={value=>{setPageSize(value);setPage(0);}}
        onExport={()=>void exportPhotoData(fileFilter).catch(e=>setMessage(showError(e)))}/>
    }
  </div>;
}
