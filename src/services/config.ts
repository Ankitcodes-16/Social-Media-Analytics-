/**
 * Service configuration.
 *
 * Every data-access service can run against the simulated dataset (Phase 1) or
 * the FastAPI backend (Phase 2+). Switching is per service, so the backend can
 * be integrated progressively without touching any UI code:
 *
 *   NEXT_PUBLIC_API_SERVICES=posts,topics   → those two use the API, the rest stay simulated
 *   NEXT_PUBLIC_API_SERVICES=all            → everything uses the API
 */

export type ServiceName = "overview" | "topics" | "posts" | "sentiment" | "trends" | "alerts" | "network";

export const ALL_SERVICES: ServiceName[] = ["overview", "topics", "posts", "sentiment", "trends", "alerts", "network"];

// NB: Next.js only inlines NEXT_PUBLIC_* variables when they are referenced literally.
const RAW_API_SERVICES = process.env.NEXT_PUBLIC_API_SERVICES ?? "";
const API_SERVICES = new Set(
  RAW_API_SERVICES.split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
);

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");

export const MOCK_LATENCY_MS = Number.parseInt(process.env.NEXT_PUBLIC_MOCK_LATENCY_MS ?? "220", 10) || 0;

export const isApiBacked = (service: ServiceName): boolean => API_SERVICES.has("all") || API_SERVICES.has(service);

export type DataMode = "simulated" | "live" | "mixed";

export function getDataMode(): DataMode {
  const apiCount = ALL_SERVICES.filter(isApiBacked).length;
  if (apiCount === 0) return "simulated";
  return apiCount === ALL_SERVICES.length ? "live" : "mixed";
}
