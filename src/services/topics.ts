import type { Topic } from "@/types";
import { queryTopics } from "@/data/mock/queries";
import { apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/topics */
export async function getTopics(): Promise<Topic[]> {
  if (isApiBacked("topics")) return apiFetch<Topic[]>("/api/topics");
  return mockCall(queryTopics);
}
