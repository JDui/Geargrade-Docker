import { CATEGORY_LABELS, DEFAULT_FILTERS, RATING_LABELS, STATUS_LABELS, type DeviceFilters } from "../types/device";

export function readDeviceFilters(params: URLSearchParams): DeviceFilters {
  const category = params.get("category") || "";
  const status = params.get("status") || "";
  const rating = params.get("rating_label") || "";
  const sortBy = params.get("sort_by") || "";
  const sorts = ["name", "category", "status", "score", "purchase_price", "sale_price", "purchase_date", "sale_date", "created_at", "updated_at"];
  return {
    ...DEFAULT_FILTERS,
    search: params.get("search") || "",
    category: Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category) ? category as DeviceFilters["category"] : "",
    status: Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? status as DeviceFilters["status"] : "",
    rating: Object.prototype.hasOwnProperty.call(RATING_LABELS, rating) ? rating as DeviceFilters["rating"] : "",
    feelingOnly: params.get("feeling_only") === "true",
    purchaseYear: /^\d{4}$/.test(params.get("purchase_year") || "") ? params.get("purchase_year")! : "",
    sortBy: sorts.includes(sortBy) ? sortBy as DeviceFilters["sortBy"] : DEFAULT_FILTERS.sortBy,
    sortOrder: params.get("sort_order") === "asc" ? "asc" : "desc"
  };
}
