import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../api/photoData";
import PhotoDataPage from "./PhotoDataPage";
import DataToolsPage from "./DataToolsPage";

vi.mock("../api/photoData", async importOriginal => {
  const actual = await importOriginal<typeof api>();
  return { ...actual, ...Object.fromEntries([
    "getPhotoStatus", "getPhotoFields", "getPhotoPresets", "getPhotoQuery", "getPhotoSummary",
    "getPhotoFacet", "getPhotoScan", "startPhotoScan", "cancelPhotoScan"
  ].map(name => [name, vi.fn()])) };
});
vi.mock("../components/photo-data/PhotoAnalyticsDashboard", () => ({
  PhotoAnalyticsDashboard: () => <div>Analytics</div>
}));
vi.mock("../components/photo-data/PhotoDatabaseMaintenance", () => ({
  PhotoDatabaseMaintenance: () => <div>Database Maintenance</div>
}));
vi.mock("../components/tools/DataToolsSection", () => ({ DataToolsSection: () => <div>Device Tools</div> }));
const fields: api.PhotoField[] = [
  ["capture.month", "月份", "enum"], ["camera.model_norm", "机身", "enum"],
  ["lens.model_norm", "镜头", "enum"], ["files.format_family", "格式", "enum"],
  ["exposure.iso", "ISO", "number"], ["capture.weekday", "星期", "number"]
].map(([field_id, label, value_type]) => ({field_id, label, value_type: value_type as api.PhotoField["value_type"], operators: []}));
const run = (): api.PhotoScan => ({
  id:"scan-1",started_at:"2026-10-09T10:00:00Z",ended_at:null,status:"running",mode:"incremental",
  seen:100,extracted:25,unchanged:0,failed:0,removed:0,error:null,processed:25,total_candidates:100,
  directories_seen:2,phase:"enumerating",workers:3,active_workers:2,enumeration_done:0,rate_files_per_sec:5
});
function mount(path="/photo-data") { return render(<MemoryRouter initialEntries={[path]}><Routes>
  <Route path="/photo-data" element={<PhotoDataPage/>}/>
  <Route path="/data-tools" element={<DataToolsPage/>}/>
</Routes></MemoryRouter>); }
async function ready() {
  fireEvent.click(await screen.findByRole("button",{name:/全局筛选/}));
  await waitFor(()=>expect(screen.getAllByLabelText("列字段")[0]).toHaveValue("capture.month"));
}
function lastFilter() { return vi.mocked(api.getPhotoSummary).mock.calls.at(-1)![0]; }

describe("PhotoDataPage regressions", () => {
  beforeEach(()=>{
    vi.clearAllMocks();
    vi.mocked(api.getPhotoStatus).mockResolvedValue({sources:[],recent_scans:[],last_success:null});
    vi.mocked(api.getPhotoFields).mockResolvedValue(fields);
    vi.mocked(api.getPhotoPresets).mockResolvedValue([]);
    vi.mocked(api.getPhotoQuery).mockResolvedValue({items:[],total_files:0,total_captures:0,limit:40,offset:0,as_of:null});
    vi.mocked(api.getPhotoSummary).mockResolvedValue({physical_files:0,logical_captures:0,raw_files:0,total_bytes:0,first_shot:null,last_shot:null,months:[],as_of:null});
    vi.mocked(api.getPhotoFacet).mockImplementation(async (_filter,field)=>({field,options:[{value:field==="capture.weekday"?3:"sample",count:1}]}));
    vi.mocked(api.getPhotoScan).mockResolvedValue(run());
  });
  afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});

  it("requests facets when an empty column is added or its field changes",async()=>{
    mount();await ready();
    fireEvent.click(screen.getByRole("button",{name:"+ 添加列"}));
    await waitFor(()=>expect(api.getPhotoFacet).toHaveBeenCalledWith(expect.anything(),"exposure.iso"));
    fireEvent.change(screen.getAllByLabelText("列字段")[4],{target:{value:"capture.weekday"}});
    await waitFor(()=>expect(api.getPhotoFacet).toHaveBeenCalledWith(expect.anything(),"capture.weekday"));
    const column=screen.getAllByLabelText("列字段")[4].parentElement!.parentElement!;
    fireEvent.click(await within(column).findByRole("checkbox"));
    await waitFor(()=>expect(lastFilter().group).toMatchObject({children:[{field:"capture.weekday",op:"in",value:[3]}]}));
  });

  it("renders and edits IN rules restored from a column preset",async()=>{
    vi.mocked(api.getPhotoPresets).mockResolvedValue([{id:"p1",name:"ISO preset",columns:[],filter:{version:"photo-filter.v1",group:{op:"and",children:[{field:"exposure.iso",op:"in",value:[800,1600]}]}}}]);
    mount();await ready();
    fireEvent.click(screen.getByRole("button",{name:"ISO preset"}));
    expect(screen.getByLabelText("筛选操作符")).toHaveValue("in");
    expect(screen.getByLabelText("比较值")).toHaveValue("800,1600");
    fireEvent.change(screen.getByLabelText("比较值"),{target:{value:"400,"}});
    expect(screen.getByLabelText("比较值")).toHaveValue("400,");
    fireEvent.change(screen.getByLabelText("比较值"),{target:{value:"400,3200"}});
    await waitFor(()=>expect(lastFilter().group).toMatchObject({children:[{field:"exposure.iso",op:"in",value:[400,3200]}]}));
  });

  it("creates a valid NOT child and removes it without leaving an empty NOT",async()=>{
    mount();await ready();fireEvent.click(screen.getByRole("button",{name:"高级规则"}));
    fireEvent.change(screen.getByLabelText("条件组逻辑"),{target:{value:"not"}});
    expect(screen.getByLabelText("筛选字段")).toHaveValue("exposure.iso");
    fireEvent.click(screen.getByRole("button",{name:"移除",exact:true}));
    expect(screen.getByLabelText("条件组逻辑")).toHaveValue("and");
    await waitFor(()=>expect(lastFilter().group).toMatchObject({children:[]}));
  });

  it("shows cancellation errors while keeping the active scan visible",async()=>{
    vi.mocked(api.getPhotoStatus).mockResolvedValue({sources:[],recent_scans:[run()],last_success:null});
    vi.mocked(api.cancelPhotoScan).mockRejectedValue(new Error("取消失败，请重试"));
    mount();fireEvent.click(await screen.findByRole("button",{name:"取消",exact:true}));
    expect(await screen.findByRole("alert")).toHaveTextContent("取消失败，请重试");
    expect(screen.getByRole("progressbar").firstElementChild).toHaveClass("photo-scan-indeterminate");
  });

  it("never overlaps polling and ignores a response after unmount",async()=>{
    vi.useFakeTimers();
    let resolve!:(value:api.PhotoScan)=>void;
    vi.mocked(api.getPhotoStatus).mockResolvedValue({sources:[],recent_scans:[run()],last_success:null});
    vi.mocked(api.getPhotoScan).mockReturnValue(new Promise(r=>{resolve=r;}));
    const view=mount();await act(async()=>{await Promise.resolve();});
    expect(api.getPhotoScan).toHaveBeenCalledTimes(1);
    await act(async()=>{vi.advanceTimersByTime(3600);});
    expect(api.getPhotoScan).toHaveBeenCalledTimes(1);
    view.unmount();const calls=vi.mocked(api.getPhotoStatus).mock.calls.length;
    await act(async()=>resolve({...run(),status:"completed",phase:"completed"}));
    expect(api.getPhotoStatus).toHaveBeenCalledTimes(calls);
  });

  it("shows a stopped scan without an indefinite animation",async()=>{
    vi.mocked(api.getPhotoStatus).mockResolvedValue({sources:[],recent_scans:[{...run(),status:"cancelled",phase:"cancelled"}],last_success:null});
    mount();await ready();
    expect(screen.getByRole("progressbar",{hidden:true})).toHaveAttribute("aria-valuetext","扫描已停止，文件总量未确定");
    expect(screen.getByRole("progressbar",{hidden:true}).firstElementChild).not.toHaveClass("photo-scan-indeterminate");
  });

  it("keeps photo files in data tools, folded and unqueried until opened",async()=>{
    mount("/data-tools");
    const toggle=screen.getByRole("button",{name:/照片明细.*展开/});
    expect(toggle).toHaveAttribute("aria-expanded","false");
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    expect(api.getPhotoQuery).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(await screen.findByRole("searchbox")).toBeInTheDocument();
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledOnce());
    expect(api.getPhotoStatus).not.toHaveBeenCalled();
    expect(screen.queryByRole("button",{name:"扫描更新"})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/照片明细.*收起/}));
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button",{name:/照片明细.*展开/}));
    expect(api.getPhotoQuery).toHaveBeenCalledOnce();
  });

  it("does not display or request file rows on the analytics page",async()=>{
    mount();await screen.findByText("Analytics");
    expect(screen.queryByRole("tab",{name:"照片明细"})).not.toBeInTheDocument();
    expect(api.getPhotoQuery).not.toHaveBeenCalled();
    expect(screen.getByRole("link",{name:/查看照片明细/})).toHaveAttribute("href",expect.stringContaining("/data-tools?photo_files=1"));
  });

  it("redirects old file links and retains the camera filter",async()=>{
    mount("/photo-data?view=files&camera=sony%3Ailce-7m4");
    await screen.findByRole("heading",{name:"数据工具"});
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledWith(
      expect.objectContaining({group:expect.objectContaining({children:expect.arrayContaining([
        expect.objectContaining({field:"camera.model_norm",op:"in",value:["sony:ilce-7m4"]})
      ])})}),40,0));
    expect(screen.getByRole("button",{name:/照片明细.*收起/})).toHaveAttribute("aria-expanded","true");
  });

  it("keeps global filter conditions across analytics and file workspaces",async()=>{
    mount();await ready();
    const column=screen.getAllByLabelText("列字段")[0].parentElement!.parentElement!;
    fireEvent.click(await within(column).findByRole("checkbox"));
    await waitFor(()=>expect(lastFilter().group).toMatchObject({children:[{field:"capture.month",op:"in",value:["sample"]}]}));
    const transferred=lastFilter();
    fireEvent.click(screen.getByRole("button",{name:"完成 / 关闭"}));
    fireEvent.click(screen.getByRole("link",{name:/查看照片明细/}));
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledWith(
      transferred,40,0));
    expect(screen.getByRole("button",{name:/全局筛选/})).toHaveTextContent("1 项");
    expect(screen.getByRole("heading",{name:"数据工具"})).toBeInTheDocument();
  });

  it("applies file name search only to file queries and keeps global summary untouched",async()=>{
    mount("/data-tools?photo_files=1");
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalled());
    const summaries=vi.mocked(api.getPhotoSummary).mock.calls.length;
    fireEvent.change(screen.getByRole("searchbox",{name:"文件名或相对路径搜索"}),{target:{value:"A7M4"}});
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledWith(
      expect.objectContaining({group:expect.objectContaining({children:expect.arrayContaining([
        expect.objectContaining({field:"files.relpath",op:"contains",value:"A7M4"})
      ])})}),40,0));
    expect(vi.mocked(api.getPhotoSummary).mock.calls.length).toBe(summaries);
  });

  it("keeps deep transferred groups intact when adding a file search",async()=>{
    let nested:api.PhotoRule={field:"exposure.iso",op:"gte",value:800};
    for(let level=0;level<4;level++)nested={op:"not",children:[nested]};
    const filter:api.PhotoFilter={version:"photo-filter.v1",group:{op:"and",children:[nested]}};
    const params=new URLSearchParams({photo_files:"1",photo_filter:JSON.stringify(filter)});
    mount("/data-tools?"+params.toString());
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledWith(filter,40,0));
    fireEvent.change(screen.getByRole("searchbox",{name:"文件名或相对路径搜索"}),{target:{value:"DSC"}});
    await waitFor(()=>expect(api.getPhotoQuery).toHaveBeenCalledWith({version:"photo-filter.v1",group:{op:"and",children:[
      nested,{field:"files.relpath",op:"contains",value:"DSC"}
    ]}},40,0));
  });

  it("renders global filters as a centered body portal and restores scroll on Escape",async()=>{
    mount();
    await ready();
    const dialog=screen.getByRole("dialog",{name:"照片全局筛选"});
    const portal=dialog.closest(".photo-modal-layer");
    expect(portal?.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("photo-filter-modal");
    expect(dialog.querySelector(".photo-modal-scroll")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
    expect(dialog.querySelectorAll('select[aria-label="列字段"]').length).toBeGreaterThanOrEqual(3);
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("dialog",{name:"照片全局筛选"})).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe("");
    expect(screen.getByRole("button",{name:/全局筛选/})).toHaveFocus();
  });

});
