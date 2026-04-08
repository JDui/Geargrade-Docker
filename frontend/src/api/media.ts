import { apiPost, apiUpload } from "./client";
import type { MediaAsset } from "../types/device";

export function uploadMedia(file: File): Promise<MediaAsset> {
  const formData = new FormData();
  formData.append("file", file);
  return apiUpload<MediaAsset>("/api/v1/media/upload", formData);
}

export function cacheRemoteMedia(imageUrl: string): Promise<MediaAsset> {
  return apiPost<MediaAsset>("/api/v1/media/cache-remote", { image_url: imageUrl });
}
