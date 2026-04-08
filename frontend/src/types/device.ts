export type DeviceCategory =
  | "camera_body"
  | "lens"
  | "action_camera"
  | "drone"
  | "accessory"
  | "other";

export type DeviceStatus =
  | "holding"
  | "for_sale"
  | "sold"
  | "archived"
  | "pending"
  | "broken";

export type DeviceRating = "god" | "excellent" | "average" | "low" | "special";
export type ImageSourceType = "upload" | "cached_remote";
export type SortBy =
  | "purchase_date"
  | "sale_date"
  | "purchase_price"
  | "sale_price"
  | "rating"
  | "updated_at"
  | "created_at";
export type SortOrder = "asc" | "desc";
export type ViewMode = "cards" | "table";

export interface DeviceListItem {
  id: number;
  name: string;
  brand: string;
  category: DeviceCategory;
  mount_system: string | null;
  status: DeviceStatus;
  rating: DeviceRating;
  summary: string;
  tags: string[];
  purchase_price: number | null;
  sale_price: number | null;
  purchase_date: string | null;
  sale_date: string | null;
  is_currently_owned: boolean;
  image_source_type: ImageSourceType | null;
  image_original_url: string | null;
  image_storage_path: string | null;
  image_storage_name: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceDetail extends DeviceListItem {
  pros: string[];
  cons: string[];
  review_detail: string;
}

export interface DeviceListResponse {
  items: DeviceListItem[];
  total: number;
}

export interface DevicePayload {
  name: string;
  brand: string;
  category: DeviceCategory;
  mount_system: string | null;
  status: DeviceStatus;
  rating: DeviceRating;
  summary: string;
  pros: string[];
  cons: string[];
  review_detail: string;
  tags: string[];
  purchase_price: number | null;
  sale_price: number | null;
  purchase_date: string | null;
  sale_date: string | null;
  is_currently_owned: boolean | null;
  image_source_type: ImageSourceType | null;
  image_original_url: string | null;
  image_storage_path: string | null;
  image_storage_name: string | null;
}

export interface DashboardBucket<T extends string> {
  key: T;
  count: number;
}

export interface DashboardSummary {
  currently_owned_count: number;
  sold_count: number;
  ratings: DashboardBucket<DeviceRating>[];
  categories: DashboardBucket<DeviceCategory>[];
}

export interface MediaAsset {
  source_type: ImageSourceType;
  original_url: string | null;
  storage_path: string;
  storage_name: string;
  url: string;
}

export interface DeviceFilters {
  search: string;
  category: DeviceCategory | "";
  status: DeviceStatus | "";
  rating: DeviceRating | "";
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export const CATEGORY_LABELS: Record<DeviceCategory, string> = {
  camera_body: "机身",
  lens: "镜头",
  action_camera: "运动相机",
  drone: "无人机",
  accessory: "配件",
  other: "其他"
};

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  holding: "持有中",
  for_sale: "待售",
  sold: "已售",
  archived: "归档",
  pending: "待确认",
  broken: "已损坏"
};

export const RATING_LABELS: Record<DeviceRating, string> = {
  god: "神",
  excellent: "极佳",
  average: "中规中矩",
  low: "低",
  special: "特殊状态"
};

export const DEFAULT_FILTERS: DeviceFilters = {
  search: "",
  category: "",
  status: "",
  rating: "",
  sortBy: "updated_at",
  sortOrder: "desc"
};
