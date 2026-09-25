import type { Alert, AlertDetail, AlertQuery, AlertStatusUpdate } from "@/types";
import { mutateAlertStatus, queryAlert, queryAlerts } from "@/data/mock/queries";
import { ApiError, apiFetch } from "./http";
import { isApiBacked } from "./config";
import { mockCall } from "./mock";

/** Fired on `window` after an alert changes, so unrelated views (e.g. the sidebar badge) can refresh. */
export const ALERTS_CHANGED_EVENT = "trendsphere:alerts-changed";

/** GET /api/alerts?status=&severity= */
export async function getAlerts(query: AlertQuery = {}): Promise<Alert[]> {
  if (isApiBacked("alerts")) return apiFetch<Alert[]>("/api/alerts", { query: { ...query } });
  return mockCall(() => queryAlerts(query));
}

/** GET /api/alerts/{id} — resolves to null when the alert does not exist. */
export async function getAlert(id: string): Promise<AlertDetail | null> {
  if (isApiBacked("alerts")) {
    try {
      return await apiFetch<AlertDetail>(`/api/alerts/${encodeURIComponent(id)}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
  return mockCall(() => queryAlert(id));
}

/**
 * PATCH /api/alerts/{id}  { status, note? }
 * In simulated mode the change lives in memory for the current session only.
 */
export async function updateAlertStatus(id: string, update: AlertStatusUpdate): Promise<Alert> {
  const result = isApiBacked("alerts")
    ? await apiFetch<Alert>(`/api/alerts/${encodeURIComponent(id)}`, { method: "PATCH", body: update })
    : await mockCall(() => mutateAlertStatus(id, update));
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ALERTS_CHANGED_EVENT));
  return result;
}
