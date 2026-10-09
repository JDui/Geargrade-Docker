import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPhotoAnalytics, type PhotoAnalytics, type PhotoFilter } from "../../api/photoData";
import { PhotoAnalyticsDashboard } from "./PhotoAnalyticsDashboard";
import { useAppSettings } from "../layout/AppSettingsProvider";

vi.mock("../layout/AppSettingsProvider", () => ({ useAppSettings: vi.fn() }));

vi.mock("../../api/photoData", () => ({
  getPhotoAnalytics: vi.fn()
}));

const filter: PhotoFilter = { version:"photo-filter.v1", group:{op:"and",children:[]} };
const empty = ():PhotoAnalytics => ({
  schema_version:"photo-analytics.v1",
  as_of:"2026-10-09T10:00:00Z",
  overview:{
    captures:5,files:7,bytes:10000000,dated:5,raw_captures:2,raw_files:2,
    paired_captures:2,failed_files:0,camera_known:5,lens_known:5,
    first_shot:"2025-03-17T14:00:00",last_shot:"2025-03-18T08:00:00"
  },
  timeline:{
    yearly:[{key:"2025",count:5}],
    monthly:[{key:"2025-03",count:5}],
    daily:[{date:"2025-03-17",count:4},{date:"2025-03-18",count:1}],
    hours:[{hour:14,count:4}],
    weekdays:[{weekday:0,count:4},{weekday:1,count:1}],
    weekday_hour:[{weekday:0,hour:14,count:4}]
  },
  gear:{
    cameras:[{name:"sony:ilce-7m4",count:5}],
    lenses:[{name:"tamron 28-200",count:5}],
    makers:[{name:"SONY",count:5}],
    combos:[{camera:"sony:ilce-7m4",lens:"tamron 28-200",count:5}],
    camera_years:[{year:"2025",camera:"sony:ilce-7m4",count:5}],
    lens_by_camera:[{camera:"sony:ilce-7m4",lens:"tamron 28-200",count:5}]
  },
  exposure:{
    iso:[{bucket:5,label:"1600–3199",count:5,min:1600,max:3200,field:"exposure.iso"}],
    focal:[],focal_coverage:[],aperture:[],shutter:[],ev:[],
    flash:[],wb:[],focus:[],drive:[],shutter_type:[],picture_style:[],
    iso_shutter:[{x:1,y:2,count:4}],
    focal_aperture:[{x:2,y:1,count:5}]
  },
  files:{
    formats:[{name:"raw",count:2},{name:"jpeg",count:5}],
    capture_formats:[{name:"raw",count:2},{name:"jpeg",count:3}],
    size:[],resolution:[],orientation:[],aspect:[],
    status:[],software:[],color_space:[]
  },
  quality:[{name:"机身",count:5,total:5}],
  notes:{
    captures:"logical",files:"physical",time:"local",gaps:"unknown"
  }
});
describe("PhotoAnalyticsDashboard",()=>{
  afterEach(()=>vi.restoreAllMocks());
  beforeEach(()=>{
    vi.mocked(useAppSettings).mockReturnValue({reduceMotion:false} as ReturnType<typeof useAppSettings>);
    // Recharts ResponsiveContainer relies on a browser observer that jsdom lacks.
    vi.stubGlobal("ResizeObserver", class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(target: Element) { this.callback([{contentRect:{width:600,height:280},target} as ResizeObserverEntry], this as unknown as ResizeObserver); }
      unobserve() {}
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype,"getBoundingClientRect").mockReturnValue({width:600,height:280,top:0,left:0,right:600,bottom:280,x:0,y:0,toJSON:()=>({})});
    vi.mocked(getPhotoAnalytics).mockReset();
    vi.mocked(getPhotoAnalytics).mockResolvedValue(empty());
  });
  it("loads once and switches all five analytics sections",async()=>{
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={vi.fn()}/>);
    expect(screen.getByRole("status")).toHaveTextContent("正在聚合统计图表");
    expect(await screen.findByText("图库指标")).toBeInTheDocument();
    expect(vi.mocked(getPhotoAnalytics)).toHaveBeenCalledWith(filter);
    fireEvent.click(screen.getByRole("tab",{name:"器材与组合"}));
    expect(screen.getByText("机身 × 镜头使用矩阵")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"曝光与焦距"}));
    expect(screen.getByText("ISO × 快门热力图")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"拍摄时间"}));
    expect(screen.getByText("全年拍摄日历热力图")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab",{name:"文件与质量"}));
    expect(screen.getByText("EXIF 元数据完整度")).toBeInTheDocument();
  });
  it("clicking heatmap cell emits two bounded numeric filters",async()=>{
    const onApplyRules=vi.fn();
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={onApplyRules}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"曝光与焦距"}));
    const cell=screen.getByRole("button",{name:/1\/100–1\/10s × 200–799/});
    fireEvent.click(cell);
    expect(onApplyRules).toHaveBeenCalledWith([
      {field:"exposure.iso",op:"gte",value:200},
      {field:"exposure.iso",op:"lt",value:800},
      {field:"exposure.shutter",op:"gte",value:0.01},
      {field:"exposure.shutter",op:"lt",value:0.1}
    ]);
  });
  it("calendar dates can be used as a single exact date filter",async()=>{
    const onApplyRules=vi.fn();
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={onApplyRules}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"拍摄时间"}));
    fireEvent.click(screen.getByRole("button",{name:"2025-03-17拍摄4次"}));
    expect(onApplyRules).toHaveBeenCalledWith([
      {field:"capture.date",op:"eq",value:"2025-03-17"}
    ]);
  });
  it("keeps chart nodes during refresh and ignores stale chart interactions",async()=>{
    const onApplyRules=vi.fn();
    const {rerender}=render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={onApplyRules}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"曝光与焦距"}));
    const panel=screen.getByRole("tabpanel");
    let resolve!:(value:PhotoAnalytics)=>void;
    vi.mocked(getPhotoAnalytics).mockReturnValueOnce(new Promise(r=>{resolve=r;}));
    rerender(<PhotoAnalyticsDashboard filter={filter} refresh={1} onApplyRules={onApplyRules}/>);
    expect(screen.getByRole("tabpanel")).toBe(panel);
    expect(screen.getByRole("status")).toHaveTextContent("正在更新图表");
    fireEvent.click(screen.getByRole("button",{name:/1\/100–1\/10s × 200–799/}));
    expect(onApplyRules).not.toHaveBeenCalled();
    await act(async()=>resolve(empty()));
    expect(screen.getByRole("tabpanel")).toBe(panel);
    expect(panel).not.toHaveClass("photo-chart-refreshing");
  });
  it("supports keyboard navigation and labels each tab panel",async()=>{
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={vi.fn()}/>);
    await screen.findByText("图库指标");
    const overview=screen.getByRole("tab",{name:"总览"});
    overview.focus();fireEvent.keyDown(overview,{key:"ArrowRight"});
    expect(screen.getByRole("tab",{name:"器材与组合"})).toHaveFocus();
    expect(screen.getByRole("tabpanel",{name:"器材与组合"})).toBeInTheDocument();
    fireEvent.keyDown(document.activeElement!,{key:"End"});
    expect(screen.getByRole("tabpanel",{name:"文件与质量"})).toBeInTheDocument();
  });
  it("renders reduced-motion charts without delaying interaction",async()=>{
    vi.mocked(useAppSettings).mockReturnValue({reduceMotion:true} as ReturnType<typeof useAppSettings>);
    const onApplyRules=vi.fn();
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={onApplyRules}/>);
    await screen.findByText("图库指标");
    // Real SVG bars are rendered by the sized observer, rather than bypassing Recharts.
    const bar=document.querySelector(".recharts-bar-rectangle path");
    expect(bar).not.toBeNull();
    fireEvent.click(bar!);
    expect(onApplyRules).toHaveBeenCalledWith([{field:"capture.year",op:"eq",value:"2025"}]);
  });

  it("shows inclusive year range controls and progressively narrows the calendars",async()=>{
    const input=empty();
    input.timeline.yearly=[{key:"2023",count:2},{key:"2024",count:1},{key:"2025",count:5}];
    input.timeline.daily=[
      {date:"2023-01-05",count:2},{date:"2024-02-29",count:1},
      {date:"2025-03-17",count:4},{date:"2025-03-18",count:1}
    ];
    vi.mocked(getPhotoAnalytics).mockResolvedValue(input);
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={vi.fn()}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"拍摄时间"}));
    expect(screen.getByRole("slider",{name:"起始年份"})).toHaveValue("2023");
    expect(screen.getByRole("slider",{name:"结束年份"})).toHaveValue("2025");
    expect(screen.getByRole("button",{name:"2023-01-05拍摄2次"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"2024-02-29拍摄1次"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"2025-03-17拍摄4次"})).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider",{name:"起始年份"}),{target:{value:"2024"}});
    expect(screen.queryByRole("button",{name:"2023-01-05拍摄2次"})).not.toBeInTheDocument();
    expect(screen.getByRole("button",{name:"2024-02-29拍摄1次"})).toBeInTheDocument();
    expect(screen.getByRole("button",{name:"2025-03-17拍摄4次"})).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider",{name:"结束年份"}),{target:{value:"2024"}});
    expect(screen.getByText("2024 年",{selector:"h4"})).toBeInTheDocument();
    expect(screen.queryByRole("button",{name:"2025-03-17拍摄4次"})).not.toBeInTheDocument();
  });

  it("displays a rich hover preview for filmed and empty days and hides on leave",async()=>{
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={vi.fn()}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"拍摄时间"}));
    const active=screen.getByRole("button",{name:"2025-03-17拍摄4次"});
    fireEvent.mouseEnter(active);
    const tooltip=screen.getByRole("tooltip");
    expect(tooltip).toHaveTextContent("2025-03-17");
    expect(tooltip).toHaveTextContent("周一");
    expect(tooltip).toHaveTextContent("4");
    expect(tooltip).toHaveTextContent("80.0%");
    fireEvent.mouseLeave(active);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    const emptyDay=screen.getByRole("button",{name:"2025-03-19拍摄0次"});
    fireEvent.focus(emptyDay);
    expect(screen.getByRole("tooltip")).toHaveTextContent("当日没有索引拍摄记录");
    fireEvent.blur(emptyDay);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("disables year range sliders on a single-year archive",async()=>{
    render(<PhotoAnalyticsDashboard filter={filter} refresh={0} onApplyRules={vi.fn()}/>);
    await screen.findByText("图库指标");
    fireEvent.click(screen.getByRole("tab",{name:"拍摄时间"}));
    expect(screen.getByRole("slider",{name:"起始年份"})).toBeDisabled();
    expect(screen.getByRole("slider",{name:"结束年份"})).toBeDisabled();
  });

});
