import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { emptyPhotoFilter, getPhotoUsage, type UsageLeaderboard } from "../../api/photoData";

export default function PhotoUsageLeaderboard() {
  const [params,setParams]=useSearchParams();
  const kind: "camera"|"lens"=params.get("kind")==="lens"?"lens":"camera";
  const sort_order:"asc"|"desc"=params.get("sort_order")==="asc"?"asc":"desc";
  const [from,setFrom]=useState("");
  const [to,setTo]=useState("");
  const [data,setData]=useState<UsageLeaderboard|null>(null);
  const [error,setError]=useState("");
  const filter=useMemo(()=>{
    const result=emptyPhotoFilter();
    if("children" in result.group) {
      if(from)result.group.children.push({field:"capture.date",op:"gte",value:from});
      if(to)result.group.children.push({field:"capture.date",op:"lte",value:to});
    }
    return result;
  },[from,to]);

  useEffect(()=>{
    let active=true;setError("");
    void getPhotoUsage(kind,filter,sort_order).then(d=>{if(active)setData(d);})
      .catch(e=>{if(active)setError(String(e));});
    return ()=>{active=false;};
  },[kind,sort_order,filter]);

  function change(next:{kind?:"camera"|"lens";sort_order?:"asc"|"desc"}) {
    const query=new URLSearchParams(params);
    if(next.kind)query.set("kind",next.kind);
    if(next.sort_order)query.set("sort_order",next.sort_order);
    setParams(query);
  }
  function destination(model:string) {
    return "/photo-data?"+(kind==="camera"?"camera":"lens")+"="+encodeURIComponent(model);
  }
  const items=data?.items||[];
  return <div className="space-y-6">
    <section className="leaderboard-hero panel p-6 space-y-4">
      <div className="dashboard-kicker">Photo Usage · Geargrade 1.0.0</div>
      <h1 className="text-3xl font-black text-textPrimary">拍摄使用量榜</h1>
      <p className="text-sm text-textSecondary">
        按实际逻辑拍摄数统计，RAW+JPEG 同拍只计一次；已售出的历史器材同样参与排名。
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/leaderboards?tab=score" className="button-secondary">评分榜</Link>
        <Link to="/leaderboards?tab=holding-duration" className="button-secondary">持有时间榜</Link>
        <Link to="/leaderboards?tab=finance" className="button-secondary">理财榜</Link>
        <span className="button-primary">拍摄使用量榜</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className={kind==="camera"?"button-primary":"button-secondary"} type="button" onClick={()=>change({kind:"camera"})}>机身</button>
        <button className={kind==="lens"?"button-primary":"button-secondary"} type="button" onClick={()=>change({kind:"lens"})}>镜头</button>
        <button className={sort_order==="desc"?"button-primary":"button-secondary"} type="button" onClick={()=>change({sort_order:"desc"})}>降序</button>
        <button className={sort_order==="asc"?"button-primary":"button-secondary"} type="button" onClick={()=>change({sort_order:"asc"})}>升序</button>
        <label className="text-sm text-textSecondary">起始日期
          <input className="input ml-2" type="date" value={from} onChange={e=>setFrom(e.target.value)}/>
        </label>
        <label className="text-sm text-textSecondary">结束日期
          <input className="input ml-2" type="date" value={to} onChange={e=>setTo(e.target.value)}/>
        </label>
      </div>
      <p className="text-xs text-textSecondary">
        上次成功扫描：{data?.as_of?new Date(data.as_of).toLocaleString("zh-CN"):"尚未完成"} ·
        已识别 {data?.attributable_captures||0} 次 · 未识别 {data?.unknown_captures||0} 次
      </p>
    </section>
    {error?<div className="panel p-4 text-danger" role="alert">{error}</div>:null}
    <section className="panel p-6">
      <h2 className="text-2xl font-semibold text-textPrimary">Top 3</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {items.slice(0,3).map((item,i)=><Link key={item.canonical_key} to={destination(item.canonical_key)}
          className={"podium-card "+["podium-rank-1","podium-rank-2","podium-rank-3"][i]}>
          <span className="podium-badge">TOP #{item.rank}</span>
          <div className="mt-12 text-2xl font-semibold text-textPrimary break-words">{item.name}</div>
          <div className="podium-headline mt-8">{item.capture_count.toLocaleString()} 次</div>
          <p className="mt-2 text-sm text-textSecondary">{(item.usage_share*100).toFixed(1)}% · 活跃 {item.active_days} 天</p>
        </Link>)}
        {!items.length?<div className="lg:col-span-3 text-sm text-textSecondary p-6">
          尚无可识别的拍摄数据。请先在设置里添加只读照片目录并主动扫描。
        </div>:null}
      </div>
    </section>
    {items.length>3?<section className="panel p-6 space-y-3">
      <h2 className="text-2xl font-semibold text-textPrimary">完整排名</h2>
      {items.slice(3).map(item=><Link key={item.canonical_key} to={destination(item.canonical_key)}
        className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line p-4 hover:bg-panelAlt">
        <div className="text-textPrimary">#{item.rank} · {item.name}</div>
        <div className="text-textSecondary text-sm">{item.capture_count.toLocaleString()} 次 · {(item.usage_share*100).toFixed(1)}%</div>
      </Link>)}
    </section>:null}
  </div>;
}
