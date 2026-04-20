import { apiGet, apiPost } from "./client";
import type {
  DataExportResponse,
  DataImportResponse,
  DataResetResponse,
  DevicePayload
} from "../types/device";


export function exportData(): Promise<DataExportResponse> {
  return apiGet<DataExportResponse>("/api/v1/data/export");
}


export function importData(items: DevicePayload[]): Promise<DataImportResponse> {
  return apiPost<DataImportResponse>("/api/v1/data/import", { items });
}


export function resetAllData(): Promise<DataResetResponse> {
  return apiPost<DataResetResponse>("/api/v1/data/reset", {});
}
