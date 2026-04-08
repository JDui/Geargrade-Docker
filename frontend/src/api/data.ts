import { apiGet, apiPost } from "./client";
import type { DataExportResponse, DataImportResponse, DevicePayload } from "../types/device";


export function exportData(): Promise<DataExportResponse> {
  return apiGet<DataExportResponse>("/api/v1/data/export");
}


export function importData(items: DevicePayload[]): Promise<DataImportResponse> {
  return apiPost<DataImportResponse>("/api/v1/data/import", { items });
}
