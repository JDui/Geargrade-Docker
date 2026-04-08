export type DeviceCategory =
  | "camera_body"
  | "lens"
  | "action_camera"
  | "drone"
  | "accessory"
  | "other";

export type DeviceStatus = "holding" | "for_sale" | "sold" | "broken";
export type RatingLabel = "god" | "excellent" | "average" | "low";
export type ImageSourceType = "upload" | "cached_remote";
export type MountSystemKey =
  | "none"
  | "fe"
  | "e"
  | "ef"
  | "ef_s"
  | "z"
  | "rf"
  | "x"
  | "gfx"
  | "l"
  | "m43"
  | "m42"
  | "other";
export type SortBy =
  | "name"
  | "category"
  | "status"
  | "purchase_date"
  | "sale_date"
  | "purchase_price"
  | "sale_price"
  | "score"
  | "updated_at"
  | "created_at";
export type SortOrder = "asc" | "desc";
export type ViewMode = "cards" | "table";
export type ThemeMode = "dark" | "light";
export type LeaderboardTab = "holding-duration" | "score" | "finance";

export interface DeviceListItem {
  id: number;
  name: string;
  brand: string;
  category: DeviceCategory;
  mount_system_key: MountSystemKey | null;
  mount_system_custom: string | null;
  mount_system_label: string | null;
  status: DeviceStatus;
  score: number;
  rating_label: RatingLabel | null;
  acquisition_iteration: number;
  tags: string[];
  purchase_price: number | null;
  sale_price: number | null;
  purchase_date: string | null;
  sale_date: string | null;
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
  mount_system_key: MountSystemKey | null;
  mount_system_custom: string | null;
  status: DeviceStatus;
  score: number;
  acquisition_iteration: number;
  pros: string[];
  cons: string[];
  review_detail: string;
  tags: string[];
  purchase_price: number | null;
  sale_price: number | null;
  purchase_date: string | null;
  sale_date: string | null;
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
  feeling_in_progress_count: number;
  ratings: DashboardBucket<RatingLabel>[];
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
  rating: RatingLabel | "";
  feelingOnly: boolean;
  purchaseYear: string;
  sortBy: SortBy;
  sortOrder: SortOrder;
}

export interface LeaderboardBaseItem {
  rank: number;
  device_id: number;
  name: string;
  brand: string;
  score: number;
  rating_label: RatingLabel | null;
}

export interface HoldingDurationItem extends LeaderboardBaseItem {
  duration_days: number;
  purchase_date: string | null;
  sale_date: string | null;
}

export interface ScoreLeaderboardItem extends LeaderboardBaseItem {}

export interface FinanceLeaderboardItem extends LeaderboardBaseItem {
  profit_value: number;
  purchase_price: number | null;
  sale_price: number | null;
}

export interface HoldingDurationResponse {
  items: HoldingDurationItem[];
}

export interface ScoreLeaderboardResponse {
  items: ScoreLeaderboardItem[];
}

export interface FinanceLeaderboardResponse {
  items: FinanceLeaderboardItem[];
}

export interface DataExportResponse {
  items: DevicePayload[];
}

export interface DataImportError {
  index: number;
  name: string | null;
  reason: string;
}

export interface DataImportResponse {
  total: number;
  created: number;
  skipped: number;
  errors: DataImportError[];
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
  broken: "已损坏"
};

export const RATING_LABELS: Record<RatingLabel, string> = {
  god: "神",
  excellent: "极佳",
  average: "中规中矩",
  low: "低"
};

export const MOUNT_SYSTEM_LABELS: Record<MountSystemKey, string> = {
  none: "无",
  fe: "FE",
  e: "E",
  ef: "EF",
  ef_s: "EF-S",
  z: "Z",
  rf: "RF",
  x: "X",
  gfx: "GFX",
  l: "L",
  m43: "M43",
  m42: "M42",
  other: "其他（可输入）"
};

export const DEFAULT_FILTERS: DeviceFilters = {
  search: "",
  category: "",
  status: "",
  rating: "",
  feelingOnly: false,
  purchaseYear: "",
  sortBy: "purchase_date",
  sortOrder: "desc"
};
