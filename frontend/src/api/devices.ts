import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type { DeviceDetail, DeviceFilters, DeviceListResponse, DevicePayload } from "../types/device";

export function buildDeviceQuery(filters: DeviceFilters): string {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.status) params.set("status", filters.status);
  if (filters.rating) params.set("rating", filters.rating);
  params.set("sort_by", filters.sortBy);
  params.set("sort_order", filters.sortOrder);

  return params.toString();
}

export function fetchDevices(filters: DeviceFilters): Promise<DeviceListResponse> {
  const query = buildDeviceQuery(filters);
  const path = query ? `/api/v1/devices?${query}` : "/api/v1/devices";
  return apiGet<DeviceListResponse>(path);
}

export function fetchDevice(deviceId: string): Promise<DeviceDetail> {
  return apiGet<DeviceDetail>(`/api/v1/devices/${deviceId}`);
}

export function createDevice(payload: DevicePayload): Promise<DeviceDetail> {
  return apiPost<DeviceDetail>("/api/v1/devices", payload);
}

export function updateDevice(deviceId: string, payload: Partial<DevicePayload>): Promise<DeviceDetail> {
  return apiPatch<DeviceDetail>(`/api/v1/devices/${deviceId}`, payload);
}

export function deleteDevice(deviceId: string): Promise<void> {
  return apiDelete(`/api/v1/devices/${deviceId}`);
}
