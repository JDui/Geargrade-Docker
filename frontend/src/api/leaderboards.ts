import { apiGet } from "./client";
import type {
  DeviceCategory,
  DurationUnit,
  FinanceLeaderboardResponse,
  HoldingDurationResponse,
  SortOrder,
  ScoreLeaderboardResponse
} from "../types/device";

function categoryParam(category: DeviceCategory | ""): string {
  return category ? `&category=${encodeURIComponent(category)}` : "";
}

export function fetchHoldingDurationLeaderboard(
  sortOrder: SortOrder,
  durationUnit: DurationUnit = "days",
  category: DeviceCategory | "" = ""
): Promise<HoldingDurationResponse> {
  return apiGet<HoldingDurationResponse>(
    `/api/v1/leaderboards/holding-duration?sort_order=${sortOrder}&duration_unit=${durationUnit}${categoryParam(category)}`
  );
}

export function fetchScoreLeaderboard(sortOrder: SortOrder, category: DeviceCategory | "" = ""): Promise<ScoreLeaderboardResponse> {
  return apiGet<ScoreLeaderboardResponse>(`/api/v1/leaderboards/score?sort_order=${sortOrder}${categoryParam(category)}`);
}

export function fetchFinanceLeaderboard(sortOrder: SortOrder, category: DeviceCategory | "" = ""): Promise<FinanceLeaderboardResponse> {
  return apiGet<FinanceLeaderboardResponse>(`/api/v1/leaderboards/finance?sort_order=${sortOrder}${categoryParam(category)}`);
}
