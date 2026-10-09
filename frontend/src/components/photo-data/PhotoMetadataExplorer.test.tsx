import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PhotoMetadataExplorer } from "./PhotoMetadataExplorer";
import type { PhotoItem, PhotoQuery } from "../../api/photoData";

const file:PhotoItem={
  id:17,source_id:"nas",filename:"DSC001.ARW",
  relpath:"2026/Trip/DSC001.ARW",ext:".arw",format_family:"raw",size_bytes:24100000,
  camera_model:"ILCE-7M4",camera_norm:"sony:ilce-7m4",
  lens_model:"Tamron 28-200",lens_norm:"tamron 28-200",
  shot_at:"2026-10-03T13:45:23",iso:200,aperture:4,shutter:0.004,
  focal_mm:58,width_px:7008,height_px:4672,parse_status:"ok"
};
const items:PhotoQuery={items:[file],total_files:41,total_captures:38,limit:40,offset:0,as_of:null};
function mount(result:PhotoQuery|null=items){
  const onPageChange=vi.fn(),onPageSizeChange=vi.fn(),onSearchChange=vi.fn(),onExport=vi.fn();
  const view=render(<PhotoMetadataExplorer results={result} loading={false}
    page={0} pageSize={40} onPageChange={onPageChange} onPageSizeChange={onPageSizeChange}
    search="" onSearchChange={onSearchChange} onExport={onExport}/>);
  return {view,onPageChange,onPageSizeChange,onSearchChange,onExport};
}
describe("PhotoMetadataExplorer",()=>{
  it("renders file rows, server pagination and file-only search",()=>{
    const handlers=mount();
    expect(screen.getByText("匹配 41 个文件 / 38 次拍摄，当前 1–40 个文件")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox",{name:"文件名或相对路径搜索"}),{target:{value:"DCIM"}});
    expect(handlers.onSearchChange).toHaveBeenCalledWith("DCIM");
    fireEvent.change(screen.getByLabelText("每页显示文件数"),{target:{value:"100"}});
    expect(handlers.onPageSizeChange).toHaveBeenCalledWith(100);
    fireEvent.click(screen.getByRole("button",{name:"下一页"}));
    expect(handlers.onPageChange).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByRole("button",{name:"导出当前明细结果"}));
    expect(handlers.onExport).toHaveBeenCalledOnce();
  });
  it("opens indexed file details and closes using Escape while restoring focus",()=>{
    mount();
    const button=screen.getByRole("button",{name:"查看元数据：DSC001.ARW"});
    fireEvent.click(button);
    const dialog=screen.getByRole("dialog",{name:"文件元数据：DSC001.ARW"});
    expect(dialog).toHaveTextContent("2026/Trip/DSC001.ARW");
    expect(dialog).toHaveTextContent("7008 × 4672 px");
    expect(document.body).toHaveStyle({overflow:"hidden"});
    fireEvent.keyDown(document,{key:"Escape"});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(button).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });
  it("displays empty results without rendering any original photo images",()=>{
    mount({...items,total_files:0,total_captures:0,items:[]});
    expect(screen.getByText(/没有匹配的索引照片/)).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });
});
