import type { TrendDetail, TrendQuery, TrendSummary } from "@/types";
import { queryTrend, queryTrends } from "@/data/mock/queries";
import { ApiError, apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/trends?status=&platform=&sort= */
export async function getTrends(query: TrendQuery = {}): Promise<TrendSummary[]> {
  if (isApiBacked("trends")) return apiFetch<TrendSummary[]>("/api/trends", { query: { ...query } });
  return mockCall(() => queryTrends(query));
}

/** GET /api/trends/{id} — resolves to null when the trend does not exist. */
export async function getTrend(id: string): Promise<TrendDetail | null> {
  if (isApiBacked("trends")) {
    try {
      return await apiFetch<TrendDetail>(`/api/trends/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
  return mockCall(() => queryTrend(id));
}
