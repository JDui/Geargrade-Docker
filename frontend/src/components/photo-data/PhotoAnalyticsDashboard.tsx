import { createContext, useContext, useEffect, useMemo, useState, type ReactNode, type SyntheticEvent } from "react";
import { createPortal } from "react-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import {
  getPhotoAnalytics, type AnalyticsBucket, type AnalyticsCount, type AnalyticsValue,
  type AnalyticsHeatCell, type AnalyticsPoint, type PhotoAnalytics,
  type PhotoFilter, type PhotoRule
} from "../../api/photoData";

import { useAppSettings } from "../layout/AppSettingsProvider";
import { photoGearColor, photoGearLabel } from "../../utils/photoData";

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
  const monthly=field==="capture.month";
  const [range,setRange]=useState("24");
  const sorted=[...items].sort((a,b)=>a.key.localeCompare(b.key));
  const shown=monthly&&range!=="all"?sorted.slice(-Number(range)):sorted;
  return <Panel title={title} desc={desc}>
    {monthly?<div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-xs text-textSecondary">显示范围
        <select className="input py-1.5 text-xs" aria-label={title+"显示范围"} value={range} onChange={event=>setRange(event.target.value)}>
          <option value="12">最近 12 个月</option><option value="24">最近 24 个月</option><option value="all">全部历史</option>
        </select>
      </label>
      <span className="text-xs text-textSecondary">{shown[0]?.key} — {shown[shown.length-1]?.key}</span>
    </div>:null}
    {shown.length?<div className="w-full h-60"><ResponsiveContainer width="100%" height="100%">
      <BarChart data={shown} margin={{top:20,right:12,bottom:5,left:-12}}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.14}/>
        <XAxis dataKey="key" tick={{fontSize:11}} minTickGap={20}/>
        <YAxis allowDecimals={false} tick={{fontSize:11}} tickFormatter={value=>count(Number(value))}/>
        <Tooltip formatter={value=>[count(Number(value)),"拍摄次数"]}/>
        <Bar {...motion} dataKey="count" fill={colors[0]} radius={[4,4,0,0]} maxBarSize={38} cursor="pointer"
          onClick={e=>{const item=(e as {payload?:AnalyticsPoint}).payload;if(item)choose(field,item.key);}}>
          {shown.length<=24?<LabelList dataKey="count" position="top" fontSize={10} formatter={(value:number)=>count(value)}/>:null}
        </Bar>
      </BarChart>
    </ResponsiveContainer></div>:<NoData/>}
    {shown.length?<details className="mt-3">
      <summary className="text-xs text-accent cursor-pointer">查看数值 / 按时间筛选</summary>
      <div className="mt-2 flex flex-wrap gap-2 max-h-48 overflow-y-auto">
        {shown.map(item=><button type="button" key={item.key} className="button-secondary text-xs"
          onClick={()=>choose(field,item.key)}>{item.key} · {count(item.count)} 次</button>)}
      </div>
    </details>:null}
  </Panel>;
}
function Ranking({title,desc,items,onChoose,max=12,order="count",total,colorForName,wide=false}:{
  title:string;desc:string;items:AnalyticsCount[];onChoose?:(name:string)=>void;max?:number;
  order?:"count"|"input";total?:number;
  colorForName?:(name:string)=>string;
  wide?:boolean;
}) {
  const ordered=order==="count"?[...items].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)):items;
  const shown=ordered.filter(item=>item.name!=="未记录").slice(0,max);
  const unknown=items.find(item=>item.name==="未记录");
  const peak=Math.max(1,...shown.map(item=>item.count));
  const label=(name:string)=>name.split(" + ").map(photoGearLabel).join(" + ");
  const row=(item:AnalyticsCount,index:number)=> <>
    <div className="flex items-start justify-between gap-3">
      <span className="min-w-0 text-sm text-textPrimary break-words">
        {order==="count"&&item.name!=="未记录"?<span className="mr-2 text-xs text-textSecondary tabular-nums">{index+1}.</span>:null}
        {label(item.name)}
      </span>
      <span className="shrink-0 text-right tabular-nums">
        <span className="text-sm font-semibold text-textPrimary">{count(item.count)} <span className="font-normal text-xs text-textSecondary">次</span></span>
        {total!==undefined?<span className="ml-2 text-xs text-textSecondary">{ratio(item.count,total)}</span>:null}
      </span>
    </div>
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/50" aria-hidden="true">
      <div className="h-full rounded-full bg-accent origin-left"
        style={{width:ratio(Math.min(item.count,peak),peak),backgroundColor:colorForName?.(item.name)}}/>
    </div>
  </>;
  return <Panel title={title} desc={desc} wide={wide}>
    {shown.length||unknown?<div>
      <ol className="space-y-1">
        {shown.map((item,index)=><li key={item.name}>
          {onChoose?<button type="button" className="w-full rounded-xl p-2.5 text-left hover:bg-panelAlt/70 transition"
            aria-label={"筛选 "+label(item.name)+"："+count(item.count)+" 次"} onClick={()=>onChoose(item.name)}>
            {row(item,index)}
          </button>:<div className="p-2.5">{row(item,index)}</div>}
        </li>)}
      </ol>
      {unknown?<div className="mt-3 border-t border-line pt-3">
        {onChoose?<button type="button" className="w-full rounded-xl p-2.5 text-left hover:bg-panelAlt/70"
          aria-label={"筛选未记录："+count(unknown.count)+" 次"} onClick={()=>onChoose(unknown.name)}>{row(unknown,0)}</button>
          :<div className="p-2.5">{row(unknown,0)}</div>}
      </div>:null}
    </div>:<NoData/>}
    {onChoose&&<p className="mt-3 text-[11px] text-textSecondary">点击条目可筛选{total!==undefined?" · 占比按当前全部拍摄计算":""}</p>}
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
function NumericDistribution({title,desc,items,total,line=false,logarithmic=false,unit="",choose}:{
  title:string;desc:string;items:AnalyticsValue[];total:number;line?:boolean;logarithmic?:boolean;
  unit?:string;choose:(rules:PhotoRule[])=>void;
}) {
  const motion=useChartMotion();
  const [valuesOpen,setValuesOpen]=useState(false);
  const points=useMemo(()=>[...items].sort((a,b)=>a.value-b.value),[items]);
  const known=points.reduce((sum,point)=>sum+point.count,0);
  const singleValue=points[0]?.value??1;
  const domain:[number|"dataMin",number|"dataMax"]=points.length===1
    ? logarithmic?[singleValue/2,singleValue*2]:[Math.max(0,singleValue-1),singleValue+1]
    : ["dataMin","dataMax"];
  const label=(point:AnalyticsValue)=>point.label+(unit?" "+unit:"");
  function select(point:AnalyticsValue){
    choose(point.min===point.max?[{field:point.field,op:"eq",value:point.min}]:[
      {field:point.field,op:"gte",value:point.min},{field:point.field,op:"lte",value:point.max}
    ]);
  }
  const tooltip=<Tooltip formatter={value=>[count(Number(value)),"拍摄次数"]}
    labelFormatter={(_value,payload)=>payload[0]?.payload?label(payload[0].payload as AnalyticsValue):String(_value)}/>;
  return <Panel title={title} desc={desc}>
    <p className="mb-3 text-xs text-textSecondary tabular-nums">有效记录 {count(known)} 次 · 缺失或无效 {count(Math.max(0,total-known))} 次</p>
    {points.length?<>
      <div className="h-64" role="img" aria-label={title+"，"+points.length+" 个参数值，"+count(known)+" 次有效拍摄"}>
        <ResponsiveContainer width="100%" height="100%">
          {line?<LineChart data={points} margin={{top:18,right:18,bottom:20,left:0}}
            onClick={state=>{const point=state?.activePayload?.[0]?.payload as AnalyticsValue|undefined;if(point)select(point);}}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.14}/>
            <XAxis dataKey="value" type="number" scale={logarithmic?"log":"linear"}
              domain={domain}
              ticks={points.map(point=>point.value)} interval="preserveStartEnd" minTickGap={18} tick={{fontSize:11}}
              tickFormatter={value=>Number(value).toLocaleString("zh-CN",{maximumFractionDigits:3})}
              label={{value:unit?"数值（"+unit+"）":"ISO",position:"insideBottom",offset:-12,fontSize:11}}/>
            <YAxis allowDecimals={false} tick={{fontSize:11}} tickFormatter={value=>count(Number(value))} width={60}/>
            {tooltip}
            <Line {...motion} isAnimationActive={motion.isAnimationActive&&points.length<=500} type="monotone" dataKey="count"
              stroke={colors[0]} strokeWidth={2} dot={points.length<=80?{r:3}:false} activeDot={{r:5}}/>
          </LineChart>:<BarChart data={points} margin={{top:22,right:12,bottom:12,left:0}}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.14}/>
            <XAxis dataKey="label" tick={{fontSize:11}} minTickGap={18}/>
            <YAxis allowDecimals={false} tick={{fontSize:11}} tickFormatter={value=>count(Number(value))} width={60}/>
            {tooltip}
            <Bar {...motion} dataKey="count" fill={colors[2]} maxBarSize={38} radius={[3,3,0,0]} cursor="pointer"
              onClick={event=>{const point=(event as {payload?:AnalyticsValue}).payload;if(point)select(point);}}>
              {points.length<=16?<LabelList dataKey="count" position="top" fontSize={10} formatter={(value:number)=>count(value)}/>:null}
            </Bar>
          </BarChart>}
        </ResponsiveContainer>
      </div>
      <button type="button" className="mt-3 text-xs text-accent hover:underline" aria-expanded={valuesOpen}
        onClick={()=>setValuesOpen(open=>!open)}>{valuesOpen?"收起读数":"查看全部 "+points.length+" 个参数值 / 筛选"}</button>
      {valuesOpen?<div className="mt-3 flex flex-wrap gap-2 max-h-52 overflow-y-auto">
        {points.map(point=><button type="button" key={point.value} className="button-secondary text-xs tabular-nums"
          aria-label={"筛选 "+label(point)+"："+count(point.count)+" 次"} onClick={()=>select(point)}>
          {label(point)} · {count(point.count)} 次 · {ratio(point.count,known)}
        </button>)}
      </div>:null}
    </>:<NoData/>}
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
function Heat({title,desc,xs,ys,data,onChoose,wideLabels=false}:{
  title:string;desc:string;xs:string[];ys:string[];data:AnalyticsHeatCell[];
  onChoose?:(x:number,y:number)=>void;wideLabels?:boolean;
}) {
  const values=new Map(data.map(v=>[v.x+","+v.y,v.count]));
  const peak=Math.max(1,...data.map(v=>v.count));
  return <Panel title={title} desc={desc} wide={xs.length>12||wideLabels}>
    {xs.length&&ys.length?<div className="overflow-x-auto pb-2">
      <div className="w-max">
        <div className="flex gap-1 ml-[112px] mb-2">
          {xs.map((x,i)=><span key={i} className={"text-center text-[10px] text-textSecondary "+(wideLabels?"w-28":"w-9")} title={x}>{short(x,wideLabels?14:5)}</span>)}
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
              className={"h-8 rounded text-[10px] text-textPrimary enabled:hover:ring-1 enabled:hover:ring-accent "+(wideLabels?"w-28":"w-9")}
              style={{backgroundColor:"rgb(var(--color-accent) / "+opacity+")",color:opacity>=.55?"var(--photo-chart-strong-ink)":"rgb(var(--color-text-primary))"}} onClick={()=>onChoose?.(i,y)}>
              {n?count(n):"·"}
            </button>;
          })}
        </div>)}
      </div>
    </div>:<NoData/>}
    {onChoose&&<p className="text-[11px] text-textSecondary mt-1">{hint}（二维联合条件）</p>}
  </Panel>;
}
type DatePreview = {
  date: string; weekday: string; count: number; yearCount: number; activeDays: number;
  x: number; y: number;
};

function Calendar({daily,choose}:{
  daily:PhotoAnalytics["timeline"]["daily"];choose:(field:string,name:string)=>void;
}) {
  const years=useMemo(()=>[...new Set(
    daily.map(d=>Number(d.date.slice(0,4))).filter(y=>Number.isInteger(y)&&y>=1000&&y<=9999)
  )].sort((a,b)=>a-b),[daily]);
  const earliest=years[0], latest=years[years.length-1];
  const [requested,setRequested]=useState<[number,number]|null>(null);
  const [preview,setPreview]=useState<DatePreview|null>(null);
  const from=requested?Math.max(earliest,Math.min(latest,requested[0])):earliest;
  const to=requested?Math.max(from,Math.min(latest,requested[1])):latest;
  const visibleYears=useMemo(()=>years.filter(y=>y>=from&&y<=to),[years,from,to]);
  const observations=useMemo(()=>new Map(daily.map(d=>[d.date,d.count])),[daily]);
  const totals=useMemo(()=>{
    const values=new Map<number,{total:number;activeDays:number;peak:number}>();
    for(const entry of daily) {
      const year=Number(entry.date.slice(0,4));
      const old=values.get(year)??{total:0,activeDays:0,peak:0};
      old.total+=entry.count;
      old.activeDays+=entry.count>0?1:0;
      old.peak=Math.max(old.peak,entry.count);
      values.set(year,old);
    }
    return values;
  },[daily]);
  const showPreview=(event:SyntheticEvent<HTMLButtonElement>,date:string,
    n:number,yearCount:number,activeDays:number)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const day=new Date(date+"T00:00:00Z");
    const weekday=["周日","周一","周二","周三","周四","周五","周六"][day.getUTCDay()];
    setPreview({
      date,weekday,count:n,yearCount,activeDays,
      x:Math.max(12,Math.min(rect.left+rect.width/2-112,window.innerWidth-236)),
      y:rect.top>125?rect.top-112:rect.bottom+12
    });
  };
  return <Panel title="全年拍摄日历热力图" desc="拖动时间范围滑条查看多个年份；方块代表日期，悬停可预览拍摄情况" wide>
    {years.length?<div className="space-y-5">
      <div className="rounded-xl border border-line/70 bg-panelAlt/40 p-3 sm:p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-textPrimary">拍摄时间范围</span>
          <span className="text-sm font-semibold text-accent tabular-nums" aria-live="polite">
            {from===to?from+" 年":from+" — "+to+" 年"}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="flex flex-col gap-2 text-xs text-textSecondary">
            <span>起始年份 <strong className="text-textPrimary tabular-nums">{from}</strong></span>
            <input aria-label="起始年份" type="range" min={earliest} max={latest} step={1}
              disabled={earliest===latest} value={from}
              className="photo-year-range-slider w-full"
              onChange={event=>{
                const next=Number(event.target.value);
                setRequested([Math.min(next,to),to]);setPreview(null);
              }}/>
          </label>
          <label className="flex flex-col gap-2 text-xs text-textSecondary">
            <span>结束年份 <strong className="text-textPrimary tabular-nums">{to}</strong></span>
            <input aria-label="结束年份" type="range" min={earliest} max={latest} step={1}
              disabled={earliest===latest} value={to}
              className="photo-year-range-slider w-full"
              onChange={event=>{
                const next=Number(event.target.value);
                setRequested([from,Math.max(from,next)]);setPreview(null);
              }}/>
          </label>
        </div>
        <div className="flex items-center justify-between gap-3 text-[11px] text-textSecondary">
          <span>{earliest} 年</span>
          <span>当前展示 {visibleYears.length} 个有拍摄记录的年份</span>
          <span>{latest} 年</span>
        </div>
      </div>
      <div className="space-y-5" onScroll={()=>setPreview(null)}>
        {visibleYears.map(year=>{
          const first=Date.UTC(year,0,1);
          const offset=(new Date(first).getUTCDay()+6)%7;
          const days=(Date.UTC(year+1,0,1)-first)/86400000;
          const summary=totals.get(year)??{total:0,activeDays:0,peak:0};
          const peak=Math.max(1,summary.peak);
          const monthStarts=Array.from({length:12},(_,month)=>{
            const dayIndex=(Date.UTC(year,month,1)-first)/86400000;
            return {month,week:Math.floor((offset+dayIndex)/7)};
          });
          return <section key={year} className="rounded-xl border border-line/60 p-3 sm:p-4 space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h4 className="text-lg font-semibold text-textPrimary tabular-nums">{year} 年</h4>
              <span className="text-xs text-textSecondary tabular-nums">
                {count(summary.total)} 次拍摄 · {count(summary.activeDays)} 个活跃日
              </span>
            </div>
            <div className="overflow-x-auto pb-3">
              <div className="flex w-max gap-2">
                <div className="mt-6 grid grid-rows-7 gap-1 text-[10px] text-textSecondary" style={{gridTemplateRows:"repeat(7,14px)"}}>
                  {["一","二","三","四","五","六","日"].map((w,i)=>
                    <span className="flex h-3.5 items-center justify-center" key={i}>{w}</span>)}
                </div>
                <div className="w-max">
                  <div className="relative mb-1 h-5" style={{width:Math.ceil((offset+days)/7)*18}}>
                    {monthStarts.map(({month,week})=>
                      <span key={month} className="absolute top-0 text-[10px] text-textSecondary"
                        style={{left:week*18}}>{month+1}月</span>)}
                  </div>
                  <div className="grid grid-flow-col w-max gap-1" style={{gridTemplateRows:"repeat(7,14px)"}}>
                    {Array.from({length:offset},(_,i)=>
                      <div className="h-3.5 w-3.5" key={"gap-"+i} aria-hidden="true"/>)}
                    {Array.from({length:days},(_,i)=>{
                      const date=new Date(first+i*86400000).toISOString().slice(0,10);
                      const value=observations.get(date)||0;
                      const shade=value?.15+Math.sqrt(value/peak)*.82:.055;
                      return <button key={date} type="button"
                        className="photo-calendar-day w-3.5 h-3.5 rounded-[3px] focus-visible:ring-2 focus-visible:ring-accent hover:ring-1 hover:ring-accent"
                        aria-label={date+"拍摄"+value+"次"}
                        onMouseEnter={event=>showPreview(event,date,value,summary.total,summary.activeDays)}
                        onMouseLeave={()=>setPreview(null)}
                        onFocus={event=>showPreview(event,date,value,summary.total,summary.activeDays)}
                        onBlur={()=>setPreview(null)}
                        onClick={()=>{setPreview(null);choose("capture.date",date);}}
                        style={{backgroundColor:"rgb(var(--color-accent) / "+shade+")"}}/>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>;
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-textSecondary">
        <span>浅色表示无拍摄记录，深色表示当年相对较高的拍摄量；颜色强度按各年独立归一化。</span>
        <span>{hint} · 支持鼠标悬停及键盘聚焦预览</span>
      </div>
      {preview?createPortal(
        <div role="tooltip" data-testid="photo-calendar-preview"
          className="fixed z-[120] pointer-events-none rounded-xl border border-line bg-panel p-3 text-textPrimary shadow-2xl"
          style={{left:preview.x,top:preview.y,width:224}}>
          <div className="text-sm font-semibold tabular-nums">{preview.date} <span className="ml-1 text-xs font-normal text-textSecondary">{preview.weekday}</span></div>
          <div className="mt-2 text-lg font-bold text-accent tabular-nums">{count(preview.count)} <span className="text-xs font-normal text-textSecondary">次拍摄</span></div>
          <div className="mt-1 text-xs text-textSecondary">
            {preview.count?"占当年拍摄量 "+ratio(preview.count,preview.yearCount):"当日没有索引拍摄记录"}
          </div>
          <div className="mt-1 text-[11px] text-textSecondary">该年共 {count(preview.yearCount)} 次拍摄 / {count(preview.activeDays)} 个活跃日</div>
        </div>,document.body
      ):null}
    </div>:<NoData/>}
  </Panel>;
}
function GearByYear({data,kind,unavailable=false,onChoose}:{
  data:{year:string;name:string;count:number}[];kind:"机身"|"镜头";unavailable?:boolean;
  onChoose:(name:string)=>void;
}) {
  const motion = useChartMotion();
  const byYear=new Map<string,Map<string,number>>();
  for(const point of data){
    if(!/^\d{4}$/.test(point.year)||Number(point.year)<1000||!point.name.trim()
      ||point.name==="未记录"||point.count<=0)continue;
    const entries=byYear.get(point.year)??new Map<string,number>();
    entries.set(point.name,(entries.get(point.name)??0)+point.count);
    byYear.set(point.year,entries);
  }
  const annual=new Map([...byYear].map(([year,entries])=>[year,[...entries]
    .map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||(a.name<b.name?-1:a.name>b.name?1:0)).slice(0,10)]));
  const totals=new Map<string,number>();
  for(const entries of annual.values())for(const entry of entries)
    totals.set(entry.name,(totals.get(entry.name)??0)+entry.count);
  const names=[...totals.keys()].sort((a,b)=>totals.get(b)!-totals.get(a)!||(a<b?-1:a>b?1:0));
  const recordedYears=[...annual.keys()].map(Number).sort((a,b)=>a-b);
  const years=recordedYears.length?Array.from(
    {length:recordedYears[recordedYears.length-1]-recordedYears[0]+1},(_,i)=>String(recordedYears[0]+i)
  ):[];
  const series=years.map(year=>{
    const row:Record<string,string|number>={year};
    const entries=new Map(annual.get(year)?.map(entry=>[entry.name,entry.count]));
    names.forEach((name,i)=>row["series"+i]=entries.get(name)||0);
    return row;
  });
  const color=photoGearColor;
  return <Panel title={"年度"+kind+"更替"} desc={unavailable?"当前服务尚未提供镜头年度数据，升级服务后可查看":
    "每年独立取使用次数前十；仅计入当年入榜器材，面积按拍摄次数堆积，颜色保持一致"} wide>
    {series.length&&names.length?<>
      <div className="h-72" role="img" aria-label={"年度"+kind+"使用堆积面积图"}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{top:12,right:12,bottom:0,left:0}}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.15}/>
            <XAxis dataKey="year" tick={{fontSize:11}}/>
            <YAxis allowDecimals={false} tick={{fontSize:11}} tickFormatter={value=>count(Number(value))} width={60}/>
            <Tooltip content={({active,label,payload})=>active&&payload?.length?<div className="rounded-xl border border-line bg-panel p-3 shadow-xl text-xs text-textPrimary">
              <p className="font-semibold">{label} 年 · 前十合计 {count(payload.reduce((sum,item)=>sum+Number(item.value||0),0))} 次</p>
              <div className="mt-2 space-y-1">{payload.filter(item=>Number(item.value)>0)
                .sort((a,b)=>Number(b.value)-Number(a.value)).map(item=><div key={String(item.dataKey)} className="flex justify-between gap-4">
                  <span style={{color:item.color}}>{item.name}</span><span>{count(Number(item.value))} 次</span>
                </div>)}</div>
            </div>:null}/>
            {names.map((name,i)=><Area {...motion} key={name} dataKey={"series"+i} type="monotone"
              name={photoGearLabel(name)} stackId="gear" stroke={color(name)} strokeWidth={2}
              fill={color(name)} fillOpacity={0.65} dot={series.length===1?{r:3}:false} activeDot={{r:4}}/>)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-4 max-h-36 overflow-y-auto">{names.map(name=><button key={name}
        className="inline-flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-xs text-textPrimary hover:border-accent"
        type="button" onClick={()=>onChoose(name)}>
        <span className="h-2.5 w-2.5 rounded-full" style={{backgroundColor:color(name)}} aria-hidden="true"/>
        {photoGearLabel(name)}
      </button>)}</div>
      <details className="mt-4">
        <summary className="text-xs text-accent cursor-pointer">查看每年{kind}前十 / 筛选</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 max-h-80 overflow-y-auto">
          {[...annual].sort(([a],[b])=>a.localeCompare(b)).map(([year,entries])=><div key={year}>
            <h4 className="mb-2 text-sm font-semibold text-textPrimary">{year} 年</h4>
            <ol className="space-y-1">{entries.map((entry,i)=><li key={entry.name}>
              <button type="button" className="w-full flex justify-between gap-3 text-left text-xs text-textSecondary hover:text-accent"
                aria-label={year+" 年第 "+(i+1)+" 名 "+photoGearLabel(entry.name)+"："+count(entry.count)+" 次"}
                onClick={()=>onChoose(entry.name)}>
                <span>{i+1}. {photoGearLabel(entry.name)}</span><span className="shrink-0">{count(entry.count)} 次</span>
              </button>
            </li>)}</ol>
          </div>)}
        </div>
      </details>
    </>:<NoData/>}
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
        <Trend title="月度拍摄趋势" desc="按时间排列，可切换最近 12 / 24 个月或全部历史" items={d.timeline.monthly} field="capture.month" choose={choose}/>
        <Ranking title="常用机身 Top 8" desc="逻辑拍摄数，未识别信息单独列出"
          items={d.gear.cameras} total={d.overview.captures} colorForName={photoGearColor} max={8} onChoose={name=>choose("camera.model_norm",name)}/>
        <Donut title="物理文件格式" desc="RAW 与 JPEG 双份分别计入文件数量"
          items={d.files.formats} onChoose={name=>choose("files.format_family",name)}/>
      </>}
      {tab==="timeline"&&<>
        <Calendar daily={d.timeline.daily} choose={choose}/>
        <Trend title="每年拍摄量" desc="按拍摄日期分组" items={d.timeline.yearly} field="capture.year" choose={choose}/>
        <Trend title="每月拍摄量" desc="按相机记录的当地日期分组" items={d.timeline.monthly} field="capture.month" choose={choose}/>
        <Ranking order="input" title="每天拍摄时段" desc="各小时逻辑拍摄次数" max={24}
          items={d.timeline.hours.map(x=>({name:String(x.hour).padStart(2,"0")+"时",count:x.count}))}
          onChoose={name=>choose("capture.hour",name.slice(0,2))}/>
        <Ranking order="input" title="星期使用分布" desc="周一至周日"
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
        <Ranking title="机身使用次数 Top 16" desc="每次 RAW+JPEG 只算一次" items={d.gear.cameras}
          max={16} total={d.overview.captures} colorForName={photoGearColor} onChoose={name=>choose("camera.model_norm",name)}/>
        <Ranking title="镜头使用次数 Top 16" desc="部分厂商镜头信息依赖 MakerNotes" items={d.gear.lenses}
          max={16} total={d.overview.captures} colorForName={photoGearColor} onChoose={name=>choose("lens.model_norm",name)}/>
        <Ranking wide title="最常用机身 + 镜头组合" desc="点击组合同时筛选机身和镜头"
          total={d.overview.captures} items={d.gear.combos.map(x=>({name:x.camera+" + "+x.lens,count:x.count}))}
          onChoose={name=>{
            const found=d.gear.combos.find(x=>x.camera+" + "+x.lens===name);
            if(found)onApplyRules([...fieldRules("camera.model_norm",found.camera),
              ...fieldRules("lens.model_norm",found.lens)]);
          }}/>
        <GearByYear kind="机身" data={d.gear.camera_years.map(point=>({...point,name:point.camera}))}
          onChoose={name=>choose("camera.model_norm",name)}/>
        <GearByYear kind="镜头" data={(d.gear.lens_years??[]).map(point=>({...point,name:point.lens}))}
          unavailable={d.gear.lens_years===undefined} onChoose={name=>choose("lens.model_norm",name)}/>
        <Donut title="相机品牌占比" desc="依据 EXIF 品牌，未记录会单独标出"
          items={d.gear.makers} onChoose={name=>choose("camera.make",name)}/>
        <GearMatrix cameras={d.gear.cameras} lenses={d.gear.lenses} data={d.gear.lens_by_camera}
          onChoose={(cam,lens)=>onApplyRules([...fieldRules("camera.model_norm",cam),...fieldRules("lens.model_norm",lens)])}/>
      </>}
      {tab==="exposure"&&<>
        {d.exposure.distributions?<>
          <NumericDistribution line logarithmic title="ISO 感光度分布" desc="每个实际 ISO 值一个点，不合并区间；横轴按倍数间距排列"
            items={d.exposure.distributions.iso} total={d.overview.captures} choose={onApplyRules}/>
          <NumericDistribution line title="35mm 等效焦距分布" desc="每个等效焦距值一个点，不合并焦段；未知画幅不参与统计" unit="mm"
            items={d.exposure.distributions.focal} total={d.overview.captures} choose={onApplyRules}/>
          <NumericDistribution title="光圈分布" desc="按实际光圈档位排列；距标准档位 3% 内的表示偏差合并，其他值保留"
            items={d.exposure.distributions.aperture} total={d.overview.captures} choose={onApplyRules}/>
          <NumericDistribution title="快门速度分布" desc="按曝光时间排列；距标准快门档位 1.5% 内的表示偏差合并，其他值保留"
            items={d.exposure.distributions.shutter} total={d.overview.captures} choose={onApplyRules}/>
          <NumericDistribution title="曝光补偿分布" desc="距 1/3 或 1/2 EV 档位 0.02 EV 内的偏差合并；其他值保留，缺失不计入 0"
            items={d.exposure.distributions.ev} total={d.overview.captures} choose={onApplyRules}/>
        </>:<>
          <Buckets title="ISO 感光度分布" desc="当前服务返回旧版区间统计；升级服务后可查看逐值折线图" items={d.exposure.iso} onChoose={bin}/>
          <Buckets title="35mm 等效焦距分布" desc="当前服务返回旧版区间统计；升级服务后可查看逐值折线图" items={d.exposure.focal} onChoose={bin}/>
          <Buckets title="光圈分布" desc="当前服务返回旧版区间统计" items={d.exposure.aperture} onChoose={bin}/>
          <Buckets title="快门速度分布" desc="当前服务返回旧版区间统计" items={d.exposure.shutter} onChoose={bin}/>
          <Buckets title="曝光补偿分布" desc="当前服务返回旧版区间统计" items={d.exposure.ev} onChoose={bin}/>
        </>}
        <Donut title="等效焦距识别来源" desc="EXIF 原生等效焦距、机身画幅推算或未知；未知不会按 1× 处理"
          items={(d.exposure.focal_coverage??[]).map(v=>({...v,name:
            v.name==="EXIF"?"EXIF 等效焦距":v.name==="camera_profile"?"机身画幅换算":"画幅未知 / 无等效数据"}))}/>
        <Donut title="闪光灯使用记录" desc="依赖可读的闪光元数据"
          items={d.exposure.flash} onChoose={name=>choose("exposure.flash",name)}/>
        <Heat title="ISO × 快门热力图" desc="交叉分析光线强度、快门速度和感光度"
          xs={["<200","200–799","800–3199","3200–12799","≥12800"]}
          ys={["<1/1000s","1/1000–1/100s","1/100–1/10s","1/10–1s","≥1s"]}
          data={d.exposure.iso_shutter} onChoose={(x,y)=>onApplyRules([
            ...rangeRules("exposure.iso",isoRanges[x][0],isoRanges[x][1]),
            ...rangeRules("exposure.shutter",shutterRanges[y][0],shutterRanges[y][1])
          ])}/>
        <Heat title="35mm 等效焦距 × 光圈热力图" desc="等效焦距区间配合实际拍摄光圈；不能确认画幅的数据不参与"
          xs={["<24mm","24–49","50–99","100–199","≥200"]}
          ys={["<F2","F2–3.9","F4–7.9","F8–15.9","≥F16"]}
          data={d.exposure.focal_aperture} onChoose={(x,y)=>onApplyRules([
            ...rangeRules("exposure.focal_eq_mm",focalRanges[x][0],focalRanges[x][1]),
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
  return <Heat wideLabels title="机身 × 镜头使用矩阵" desc="前八款机身和镜头组成的真实拍摄次数矩阵"
    xs={cols.map(photoGearLabel)} ys={rows.map(photoGearLabel)} data={cells} onChoose={(x,y)=>onChoose(cols[x],rows[y])}/>;
}
