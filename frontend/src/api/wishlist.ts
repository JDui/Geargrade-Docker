import { apiDelete, apiGet, apiPatch, apiPost } from "./client";
import type {
  WishlistDeviceDetail,
  WishlistDeviceListResponse,
  WishlistDevicePayload,
  WishlistFilters,
  WishlistRedeemPayload
} from "../types/device";
import type { DeviceDetail } from "../types/device";


function buildWishlistQuery(filters: WishlistFilters): string {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.rating) params.set("rating_label", filters.rating);
  if (filters.feelingOnly) params.set("feeling_only", "true");
  params.set("sort_by", filters.sortBy);
  params.set("sort_order", filters.sortOrder);

  return params.toString();
}


export function fetchWishlistDevices(filters: WishlistFilters): Promise<WishlistDeviceListResponse> {
  const query = buildWishlistQuery(filters);
  const path = query ? `/api/v1/wishlist/devices?${query}` : "/api/v1/wishlist/devices";
  return apiGet<WishlistDeviceListResponse>(path);
}


export function fetchWishlistDevice(deviceId: string): Promise<WishlistDeviceDetail> {
  return apiGet<WishlistDeviceDetail>(`/api/v1/wishlist/devices/${deviceId}`);
}


export function createWishlistDevice(payload: WishlistDevicePayload): Promise<WishlistDeviceDetail> {
  return apiPost<WishlistDeviceDetail>("/api/v1/wishlist/devices", payload);
}


export function updateWishlistDevice(
  deviceId: string,
  payload: Partial<WishlistDevicePayload>
): Promise<WishlistDeviceDetail> {
  return apiPatch<WishlistDeviceDetail>(`/api/v1/wishlist/devices/${deviceId}`, payload);
}


export function deleteWishlistDevice(deviceId: string): Promise<void> {
  return apiDelete(`/api/v1/wishlist/devices/${deviceId}`);
}


export function redeemWishlistDevice(
  deviceId: string,
  payload: WishlistRedeemPayload
): Promise<DeviceDetail> {
  return apiPost<DeviceDetail>(`/api/v1/wishlist/devices/${deviceId}/redeem`, payload);
}
