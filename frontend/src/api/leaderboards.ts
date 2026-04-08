import { apiGet } from "./client";
import type {
  FinanceLeaderboardResponse,
  HoldingDurationResponse,
  SortOrder,
  ScoreLeaderboardResponse
} from "../types/device";

export function fetchHoldingDurationLeaderboard(sortOrder: SortOrder): Promise<HoldingDurationResponse> {
  return apiGet<HoldingDurationResponse>(`/api/v1/leaderboards/holding-duration?sort_order=${sortOrder}`);
}

export function fetchScoreLeaderboard(sortOrder: SortOrder): Promise<ScoreLeaderboardResponse> {
  return apiGet<ScoreLeaderboardResponse>(`/api/v1/leaderboards/score?sort_order=${sortOrder}`);
}

export function fetchFinanceLeaderboard(sortOrder: SortOrder): Promise<FinanceLeaderboardResponse> {
  return apiGet<FinanceLeaderboardResponse>(`/api/v1/leaderboards/finance?sort_order=${sortOrder}`);
}
