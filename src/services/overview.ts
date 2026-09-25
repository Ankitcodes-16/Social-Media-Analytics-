import type { OverviewSummary } from "@/types";
import { queryOverview } from "@/data/mock/queries";
import { apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/overview */
export async function getOverview(): Promise<OverviewSummary> {
  if (isApiBacked("overview")) return apiFetch<OverviewSummary>("/api/overview");
  return mockCall(queryOverview);
}
