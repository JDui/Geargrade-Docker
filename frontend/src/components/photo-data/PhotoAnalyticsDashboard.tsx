import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  getPhotoAnalytics, type AnalyticsBucket, type AnalyticsCount,
  type AnalyticsHeatCell, type AnalyticsPoint, type PhotoAnalytics,
  type PhotoFilter, type PhotoRule
} from "../../api/photoData";

import { useAppSettings } from "../layout/AppSettingsProvider";

const ChartMotion = createContext(false);
function useChartMotion() {
  const reduced = useContext(ChartMotion);
  return { isAnimationActive: !reduced, animationDuration: 420, animationBegin: 0, animationEasing: "ease-out" as const };
}

type Tab = "overview" | "gear" | "exposure" | "timeline" | "files";
const tabs: { id: Tab; label: string }[] = [
  { id: "overview", label: "总览" }, { id: "gear", label: "器材与组合" },
  { id: "exposure", label: "曝光与焦距" }, { id: "timeline", label: "拍摄时间" },
  { id: "files", label: "文件与质量" }
];
const colors = ["#5cc8ff","#b4a3ff","#ffc76f","#6fdbbd","#ff95b0","#98b7ef","#e9a6e0","#9cd67e"];
const weekdays = ["周一","周二","周三","周四","周五","周六","周日"];
const count = (n:number|null|undefined) => Number(n||0).toLocaleString("zh-CN");
const ratio = (n:number,total:number) => total ? (n*100/total).toFixed(1)+"%" : "—";
const short = (s:string,n=20) => s.length>n?s.slice(0,n-1)+"…":s;
const fieldRules = (field:string,name:string):PhotoRule[] =>
  name==="未记录"?[{field,op:"is_missing"}]:[{field,op:"eq",value:name}];
const rangeRules = (field:string,min:number|null,max:number|null):PhotoRule[] => [
  ...(min===null?[]:[{field,op:"gte",value:min} as PhotoRule]),
  ...(max===null?[]:[{field,op:"lt",value:max} as PhotoRule])
];
const hint = "点击图表可叠加筛选条件";

function Panel({title,desc,children,wide=false}:{
  title:string;desc:string;children:ReactNode;wide?:boolean;
}) {
  return <section className={"photo-chart-panel panel p-4 sm:p-5 min-w-0 "+(wide?"lg:col-span-2":"")}>
    <h3 className="text-base font-semibold text-textPrimary">{title}</h3>
    <p className="mt-1 text-xs leading-5 text-textSecondary">{desc}</p>
    <div className="mt-4">{children}</div>
  </section>;
}
function NoData(){return <div className="h-48 flex items-center justify-center text-sm text-textSecondary">当前筛选条件下没有可用记录</div>;}

function Trend({title,desc,items,field,choose}:{
  title:string;desc:string;items:AnalyticsPoint[];field:string;choose:(field:string,name:string)=>void;
}) {
  const motion = useChartMotion();
  const shown=items.slice(-100);
  return <Panel title={title} desc={desc}>
    {shown.length?<div className="w-full h-60"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={shown} margin={{top:5,right:12,bottom:5,left:-20}}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.14}/>
        <XAxis dataKey="key" tick={{fontSize:10}} minTickGap={20}/>
        <YAxis allowDecimals={false} tick={{fontSize:10}}/>
        <Tooltip formatter={value=>[count(Number(value)),"拍摄次数"]}/>
        <Bar {...motion} dataKey="count" fill={colors[0]} maxBarSize={34} cursor="pointer"
          onClick={e=>{const item=(e as {payload?:AnalyticsPoint}).payload;if(item)choose(field,item.key);}}/>
      </BarChart>
    </ResponsiveContainer></div>:<NoData/>}
    <p className="mt-1 text-[11px] text-textSecondary">{hint}，最多展示最近 100 个周期</p>
  </Panel>;
}
function Ranking({title,desc,items,onChoose,max=12}:{
  title:string;desc:string;items:AnalyticsCount[];onChoose?:(name:string)=>void;max?:number;
}) {
  const motion = useChartMotion();
  const shown=items.slice(0,max);
  return <Panel title={title} desc={desc}>
    {shown.length?<div style={{height:Math.max(210,shown.length*29+40)}}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={shown.map(v=>({...v,short:short(v.name,20)}))}
          margin={{top:0,right:18,bottom:2,left:0}}>
          <XAxis type="number" tick={{fontSize:10}} allowDecimals={false}/>
          <YAxis type="category" dataKey="short" tick={{fontSize:10}} width={112}/>
          <Tooltip formatter={v=>[count(Number(v)),"次"]}
            labelFormatter={(_,p)=>String((p[0]?.payload as AnalyticsCount|undefined)?.name||"")}/>
          <Bar {...motion} dataKey="count" fill={colors[0]} radius={[0,3,3,0]}
            cursor={onChoose?"pointer":"default"} onClick={e=>{
              const item=(e as {payload?:AnalyticsCount}).payload;
              if(item?.name)onChoose?.(item.name);
            }}/>
        </BarChart>
      </ResponsiveContainer>
    </div>:<NoData/>}
    {onChoose&&<p className="mt-1 text-[11px] text-textSecondary">{hint}</p>}
  </Panel>;
}
function Buckets({title,desc,items,onChoose}:{
  title:string;desc:string;items:AnalyticsBucket[];onChoose?:(b:AnalyticsBucket)=>void;
}) {
  const motion = useChartMotion();
  return <Panel title={title} desc={desc}>
    {items.some(b=>b.count>0)?<div className="h-64"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={items} margin={{top:5,right:5,bottom:5,left:-24}}>
        <CartesianGrid strokeDasharray="3 3" opacity={0.14}/>
        <XAxis dataKey="label" tick={{fontSize:9}} angle={-35} textAnchor="end" height={68} interval="preserveStartEnd"/>
        <YAxis allowDecimals={false} tick={{fontSize:10}}/>
        <Tooltip formatter={v=>[count(Number(v)),"次数"]}/>
        <Bar {...motion} dataKey="count" fill={colors[2]} maxBarSize={40} cursor={onChoose?"pointer":"default"}
          onClick={e=>{const b=(e as {payload?:AnalyticsBucket}).payload;if(b)onChoose?.(b);}}/>
      </BarChart>
    </ResponsiveContainer></div>:<NoData/>}
    {onChoose&&<p className="mt-1 text-[11px] text-textSecondary">{hint}（按数值区间）</p>}
  </Panel>;
}
function Donut({title,desc,items,onChoose}:{
  title:string;desc:string;items:AnalyticsCount[];onChoose?:(name:string)=>void;
}) {
  const motion = useChartMotion();
  const shown=items.filter(x=>x.count>0).slice(0,12);
  const total=shown.reduce((s,x)=>s+x.count,0);
  return <Panel title={title} desc={desc}>
    {shown.length?<div className="grid sm:grid-cols-[175px_1fr] gap-3 items-center">
      <div className="h-48"><ResponsiveContainer width="100%" height="100%">
        <PieChart><Pie {...motion} data={shown} dataKey="count" nameKey="name"
          cx="50%" cy="50%" innerRadius={46} outerRadius={78} paddingAngle={2} stroke="none">
          {shown.map((_,i)=><Cell key={i} fill={colors[i%colors.length]}/>)}
        </Pie><Tooltip formatter={v=>[count(Number(v)),"次数"]}/></PieChart>
      </ResponsiveContainer></div>
      <div className="space-y-1.5 max-h-52 overflow-y-auto">
        {shown.map((x,i)=><button type="button" key={x.name} disabled={!onChoose}
          className="flex w-full gap-2 items-center justify-between text-left text-xs text-textSecondary enabled:hover:text-accent"
          title={x.name} onClick={()=>onChoose?.(x.name)}>
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{backgroundColor:colors[i%colors.length]}}/>
            <span className="truncate">{x.name}</span>
          </span><span className="shrink-0">{ratio(x.count,total)}</span>
        </button>)}
      </div>
    </div>:<NoData/>}
  </Panel>;
}
function Heat({title,desc,xs,ys,data,onChoose}:{
  title:string;desc:string;xs:string[];ys:string[];data:AnalyticsHeatCell[];
  onChoose?:(x:number,y:number)=>void;
}) {
  const values=new Map(data.map(v=>[v.x+","+v.y,v.count]));
  const peak=Math.max(1,...data.map(v=>v.count));
  return <Panel title={title} desc={desc} wide={xs.length>12}>
    {xs.length&&ys.length?<div className="overflow-x-auto pb-2">
      <div className="w-max">
        <div className="flex gap-1 ml-[112px] mb-2">
          {xs.map((x,i)=><span key={i} className="w-9 text-center text-[10px] text-textSecondary" title={x}>{short(x,5)}</span>)}
        </div>
        {ys.map((label,y)=><div key={label} className="flex gap-1 items-center mb-1">
          <span className="w-[108px] shrink-0 text-right truncate pr-2 text-[10px] text-textSecondary" title={label}>
            {short(label,16)}
          </span>
          {xs.map((x,i)=>{
            const n=values.get(i+","+y)||0;
            const opacity=n?.15+Math.sqrt(n/peak)*.8:.045;
            return <button key={i} type="button" disabled={!n||!onChoose}
              aria-label={label+" × "+x+"："+n+"次"} title={label+" × "+x+"："+count(n)+"次"}
              className="w-9 h-8 rounded text-[10px] text-textPrimary enabled:hover:ring-1 enabled:hover:ring-accent"
              style={{backgroundColor:"rgba(92,200,255,"+opacity+")"}} onClick={()=>onChoose?.(i,y)}>
              {n?count(n):"·"}
            </button>;
          })}
        </div>)}
      </div>
    </div>:<NoData/>}
    {onChoose&&<p className="text-[11px] text-textSecondary mt-1">{hint}（二维联合条件）</p>}
  </Panel>;
}
function Calendar({daily,choose}:{
  daily:PhotoAnalytics["timeline"]["daily"];choose:(field:string,name:string)=>void;
}) {
  const years=useMemo(()=>[...new Set(daily.map(d=>d.date.slice(0,4)))].sort().reverse(),[daily]);
  const [requested,setRequested]=useState("");
  const year=years.includes(requested)?requested:years[0];
  const observations=new Map(daily.filter(d=>d.date.startsWith(year)).map(d=>[d.date,d.count]));
  const max=Math.max(1,...observations.values());
  const start=year?Date.UTC(Number(year),0,1):0;
  const offset=year?(new Date(start).getUTCDay()+6)%7:0;
  const days=year?(Date.UTC(Number(year)+1,0,1)-start)/86400000:0;
  return <Panel title="全年拍摄日历热力图" desc="每格一天，显示实际拍摄活跃度（不是文件数）" wide>
    {year?<div>
      <label className="text-xs text-textSecondary">选择年份
        <select className="input ml-2 w-auto" value={year} onChange={e=>setRequested(e.target.value)}>
          {years.map(y=><option key={y} value={y}>{y}</option>)}
        </select>
      </label>
      <div className="mt-4 overflow-x-auto pb-2">
        <div className="grid grid-flow-col w-max gap-1" style={{gridTemplateRows:"repeat(7,14px)"}}>
          {Array.from({length:offset},(_,i)=><div className="w-3.5 h-3.5" key={"gap"+i}/>)}
          {Array.from({length:days},(_,i)=>{
            const date=new Date(start+i*86400000).toISOString().slice(0,10);
            const v=observations.get(date)||0;
            return <button key={date} className="w-3.5 h-3.5 rounded-[3px] hover:ring-1 hover:ring-accent"
              type="button" title={date+": "+count(v)+"次"} aria-label={date+"拍摄"+v+"次"}
              onClick={()=>choose("capture.date",date)}
              style={{backgroundColor:"rgba(92,200,255,"+(v?.15+Math.sqrt(v/max)*.82:.05)+")"}}/>;
          })}
        </div>
      </div>
      <p className="text-xs text-textSecondary mt-1">{hint}，未拍摄日期显示为空白浅色方块</p>
    </div>:<NoData/>}
  </Panel>;
}
function CameraByYear({data,cameras,onChoose}:{
  data:PhotoAnalytics["gear"]["camera_years"];cameras:AnalyticsCount[];
  onChoose:(name:string)=>void;
}) {
  const motion = useChartMotion();
  const top=cameras.filter(x=>x.name!=="未记录").slice(0,6).map(x=>x.name);
  const years=[...new Set(data.map(d=>d.year))].sort();
  const series=years.map(year=>{
    const row:Record<string,string|number>={year};
    top.forEach((name,i)=>row["series"+i]=data.find(x=>x.year===year&&x.camera===name)?.count||0);
    return row;
  });
  return <Panel title="年度机身更替" desc="最多六款常用机身的年度拍摄次数堆叠面积图" wide>
    {series.length&&top.length?<div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{top:6,right:12,bottom:0,left:-15}}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.15}/>
          <XAxis dataKey="year" tick={{fontSize:11}}/>
          <YAxis allowDecimals={false} tick={{fontSize:10}}/>
          <Tooltip formatter={v=>[count(Number(v)),"拍摄次数"]}/><Legend/>
          {top.map((name,i)=><Area {...motion} key={name} dataKey={"series"+i}
            name={short(name,22)} stackId="1" type="monotone"
            stroke={colors[i%colors.length]} fill={colors[i%colors.length]} fillOpacity={0.65}/>)}
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-2 mt-2">{top.map(name=><button key={name}
        className="text-xs text-accent hover:underline" type="button"
        onClick={()=>onChoose(name)}>{short(name,25)}</button>)}</div>
    </div>:<NoData/>}
  </Panel>;
}
function Coverage({records,filterMissing}:{
  records:PhotoAnalytics["quality"];filterMissing:(name:string)=>void;
}) {
  return <Panel title="EXIF 元数据完整度" desc="占比基于当前筛选后的逻辑拍摄次数，缺失值不按 0 处理" wide>
    {records.some(r=>r.total)?<div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {records.map(r=><button className="text-left group" key={r.name} type="button"
        title="筛选缺少此元数据的照片" onClick={()=>filterMissing(r.name)}>
        <div className="flex justify-between text-xs text-textSecondary mb-1">
          <span className="group-hover:text-accent">{r.name}</span>
          <span>{count(r.count)} / {count(r.total)} · {ratio(r.count,r.total)}</span>
        </div>
        <div className="rounded-full h-2 bg-panelAlt overflow-hidden">
          <div className="photo-scan-fill" style={{transform:`scaleX(${r.total?r.count/r.total:0})`}}/>
        </div>
      </button>)}
    </div>:<NoData/>}
  </Panel>;
}
export function PhotoAnalyticsDashboard({filter,refresh,onApplyRules:applyRules}:{
  filter:PhotoFilter;refresh:number;onApplyRules:(rules:PhotoRule[])=>void;
}) {
  const { reduceMotion } = useAppSettings();
  const [tab,setTab]=useState<Tab>("overview");
  const [data,setData]=useState<PhotoAnalytics|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const serialized=JSON.stringify(filter);
  useEffect(()=>{
    let active=true;setLoading(true);setError("");
    void getPhotoAnalytics(filter).then(value=>{if(active){setData(value);setLoading(false);}})
      .catch(e=>{if(active){setError(String(e));setLoading(false);}});
    return ()=>{active=false;};
  },[serialized,refresh]);
  const d=data;
  const onApplyRules=(rules:PhotoRule[])=>{if(!loading&&!error)applyRules(rules);};
  const choose=(field:string,name:string)=>onApplyRules(fieldRules(field,name));
  const bin=(b:AnalyticsBucket)=>onApplyRules(rangeRules(b.field,b.min,b.max));
  const isoRanges:[[number|null,number|null],...(number|null)[][]]=[[null,200],[200,800],[800,3200],[3200,12800],[12800,null]];
  const shutterRanges:[[number|null,number|null],...(number|null)[][]]=[[null,.001],[.001,.01],[.01,.1],[.1,1],[1,null]];
  const focalRanges:[[number|null,number|null],...(number|null)[][]]=[[null,24],[24,50],[50,100],[100,200],[200,null]];
  const apRanges:[[number|null,number|null],...(number|null)[][]]=[[null,2],[2,4],[4,8],[8,16],[16,null]];
  return <ChartMotion.Provider value={reduceMotion}><section className="space-y-4" aria-busy={loading}>
    <div className="flex flex-wrap justify-between gap-3 items-end">
      <div><div className="dashboard-kicker">Photography Analytics</div>
        <h2 className="text-2xl font-semibold text-textPrimary mt-1">拍摄数据分析</h2>
        <p className="text-sm text-textSecondary mt-1">所有图表共享筛选条件；服务器聚合统计，不读取原片</p>
      </div>
      <span className="text-xs text-textSecondary">统计快照：{d?.as_of?new Date(d.as_of).toLocaleString("zh-CN"):"尚未扫描"}</span>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="图表类别">
      {tabs.map(t=><button key={t.id} type="button" role="tab" id={"photo-tab-"+t.id} aria-controls={"photo-panel-"+t.id}
        tabIndex={tab===t.id?0:-1} aria-selected={tab===t.id}
        className={"shrink-0 "+(tab===t.id?"button-primary":"button-secondary")}
        onClick={()=>setTab(t.id)} onKeyDown={e=>{
          const index=tabs.findIndex(item=>item.id===tab);
          const next=e.key==="ArrowRight"?(index+1)%tabs.length:e.key==="ArrowLeft"?(index+tabs.length-1)%tabs.length:
            e.key==="Home"?0:e.key==="End"?tabs.length-1:null;
          if(next===null)return;
          e.preventDefault();setTab(tabs[next].id);
          document.getElementById("photo-tab-"+tabs[next].id)?.focus();
        }}>{t.label}</button>)}
    </div>
    {error?<div role="alert" className="panel p-4 text-danger">{error}</div>:null}
    <div className="photo-loading-slot" role="status" aria-live="polite">
      {loading?<span className="inline-flex items-center gap-2 text-xs text-accent">
        <span className="photo-loading-dot" aria-hidden="true"/>{d?"正在更新图表，保留上一份统计…":"正在聚合统计图表…"}
      </span>:null}
    </div>
    {loading&&!d?<div className="photo-skeleton-grid" aria-hidden="true">
      {Array.from({length:4},(_,i)=><div key={i} className="panel photo-skeleton"/>)}
    </div>:null}
    {!error&&d?<div key={tab} id={"photo-panel-"+tab} aria-labelledby={"photo-tab-"+tab} role="tabpanel"
      className={"photo-chart-grid grid grid-cols-1 lg:grid-cols-2 gap-4 "+(loading?"photo-chart-refreshing":"")} tabIndex={0}>
      {tab==="overview"&&<>
        <Panel wide title="图库指标" desc="真实照片文件数与逻辑快门次数严格分开统计">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              ["逻辑拍摄",count(d.overview.captures)],
              ["物理文件",count(d.overview.files)],
              ["含 RAW 拍摄",count(d.overview.raw_captures)],
              ["RAW 拍摄占比",ratio(d.overview.raw_captures,d.overview.captures)],
              ["RAW+JPEG 同拍",count(d.overview.paired_captures)],
              ["索引照片容量",(d.overview.bytes/1073741824).toFixed(1)+" GiB"]
            ].map(([k,v])=><div key={k} className="rounded-xl p-3 bg-panelAlt/80">
              <p className="text-[11px] text-textSecondary">{k}</p>
              <p className="mt-2 text-lg font-bold text-textPrimary">{v}</p>
            </div>)}
          </div>
        </Panel>
        <Trend title="年度拍摄趋势" desc="点击年度进行交叉筛选" items={d.timeline.yearly} field="capture.year" choose={choose}/>
        <Trend title="月度拍摄趋势" desc="最多展示最近 100 个月的拍摄数据" items={d.timeline.monthly} field="capture.month" choose={choose}/>
        <Ranking title="常用机身 Top 8" desc="逻辑拍摄数，未识别信息单独列出"
          items={d.gear.cameras} max={8} onChoose={name=>choose("camera.model_norm",name)}/>
        <Donut title="物理文件格式" desc="RAW 与 JPEG 双份分别计入文件数量"
          items={d.files.formats} onChoose={name=>choose("files.format_family",name)}/>
      </>}
      {tab==="timeline"&&<>
        <Calendar daily={d.timeline.daily} choose={choose}/>
        <Trend title="每年拍摄量" desc="按拍摄日期分组" items={d.timeline.yearly} field="capture.year" choose={choose}/>
        <Trend title="每月拍摄量" desc="按相机记录的当地日期分组" items={d.timeline.monthly} field="capture.month" choose={choose}/>
        <Ranking title="每天拍摄时段" desc="各小时逻辑拍摄次数" max={24}
          items={d.timeline.hours.map(x=>({name:String(x.hour).padStart(2,"0")+"时",count:x.count}))}
          onChoose={name=>choose("capture.hour",name.slice(0,2))}/>
        <Ranking title="星期使用分布" desc="周一至周日"
          items={weekdays.map((name,i)=>({name,count:d.timeline.weekdays.find(v=>v.weekday===i)?.count||0}))}
          onChoose={name=>onApplyRules([{field:"capture.weekday",op:"eq",value:weekdays.indexOf(name)}])}/>
        <Heat title="星期 × 小时热力图" desc="星期为行，24 小时为列；点击任意格子筛选"
          xs={Array.from({length:24},(_,i)=>String(i).padStart(2,"0"))} ys={weekdays}
          data={d.timeline.weekday_hour.map(x=>({x:x.hour,y:x.weekday,count:x.count}))}
          onChoose={(x,y)=>onApplyRules([
            {field:"capture.hour",op:"eq",value:String(x).padStart(2,"0")},
            {field:"capture.weekday",op:"eq",value:y}
          ])}/>
      </>}
      {tab==="gear"&&<>
        <CameraByYear data={d.gear.camera_years} cameras={d.gear.cameras}
          onChoose={name=>choose("camera.model_norm",name)}/>
        <Ranking title="机身使用次数 Top 16" desc="每次 RAW+JPEG 只算一次" items={d.gear.cameras}
          max={16} onChoose={name=>choose("camera.model_norm",name)}/>
        <Ranking title="镜头使用次数 Top 16" desc="部分厂商镜头信息依赖 MakerNotes" items={d.gear.lenses}
          max={16} onChoose={name=>choose("lens.model_norm",name)}/>
        <Donut title="相机品牌占比" desc="依据 EXIF 品牌，未记录会单独标出"
          items={d.gear.makers} onChoose={name=>choose("camera.make",name)}/>
        <Ranking title="最常用机身 + 镜头组合" desc="点击组合同时筛选机身和镜头"
          items={d.gear.combos.slice(0,12).map(x=>({name:x.camera+" + "+x.lens,count:x.count}))}
          onChoose={name=>{
            const found=d.gear.combos.find(x=>x.camera+" + "+x.lens===name);
            if(found)onApplyRules([...fieldRules("camera.model_norm",found.camera),
              ...fieldRules("lens.model_norm",found.lens)]);
          }}/>
        <GearMatrix cameras={d.gear.cameras} lenses={d.gear.lenses} data={d.gear.lens_by_camera}
          onChoose={(cam,lens)=>onApplyRules([...fieldRules("camera.model_norm",cam),...fieldRules("lens.model_norm",lens)])}/>
      </>}
      {tab==="exposure"&&<>
        <Buckets title="ISO 感光度分布" desc="按区间聚合的感光度直方图" items={d.exposure.iso} onChoose={bin}/>
        <Buckets title="焦距分布" desc="镜头真实焦距，未假设等效焦距" items={d.exposure.focal} onChoose={bin}/>
        <Buckets title="光圈分布" desc="F 值区间频率" items={d.exposure.aperture} onChoose={bin}/>
        <Buckets title="快门速度分布" desc="短曝光至长曝光，按照秒数区间" items={d.exposure.shutter} onChoose={bin}/>
        <Buckets title="曝光补偿分布" desc="正负 EV 值，未知不计入 0" items={d.exposure.ev} onChoose={bin}/>
        <Donut title="闪光灯使用记录" desc="依赖可读的闪光元数据"
          items={d.exposure.flash} onChoose={name=>choose("exposure.flash",name)}/>
        <Heat title="ISO × 快门热力图" desc="交叉分析光线强度、快门速度和感光度"
          xs={["<200","200–799","800–3199","3200–12799","≥12800"]}
          ys={["<1/1000s","1/1000–1/100s","1/100–1/10s","1/10–1s","≥1s"]}
          data={d.exposure.iso_shutter} onChoose={(x,y)=>onApplyRules([
            ...rangeRules("exposure.iso",isoRanges[x][0],isoRanges[x][1]),
            ...rangeRules("exposure.shutter",shutterRanges[y][0],shutterRanges[y][1])
          ])}/>
        <Heat title="焦距 × 光圈热力图" desc="揭示不同焦段偏好的实际光圈"
          xs={["<24mm","24–49","50–99","100–199","≥200"]}
          ys={["<F2","F2–3.9","F4–7.9","F8–15.9","≥F16"]}
          data={d.exposure.focal_aperture} onChoose={(x,y)=>onApplyRules([
            ...rangeRules("exposure.focal_mm",focalRanges[x][0],focalRanges[x][1]),
            ...rangeRules("exposure.aperture",apRanges[y][0],apRanges[y][1])
          ])}/>
        <Ranking title="白平衡设置" desc="相机白平衡 EXIF 值" items={d.exposure.wb}
          onChoose={name=>choose("camera.white_balance",name)}/>
        <Ranking title="对焦模式" desc="厂商扩展标签可用性因机型而异" items={d.exposure.focus}
          onChoose={name=>choose("camera.focus_mode",name)}/>
        <Ranking title="连拍与驱动模式" desc="单拍或连拍等机内设置" items={d.exposure.drive}
          onChoose={name=>choose("camera.drive_mode",name)}/>
        <Donut title="电子 / 机械快门类型" desc="取决于相机是否记录相应元数据" items={d.exposure.shutter_type}
          onChoose={name=>choose("camera.shutter_type",name)}/>
        <Ranking title="胶片模拟与创意风格" desc="富士胶片模拟、Sony 创意外观等" items={d.exposure.picture_style}
          onChoose={name=>choose("camera.picture_style",name)}/>
      </>}
      {tab==="files"&&<>
        <Donut title="物理文件格式分布" desc="RAW/JPEG/HEIF 等文件实际数量" items={d.files.formats}
          onChoose={name=>choose("files.format_family",name)}/>
        <Donut title="拍摄主文件格式" desc="每次拍摄只选一个代表文件（元数据完整度优先）" items={d.files.capture_formats}/>
        <Buckets title="文件大小分布" desc="单位 MiB，按物理文件统计" items={d.files.size} onChoose={bin}/>
        <Buckets title="分辨率分布" desc="照片元数据宽高相乘，单位百万像素" items={d.files.resolution} onChoose={bin}/>
        <Donut title="横竖拍占比" desc="通过 EXIF 像素宽高判定，未知项单独显示" items={d.files.orientation}/>
        <Donut title="画面长宽比" desc="3:2、4:3、16:9、1:1 等常见画幅" items={d.files.aspect}/>
        <Donut title="EXIF 解析成功率" desc="按物理文件计算的解析状态" items={d.files.status}
          onChoose={name=>choose("files.parse_status",name)}/>
        <Ranking title="后期软件分布" desc="原片或导出图片中可能有 Software 字段"
          items={d.files.software} onChoose={name=>choose("files.software",name)}/>
        <Donut title="色彩空间" desc="记录中的 sRGB、Adobe RGB 等" items={d.files.color_space}
          onChoose={name=>choose("files.color_space",name)}/>
        <Coverage records={d.quality} filterMissing={name=>{
          const fields:Record<string,string>={
            "拍摄时间":"capture.date","机身":"camera.model_norm","镜头":"lens.model_norm",
            "ISO":"exposure.iso","光圈":"exposure.aperture",
            "快门":"exposure.shutter","焦距":"exposure.focal_mm",
            "曝光补偿":"exposure.compensation","分辨率":"files.width_px",
            "闪光灯":"exposure.flash","白平衡":"camera.white_balance","对焦模式":"camera.focus_mode"
          };
          if(fields[name])onApplyRules([{field:fields[name],op:"is_missing"}]);
        }}/>
      </>}
    </div>:null}
    <p className="text-xs leading-5 text-textSecondary">
      图表统计使用最后一次成功发布的 SQLite 索引，不访问原片。不分析 GPS 或图像像素。
      日期使用相机记录的本地时间，不推算拍摄时区。镜头信息缺失不会被猜测填补。
    </p>
  </section></ChartMotion.Provider>;
}

function GearMatrix({cameras,lenses,data,onChoose}:{
  cameras:AnalyticsCount[];lenses:AnalyticsCount[];
  data:PhotoAnalytics["gear"]["lens_by_camera"];
  onChoose:(camera:string,lens:string)=>void;
}) {
  const cols=cameras.slice(0,8).map(x=>x.name);
  const rows=lenses.slice(0,8).map(x=>x.name);
  const cells:AnalyticsHeatCell[]=[];
  for(const entry of data){
    const x=cols.indexOf(entry.camera), y=rows.indexOf(entry.lens);
    if(x>=0&&y>=0)cells.push({x,y,count:entry.count});
  }
  return <Heat title="机身 × 镜头使用矩阵" desc="前八款机身和镜头组成的真实拍摄次数矩阵"
    xs={cols} ys={rows} data={cells} onChoose={(x,y)=>onChoose(cols[x],rows[y])}/>;
}
