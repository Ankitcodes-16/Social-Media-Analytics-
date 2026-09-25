import type { NetworkGraph, NetworkQuery } from "@/types";
import { queryNetwork } from "@/data/mock/queries";
import { apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** GET /api/network?topicId= — nodes, edges, communities and propagation paths. */
export async function getNetwork(query: NetworkQuery = {}): Promise<NetworkGraph> {
  if (isApiBacked("network")) return apiFetch<NetworkGraph>("/api/network", { query: { ...query } });
  return mockCall(() => queryNetwork(query));
}
