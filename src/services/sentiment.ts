import type { SentimentReport } from "@/types";
import { querySentiment } from "@/data/mock/queries";
import { apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/sentiment — overall, timeline, by platform, by topic and recent changes. */
export async function getSentimentReport(): Promise<SentimentReport> {
  if (isApiBacked("sentiment")) return apiFetch<SentimentReport>("/api/sentiment");
  return mockCall(querySentiment);
}
