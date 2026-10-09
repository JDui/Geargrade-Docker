import { apiDelete, apiGet, apiPost } from "./client";

export type PhotoField = { field_id: string; label: string; value_type: "enum" | "number" | "date"; operators: string[] };
export type PhotoRule = { field: string; op: string; value?: string | number | Array<string | number>; column_id?: string }
  | { op: "and" | "or" | "not"; children: PhotoRule[]; column_id?: string };
export type PhotoFilter = { version: "photo-filter.v1"; group: PhotoRule };
export type PhotoSource = { id: string; name: string; root_path: string; enabled: number; last_success: string | null };
export type PhotoScan = { id: string; started_at: string; ended_at: string | null; status: string; mode: string;
  seen: number; extracted: number; unchanged: number; failed: number; removed: number; error: string | null };
export type PhotoStatus = { sources: PhotoSource[]; recent_scans: PhotoScan[]; last_success: string | null };
export type PhotoSummary = { physical_files: number; logical_captures: number; raw_files: number | null; total_bytes: number;
  first_shot: string | null; last_shot: string | null; months: Array<{month:string;count:number}>; as_of:string | null };
export type PhotoItem = { id: number; filename: string; relpath: string; format_family: string; size_bytes: number;
  camera_model: string | null; camera_norm: string | null; lens_model: string | null; lens_norm: string | null;
  shot_at: string | null; iso: number | null; aperture: number | null; shutter: number | null; focal_mm: number | null;
  parse_status: string };
export type PhotoQuery = { total_files: number; total_captures: number; limit: number; offset: number;
  items: PhotoItem[]; as_of: string | null };
export type Facet = { field: string; options: Array<{ value: string | number | null; count: number }> };
export type UsageItem = { rank: number; canonical_key: string; name: string; capture_count: number;
  active_days: number; usage_share: number; first_shot_at: string | null; last_shot_at: string | null };
export type UsageLeaderboard = { items: UsageItem[]; total_captures: number; attributable_captures: number;
  unknown_captures: number; as_of: string | null; kind: string };
export type PhotoPreset = {id:string;name:string;filter:PhotoFilter;columns:string[]};

export const emptyPhotoFilter = (): PhotoFilter => ({ version: "photo-filter.v1", group: { op: "and", children: [] } });
const path = "/api/v1/photo-data";
export const getPhotoStatus = () => apiGet<PhotoStatus>(path + "/status");
export const getPhotoFields = () => apiGet<PhotoField[]>(path + "/filter-fields");
export const createPhotoSource = (name:string, root_path:string) => apiPost<PhotoSource>(path+"/sources", {name,root_path});
export const deletePhotoSource = (id:string) => apiDelete(path+"/sources/"+encodeURIComponent(id));
export const startPhotoScan = (mode:string = "incremental", confirm_large_removal:boolean = false) =>
  apiPost<{job_id:string}>(path+"/scan", { mode, confirm_large_removal });
export const getPhotoScan = (id:string) => apiGet<PhotoScan>(path+"/scan/"+encodeURIComponent(id));
export const cancelPhotoScan = (id:string) => apiPost<PhotoScan>(path+"/scan/"+encodeURIComponent(id)+"/cancel", {});
export const getPhotoSummary = (filter:PhotoFilter) => apiPost<PhotoSummary>(path+"/stats/query", {filter});
export const getPhotoQuery = (filter:PhotoFilter,limit:number = 40,offset:number = 0) =>
  apiPost<PhotoQuery>(path+"/query", {filter,limit,offset});
export const getPhotoFacet = (filter:PhotoFilter,field:string) =>
  apiPost<Facet>(path+"/facets", {filter,field,limit:100});
export const getPhotoUsage = (kind:"camera"|"lens",filter:PhotoFilter = emptyPhotoFilter(),sort_order:"asc"|"desc"="desc") =>
  apiPost<UsageLeaderboard>(path+"/leaderboard/query", {kind,filter,sort_order,limit:100});
export const getPhotoPresets = () => apiGet<PhotoPreset[]>(path+"/filter-presets");
export const createPhotoPreset = (name:string,filter:PhotoFilter,columns:string[]) =>
  apiPost<PhotoPreset>(path+"/filter-presets", {name,filter,columns});
export const deletePhotoPreset = (id:string) => apiDelete(path+"/filter-presets/"+encodeURIComponent(id));

export async function exportPhotoData(filter:PhotoFilter):Promise<void> {
  const response = await fetch(path+"/exports", {
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({filter})
  });
  if (!response.ok) {
    const message = await response.json().catch(() => ({}));
    throw new Error(message.detail || "导出失败");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "geargrade-photo-data.zip";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
