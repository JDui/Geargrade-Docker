import { apiGet, apiPatch } from "./client";

export interface AppSettingsApi {
  simplified_mode: boolean;
  motion_mode: "system" | "on" | "reduced";
  content_width: "compact" | "default" | "wide";
  density: "comfortable" | "compact";
  show_background_grid: boolean;
  default_icon_size: "small" | "medium";
  updated_at?: string;
}

export function fetchAppSettings(): Promise<AppSettingsApi> {
  return apiGet<AppSettingsApi>("/api/v1/settings");
}

export function updateAppSettings(payload: Partial<AppSettingsApi>): Promise<AppSettingsApi> {
  return apiPatch<AppSettingsApi>("/api/v1/settings", payload);
}
