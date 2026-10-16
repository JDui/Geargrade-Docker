import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { exportPhotoStatistics, type PhotoFilter } from "../../api/photoData";
import { PhotoStatisticsExport } from "./PhotoStatisticsExport";

vi.mock("../../api/photoData", () => ({ exportPhotoStatistics: vi.fn() }));
const filter:PhotoFilter={version:"photo-filter.v1",group:{op:"and",children:[
  {field:"exposure.iso",op:"gte",value:800}
]}};

describe("PhotoStatisticsExport",()=>{
  beforeEach(()=>vi.mocked(exportPhotoStatistics).mockReset());

  it("exports the supplied filter and prevents duplicate downloads until completion",async()=>{
    let resolve!:()=>void;
    vi.mocked(exportPhotoStatistics).mockReturnValue(new Promise<void>(done=>{resolve=done;}));
    render(<PhotoStatisticsExport filter={filter} pending={false}/>);
    fireEvent.click(screen.getByRole("button",{name:"导出当前筛选的图表统计"}));
    const exporting=screen.getByRole("button",{name:"正在导出图表统计…"});
    expect(exporting).toBeDisabled();
    fireEvent.click(exporting);
    expect(exportPhotoStatistics).toHaveBeenCalledOnce();
    expect(exportPhotoStatistics).toHaveBeenCalledWith(filter);
    await act(async()=>resolve());
    expect(screen.getByRole("button",{name:"导出当前筛选的图表统计"})).toBeEnabled();
  });

  it("waits for filter/search results to settle before enabling export",()=>{
    const view=render(<PhotoStatisticsExport filter={filter} pending={true}/>);
    const button=screen.getByRole("button",{name:"导出当前筛选的图表统计"});
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(exportPhotoStatistics).not.toHaveBeenCalled();
    view.rerender(<PhotoStatisticsExport filter={filter} pending={false}/>);
    expect(button).toBeEnabled();
  });

  it("shows an export failure and allows retry",async()=>{
    vi.mocked(exportPhotoStatistics).mockRejectedValueOnce(new Error("统计导出失败"));
    render(<PhotoStatisticsExport filter={filter} pending={false}/>);
    fireEvent.click(screen.getByRole("button",{name:"导出当前筛选的图表统计"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("统计导出失败");
    vi.mocked(exportPhotoStatistics).mockResolvedValueOnce();
    fireEvent.click(screen.getByRole("button",{name:"导出当前筛选的图表统计"}));
    await waitFor(()=>expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(exportPhotoStatistics).toHaveBeenCalledTimes(2);
  });
});
