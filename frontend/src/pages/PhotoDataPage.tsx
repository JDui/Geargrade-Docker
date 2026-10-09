import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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

function AdvancedRules({rule,fields,onChange,onRemove,level=0}:{
  rule:PhotoRule; fields:PhotoField[]; onChange:(node:PhotoRule)=>void;
  onRemove?:()=>void; level?:number;
}) {
  if (isGroup(rule)) {
    return <div className="space-y-2 border-l-2 border-accent/30 pl-3 py-2">
      <div className="flex flex-wrap gap-2 items-center">
        <select className="input-field" aria-label="条件组逻辑" value={rule.op}
          onChange={(e)=>onChange({op:e.target.value as "and"|"or"|"not",children:e.target.value==="not"?rule.children.slice(0,1):rule.children})}>
          <option value="and">全部满足 (AND)</option><option value="or">任意满足 (OR)</option>
          <option value="not">排除组 (NOT)</option>
        </select>
        <button className="button-secondary" type="button" disabled={level>=5||(rule.op==="not"&&rule.children.length>0)}
          onClick={()=>onChange({...rule,children:[...rule.children,newLeaf()]})}>+ 条件</button>
        <button className="button-secondary" type="button" disabled={level>=5||(rule.op==="not"&&rule.children.length>0)}
          onClick={()=>onChange({...rule,children:[...rule.children,{op:"and",children:[newLeaf()]}]})}>+ 分组</button>
        {onRemove?<button className="button-secondary" type="button" onClick={onRemove}>删除组</button>:null}
      </div>
      {rule.children.map((child,index)=><AdvancedRules key={index} rule={child} fields={fields} level={level+1}
        onChange={(next)=>onChange({...rule,children:rule.children.map((n,i)=>i===index?next:n)})}
        onRemove={()=>onChange({...rule,children:rule.children.filter((_,i)=>i!==index)})}/>)}
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
    <select className="input-field max-w-full" aria-label="筛选字段" value={rule.field} onChange={e=>changeField(e.target.value)}>
      {fields.map(f=><option key={f.field_id} value={f.field_id}>{f.label}</option>)}
    </select>
    <select className="input-field" aria-label="筛选操作符" value={op}
      onChange={e=>onChange({field:rule.field,op:e.target.value,
        ...(e.target.value==="is_missing"||e.target.value==="is_present"?{}:{value:e.target.value==="between"?[0,100]:(isNum?0:"")})})}>
      <option value="eq">等于</option><option value="ne">不等于</option>
      <option value="gte">大于等于</option><option value="gt">大于</option>
      <option value="lte">小于等于</option><option value="lt">小于</option>
      <option value="between">介于（含两端）</option>
      {!isNum?<option value="contains">包含文字</option>:null}
      <option value="is_missing">未记录</option><option value="is_present">有值</option>
    </select>
    {op!=="is_missing"&&op!=="is_present"?(op==="between"?
      <div className="flex gap-2 items-center">
        {[0,1].map(index=><input key={index} className="input-field w-24" aria-label={index?"最大值":"最小值"}
          type={isNum?"number":"text"} value={String(twoValues[index]??"")}
          onChange={e=>{
            const next=[...twoValues] as Array<string|number>;
            next[index]=isNum?Number(e.target.value):e.target.value;
            onChange({field:rule.field,op:rule.op,value:next});
          }}/>)}
      </div>:
      <input className="input-field w-36" aria-label="比较值" type={isNum?"number":"text"}
        value={String(rule.value??"")} onChange={e=>onChange({field:rule.field,op:rule.op,
          value:isNum?Number(e.target.value):e.target.value})}/>
    ):null}
    {onRemove?<button type="button" className="button-secondary" onClick={onRemove}>移除</button>:null}
  </div>;
}

function enummerationDoneGuard(run:PhotoScan|null):number|null {
  if(!run?.enumeration_done||!run.rate_files_per_sec||run.rate_files_per_sec<=0) return null;
  return Math.max(0,Math.round((run.seen-run.processed)/run.rate_files_per_sec));
}

export default function PhotoDataPage() {
  const [queryParams] = useSearchParams();
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
    const timer=window.setInterval(()=>{
      void getPhotoScan(runId).then(r=>{
        setRun(r);
        if(!["running","queued"].includes(r.status)){
          setRunId(null);
          setRefresh(x=>x+1);
          if(r.error)setMessage(r.error);
        }
      }).catch(e=>setMessage(showError(e)));
    },1200);
    return ()=>window.clearInterval(timer);
  },[runId]);

  useEffect(()=>{
    let active=true;
    setLoading(true);
    Promise.all([getPhotoSummary(filter),getPhotoQuery(filter,40,page*40)])
      .then(([s,r])=>{if(active){setSummary(s);setResults(r);setLoading(false);}})
      .catch(e=>{if(active){setMessage(showError(e));setLoading(false);}});
    return ()=>{active=false;};
  },[filterKey,page,refresh]);

  useEffect(()=>{
    let active=true;
    void Promise.all(columns.map(async col=>[col.id,await getPhotoFacet(filter,col.field)] as const))
      .then(pairs=>{if(active)setFacets(Object.fromEntries(pairs));})
      .catch(e=>{if(active)setMessage(showError(e));});
    return ()=>{active=false;};
  },[filterKey,refresh]);

  async function start() {
    setMessage("");
    try {
      const result=await startPhotoScan(scanMode,confirmRemovals);
      setRunId(result.job_id);
      setRun(null);
    } catch(e) {setMessage(showError(e));}
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
    setColumns(p.columns.slice(0,8).map((field,i)=>({id:i+1,field,selected:[]})));
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

  const selectedCount=columns.reduce((total,c)=>total+c.selected.length,0);
  const sourceReady=!!status?.sources.length;
  const isRunning=!!runId||!!status?.recent_scans.some(x=>["queued","running"].includes(x.status));
  const latestRun=run??status?.recent_scans[0]??null;
  const enumerationDone=!!latestRun?.enumeration_done;
  const doneCount=latestRun?.processed??0;
  const foundCount=latestRun?.seen??0;
  const progressPercent=latestRun?.status==="completed"?100:
    enumerationDone&&foundCount>0?Math.min(99,Math.round(doneCount/foundCount*100)):null;
  const remaining=enummerationDoneGuard(latestRun);
  const phaseName:Record<string,string>={
    queued:"排队中",preflight:"检查挂载",enumerating:"发现文件并解析元数据",
    extracting:"等待剩余解析任务",publishing:"发布完整索引",
    completed_source:"来源完成",completed:"已完成",
    interrupted:"意外中断",failed:"失败",cancelled:"已取消"
  };

  return <div className="space-y-6">
    <section className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="dashboard-kicker">Photography Analytics · 1.0.0</div>
          <h1 className="mt-2 text-3xl font-bold text-textPrimary">拍摄数据</h1>
          <p className="mt-2 text-sm text-textSecondary">离线 EXIF 索引 · 只读照片目录 · 手动扫描更新</p>
          <p className="mt-2 text-xs text-textSecondary">上次成功扫描：{displayDate(status?.last_success)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="扫描模式" className="input-field" value={scanMode} onChange={e=>setScanMode(e.target.value)}
            disabled={isRunning}>
            <option value="incremental">增量扫描</option><option value="deep">深度重扫</option>
          </select>
          <button className="button-primary" type="button" disabled={!sourceReady||isRunning} onClick={()=>void start()}>
            {isRunning?"扫描中…":"扫描更新"}
          </button>
          {isRunning&&runId?<button type="button" className="button-secondary"
            onClick={()=>void cancelPhotoScan(runId)}>取消</button>:null}
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
          <span>{progressPercent===null?"正在发现文件，尚无法确定总量":progressPercent+"%"} </span>
        </div>
        <div role="progressbar" aria-label="扫描进度" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={progressPercent??undefined} aria-valuetext={progressPercent===null?"正在枚举目录，进度未确定":progressPercent+"%" }
          className="h-3 w-full overflow-hidden rounded-full bg-line">
          <div className={"h-full rounded-full bg-accent transition-all duration-500 "+(progressPercent===null?"w-1/4 animate-pulse":"")}
            style={progressPercent===null?undefined:{width:progressPercent+"%"}} />
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
      {message?<p role="alert" className="mt-3 text-sm text-textSecondary">{message}</p>:null}
    </section>

    <section className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {[
        ["逻辑拍摄次数",summary?.logical_captures],
        ["物理文件数",summary?.physical_files],
        ["RAW 文件数",summary?.raw_files],
        ["图库容量",summary?Math.round(summary.total_bytes/(1024*1024))+" MiB":null]
      ].map(([label,value])=><div key={String(label)} className="panel p-4">
        <div className="text-xs text-textSecondary">{label}</div>
        <div className="text-xl font-bold text-textPrimary mt-2">
          {value==null?"—":typeof value==="number"?formatCount(value):value}
        </div>
      </div>)}
    </section>

    <section className="panel p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="dashboard-kicker">Metadata Filter</div>
          <h2 className="mt-1 text-xl font-semibold text-textPrimary">筛选条件</h2>
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
      {mode==="columns"?<div className="space-y-3">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {columns.map(col=><div key={col.id} className="shrink-0 w-56 rounded-xl border border-line bg-panelAlt/60 p-3 space-y-2">
            <div className="flex items-center gap-1">
              <select className="input-field min-w-0 flex-1" aria-label="列字段" value={col.field}
                onChange={e=>{setColumns(items=>items.map(item=>item.id===col.id?{...item,field:e.target.value,selected:[]}:item));setPage(0);}}>
                {fields.map(f=><option key={f.field_id} value={f.field_id}>{f.label}</option>)}
              </select>
              <button type="button" aria-label="移除筛选列" className="button-secondary px-2"
                disabled={columns.length===1} onClick={()=>setColumns(items=>items.filter(x=>x.id!==col.id))}>×</button>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-1">
              {(facets[col.id]?.options??[]).map(item=>{
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
              {!(facets[col.id]?.options.length)?<p className="text-xs text-textSecondary">当前无选项</p>:null}
            </div>
          </div>)}
          {columns.length<8?<button className="button-secondary shrink-0 self-start" type="button"
            onClick={()=>setColumns(items=>[...items,{id:Math.max(...items.map(x=>x.id))+1,
              field:fields.find(f=>!items.some(x=>x.field===f.field_id))?.field_id||"exposure.iso",selected:[]}])}>
            + 添加列
          </button>:null}
        </div>
        <p className="text-xs text-textSecondary">已选 {selectedCount} 项。高级条件始终叠加生效，切换视图不会清除高级规则。</p>
      </div>:<div className="space-y-3">
        <p className="text-sm text-textSecondary">条件组可以嵌套 AND / OR / NOT；与元数据列条件同时生效。</p>
        <AdvancedRules rule={advanced} fields={fields} onChange={node=>{setAdvanced(node);setPage(0);}}/>
      </div>}
      <div className="flex flex-wrap items-center gap-2">
        <button className="button-secondary" type="button" onClick={()=>{setColumns(initialColumns);setAdvanced(emptyGroup());setPage(0);}}>
          清除全部条件
        </button>
        <span className="text-xs text-textSecondary">符合条件 {formatCount(results?.total_captures)} 次拍摄 / {formatCount(results?.total_files)} 个文件</span>
      </div>
      {presets.length?<div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <span className="text-xs text-textSecondary self-center">已存预设：</span>
        {presets.map(p=><span key={p.id} className="inline-flex gap-1 items-center rounded-xl bg-panelAlt px-2 py-1">
          <button type="button" className="text-xs text-textPrimary" onClick={()=>applyPreset(p)}>{p.name}</button>
          <button type="button" aria-label={"删除预设"+p.name} className="text-xs text-textSecondary"
            onClick={()=>void deletePhotoPreset(p.id).then(()=>getPhotoPresets()).then(setPresets).catch(e=>setMessage(showError(e)))}>×</button>
        </span>)}
      </div>:null}
    </section>

    <section className="panel p-5">
      <div className="dashboard-kicker">Shooting Timeline</div>
      <h2 className="mt-1 text-xl font-semibold text-textPrimary">每月拍摄次数</h2>
      <div className="mt-5 h-64">
        {summary?.months.length?<ResponsiveContainer width="100%" height="100%">
          <BarChart data={summary.months}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.2}/>
            <XAxis dataKey="month" tick={{fontSize:11}}/>
            <YAxis allowDecimals={false} tick={{fontSize:11}}/>
            <Tooltip/><Bar dataKey="count" fill="#5cc8ff" name="拍摄次数"/>
          </BarChart>
        </ResponsiveContainer>:<div className="h-full flex items-center justify-center text-textSecondary text-sm">
          {loading?"统计查询中…":"无有效拍摄日期记录"}
        </div>}
      </div>
    </section>

    <section className="panel p-5 overflow-x-auto">
      <div className="flex items-center justify-between gap-3">
        <div><div className="dashboard-kicker">Indexed Files</div>
          <h2 className="mt-1 text-xl font-semibold text-textPrimary">文件元数据</h2></div>
        <div className="text-xs text-textSecondary">仅展示 SQL 索引，不访问源文件</div>
      </div>
      <table className="mt-4 w-full min-w-[760px] text-left text-sm">
        <thead className="text-textSecondary border-b border-line">
          <tr>{["文件名","拍摄时间","相机","镜头","类型","ISO","光圈","焦距","大小"].map(h=><th key={h} className="px-2 py-3">{h}</th>)}</tr>
        </thead>
        <tbody>{results?.items.map(file=><tr key={file.id} className="border-b border-line/50 text-textPrimary">
          <td className="px-2 py-3 max-w-44 truncate" title={file.relpath}>{file.filename}</td>
          <td className="px-2 py-3 whitespace-nowrap">{file.shot_at?.slice(0,16)||"—"}</td>
          <td className="px-2 py-3">{file.camera_model||"—"}</td>
          <td className="px-2 py-3 max-w-48 truncate">{file.lens_model||"—"}</td>
          <td className="px-2 py-3 uppercase">{file.format_family}</td>
          <td className="px-2 py-3">{file.iso??"—"}</td>
          <td className="px-2 py-3">{file.aperture?"F"+file.aperture:"—"}</td>
          <td className="px-2 py-3">{file.focal_mm?file.focal_mm+" mm":"—"}</td>
          <td className="px-2 py-3">{(file.size_bytes/1048576).toFixed(1)} MiB</td>
        </tr>)}</tbody>
      </table>
      {!results?.items.length?<p className="py-6 text-center text-sm text-textSecondary">没有匹配的索引照片。</p>:null}
      <div className="flex justify-between items-center mt-4">
        <button className="button-secondary" type="button" disabled={page===0}
          onClick={()=>setPage(x=>Math.max(0,x-1))}>上一页</button>
        <span className="text-xs text-textSecondary">第 {page+1} 页</span>
        <button className="button-secondary" type="button" disabled={!results||results.total_files<=(page+1)*40}
          onClick={()=>setPage(x=>x+1)}>下一页</button>
      </div>
    </section>
  </div>;
}
