import { apiGet } from "./client";
import type { DashboardSummary } from "../types/device";

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/api/v1/dashboard/summary");
}
