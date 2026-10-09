import { apiDelete, apiGet, apiPost } from "./client";

export type PhotoField = { field_id: string; label: string; value_type: "enum" | "number" | "date"; operators: string[] };
export type PhotoRule = { field: string; op: string; value?: string | number | Array<string | number>; column_id?: string }
  | { op: "and" | "or" | "not"; children: PhotoRule[]; column_id?: string };
export type PhotoFilter = { version: "photo-filter.v1"; group: PhotoRule };
export type PhotoSource = { id: string; name: string; root_path: string; enabled: number; last_success: string | null };
export type PhotoScan = { id: string; started_at: string; ended_at: string | null; status: string; mode: string;
  seen: number; extracted: number; unchanged: number; failed: number; removed: number; error: string | null;
  processed: number; total_candidates: number; directories_seen: number; phase: string;
  workers: number; active_workers: number; enumeration_done: number;
  rate_files_per_sec: number };
export type PhotoStatus = { sources: PhotoSource[]; recent_scans: PhotoScan[]; last_success: string | null };
export type PhotoSummary = { physical_files: number; logical_captures: number; raw_files: number | null; total_bytes: number;
  first_shot: string | null; last_shot: string | null; months: Array<{month:string;count:number}>; as_of:string | null };
export type PhotoItem = { id: number; source_id: string; filename: string; relpath: string; ext: string; format_family: string; size_bytes: number;
  width_px: number | null; height_px: number | null;
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
export type AnalyticsCount = { name: string; count: number };
export type AnalyticsPoint = { key: string; count: number };
export type AnalyticsBucket = { label: string; bucket: number; count: number; min: number | null; max: number | null; field: string };
export type AnalyticsHeatCell = { x: number; y: number; count: number };
export type PhotoAnalytics = {
  schema_version: string;
  as_of: string | null;
  overview: {
    captures: number; files: number; bytes: number; dated: number | null;
    raw_captures: number; raw_files: number | null; paired_captures: number;
    failed_files: number | null; camera_known: number | null; lens_known: number | null;
    first_shot: string | null; last_shot: string | null;
  };
  timeline: {
    yearly: AnalyticsPoint[]; monthly: AnalyticsPoint[];
    daily: { date: string; count: number }[];
    hours: { hour: number; count: number }[];
    weekdays: { weekday: number; count: number }[];
    weekday_hour: { weekday: number; hour: number; count: number }[];
  };
  gear: {
    cameras: AnalyticsCount[]; lenses: AnalyticsCount[]; makers: AnalyticsCount[];
    combos: { camera: string; lens: string; count: number }[];
    camera_years: { year: string; camera: string; count: number }[];
    lens_by_camera: { camera: string; lens: string; count: number }[];
  };
  exposure: {
    iso: AnalyticsBucket[]; focal: AnalyticsBucket[]; focal_coverage: AnalyticsCount[]; aperture: AnalyticsBucket[];
    shutter: AnalyticsBucket[]; ev: AnalyticsBucket[];
    flash: AnalyticsCount[]; wb: AnalyticsCount[]; focus: AnalyticsCount[];
    drive: AnalyticsCount[]; shutter_type: AnalyticsCount[]; picture_style: AnalyticsCount[];
    iso_shutter: AnalyticsHeatCell[]; focal_aperture: AnalyticsHeatCell[];
  };
  files: {
    formats: AnalyticsCount[]; capture_formats: AnalyticsCount[];
    size: AnalyticsBucket[]; resolution: AnalyticsBucket[];
    orientation: AnalyticsCount[]; aspect: AnalyticsCount[];
    status: AnalyticsCount[]; software: AnalyticsCount[];
    color_space: AnalyticsCount[];
  };
  quality: { name: string; count: number; total: number }[];
  notes: { captures: string; files: string; time: string; gaps: string };
};

export type PhotoMaintenanceJob = {
  id:string;operation:"migrate"|"cleanup"|"vacuum";status:"running"|"completed"|"failed";
  phase:string;error?:string|null;backup_file?:string;started_at?:string;ended_at?:string;
  result?:{message:string;backup_file?:string;removed_photos?:number;removed_scan_runs?:number;bytes_before?:number;bytes_after?:number};
};
export type PhotoMaintenanceStatus = {
  schema_version:number;target_schema_version:number;migration_required:boolean;
  db_bytes:number;wal_bytes:number;freelist_bytes:number;stage_bytes:number;
  physical_files:number;active_photos:number;missing_photos:number;
  eligible_for_purge:number;legacy_stage_rows:number;scan_runs:number;scan_active:boolean;
  policy:{missing_confirmations:number;missing_days:number;retain_run_count:number;retain_run_days:number};
  job:PhotoMaintenanceJob|null;
};
export const getPhotoMaintenance = () => apiGet<PhotoMaintenanceStatus>(path+"/maintenance/status");
export const startPhotoMaintenance = (op:"migrate"|"cleanup"|"vacuum") =>
  apiPost<PhotoMaintenanceJob>(path+"/maintenance/"+op,{confirm:true});

export const getPhotoStatus = () => apiGet<PhotoStatus>(path + "/status");
export const getPhotoFields = () => apiGet<PhotoField[]>(path + "/filter-fields");
export const createPhotoSource = (name:string, root_path:string) => apiPost<PhotoSource>(path+"/sources", {name,root_path});
export const deletePhotoSource = (id:string) => apiDelete(path+"/sources/"+encodeURIComponent(id));
export const startPhotoScan = (mode:string = "incremental", confirm_large_removal:boolean = false) =>
  apiPost<{job_id:string}>(path+"/scan", { mode, confirm_large_removal });
export const getPhotoScan = (id:string) => apiGet<PhotoScan>(path+"/scan/"+encodeURIComponent(id));
export const cancelPhotoScan = (id:string) => apiPost<PhotoScan>(path+"/scan/"+encodeURIComponent(id)+"/cancel", {});
export const getPhotoSummary = (filter:PhotoFilter) => apiPost<PhotoSummary>(path+"/stats/query", {filter});
export const getPhotoAnalytics = (filter:PhotoFilter) => apiPost<PhotoAnalytics>(path+"/analytics/query", {filter});
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
