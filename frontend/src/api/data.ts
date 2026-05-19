import { apiGet, apiPost } from "./client";
import type {
  DataExportResponse,
  DataImportResponse,
  DataResetResponse,
  GGPack,
  GGPackImportRequest,
  GGPackImportResponse,
  GGPackPreviewResponse,
  GGPackScope
} from "../types/device";


export function exportData(): Promise<DataExportResponse> {
  return apiGet<DataExportResponse>("/api/v1/data/export");
}


export function importData(payload: unknown): Promise<DataImportResponse> {
  return apiPost<DataImportResponse>("/api/v1/data/import", payload);
}


export function exportGGPack(scope: GGPackScope): Promise<GGPack> {
  return apiGet<GGPack>(`/api/v1/data/ggpack/export?scope=${scope}`);
}


export function previewGGPack(payload: GGPack): Promise<GGPackPreviewResponse> {
  return apiPost<GGPackPreviewResponse>("/api/v1/data/ggpack/preview", payload);
}


export function importGGPack(payload: GGPackImportRequest): Promise<GGPackImportResponse> {
  return apiPost<GGPackImportResponse>("/api/v1/data/ggpack/import", payload);
}


export function resetAllData(): Promise<DataResetResponse> {
  return apiPost<DataResetResponse>("/api/v1/data/reset", {});
}
