import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPhotoUsage, type UsageLeaderboard } from "../../api/photoData";
import PhotoUsageLeaderboard from "./PhotoUsageLeaderboard";
vi.mock("../../api/photoData",async importOriginal=>({
  ...await importOriginal<typeof import("../../api/photoData")>(),getPhotoUsage:vi.fn()
}));
const fixture:UsageLeaderboard={
  kind:"camera",total_captures:10,attributable_captures:10,unknown_captures:0,as_of:null,
  items:[{rank:1,canonical_key:"sony:ilce-7m4",name:"A7 IV",capture_count:10,active_days:1,usage_share:1,first_shot_at:null,last_shot_at:null}]
};
describe("PhotoUsageLeaderboard",()=>{
  beforeEach(()=>vi.mocked(getPhotoUsage).mockReset());
  it("does not display an empty library while the first request is pending",async()=>{
    let resolve!:(value:UsageLeaderboard)=>void;
    vi.mocked(getPhotoUsage).mockReturnValue(new Promise(r=>{resolve=r;}));
    render(<MemoryRouter><PhotoUsageLeaderboard/></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("正在更新拍摄使用量榜");
    expect(screen.queryByText(/尚无可识别的拍摄数据/)).not.toBeInTheDocument();
    await act(async()=>resolve(fixture));
    expect(screen.getByRole("link",{name:/A7 IV/})).toHaveAttribute("href","/photo-data?camera=sony%3Ailce-7m4");
  });
  it("retains the podium but blocks its old destination during a kind change",async()=>{
    vi.mocked(getPhotoUsage).mockResolvedValueOnce(fixture).mockReturnValueOnce(new Promise(()=>{}));
    render(<MemoryRouter><PhotoUsageLeaderboard/></MemoryRouter>);
    const card=await screen.findByRole("link",{name:/A7 IV/});
    fireEvent.click(screen.getByRole("button",{name:"镜头",exact:true}));
    expect(screen.getByRole("link",{name:/A7 IV/})).toBe(card);
    expect(card).toHaveAttribute("aria-disabled","true");
    // A cancelled default action prevents old camera records from navigating as lenses.
    expect(fireEvent.click(card)).toBe(false);
  });
});
