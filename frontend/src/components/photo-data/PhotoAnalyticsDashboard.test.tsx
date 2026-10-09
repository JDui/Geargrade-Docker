import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPhotoAnalytics, type PhotoAnalytics, type PhotoFilter } from "../../api/photoData";
import { PhotoAnalyticsDashboard } from "./PhotoAnalyticsDashboard";

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
    focal:[],aperture:[],shutter:[],ev:[],
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
  beforeEach(()=>{
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
});
