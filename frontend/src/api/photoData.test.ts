import { afterEach, describe, expect, it, vi } from "vitest";
import { exportPhotoData, exportPhotoStatistics, type PhotoFilter } from "./photoData";

const filter:PhotoFilter={version:"photo-filter.v1",group:{op:"and",children:[
  {field:"files.relpath",op:"contains",value:"旅行"}
]}};

describe("photo data downloads",()=>{
  afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();});

  it.each([
    [exportPhotoStatistics,"/exports/statistics","geargrade-photo-statistics.zip"],
    [exportPhotoData,"/exports","geargrade-photo-data.zip"]
  ] as const)("downloads an archive with its filter and filename (%s)",async(download,endpoint,filename)=>{
    const blob=new Blob(["zip"]);
    const fetchMock=vi.fn().mockResolvedValue({ok:true,blob:async()=>blob});
    vi.stubGlobal("fetch",fetchMock);
    const createObjectURL=vi.fn().mockReturnValue("blob:photo-export");
    const revokeObjectURL=vi.fn();
    vi.stubGlobal("URL",Object.assign(class extends URL {},{createObjectURL,revokeObjectURL}));
    let clicked:{filename:string;href:string}|undefined;
    vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(function(){
      clicked={filename:this.download,href:this.href};
    });
    await download(filter);
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/photo-data"+endpoint,{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({filter})
    });
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual({filename,href:"blob:photo-export"});
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:photo-export");
    expect(document.querySelector("a[download]")).toBeNull();
  });

  it("reports a server rejection without creating a download",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({detail:"筛选条件无效"})}));
    const click=vi.spyOn(HTMLAnchorElement.prototype,"click");
    await expect(exportPhotoStatistics(filter)).rejects.toThrow("筛选条件无效");
    expect(click).not.toHaveBeenCalled();
  });
});
