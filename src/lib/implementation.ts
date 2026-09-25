import type { ImplementationStatus } from "@/types";

/**
 * Honest status of every part of the system. The UI shows this on the Overview
 * so nobody mistakes simulated data or planned components for working ones.
 */
export interface ImplementationItem {
  area: string;
  status: ImplementationStatus;
  detail: string;
  phase: string;
}

export const IMPLEMENTATION_STATUS: ImplementationItem[] = [
  {
    area: "Dashboard UI",
    status: "implemented",
    detail: "Overview, Trends, Sentiment, Network, Alerts and Data Explorer with loading, error and empty states.",
    phase: "Phase 1",
  },
  {
    area: "Service / data-access layer",
    status: "implemented",
    detail: "Typed services per domain; each can switch from simulated data to the REST API independently.",
    phase: "Phase 1",
  },
  {
    area: "Data & scoring",
    status: "simulated",
    detail: "One coherent synthetic dataset with anonymised demo identities. Detection signals run on it, but not on real data.",
    phase: "Phase 1",
  },
  {
    area: "Alert workflow",
    status: "simulated",
    detail: "Status changes work in the UI but are kept in memory for the session only.",
    phase: "Phase 1",
  },
  {
    area: "FastAPI backend & PostgreSQL",
    status: "future",
    detail: "REST endpoints, SQLAlchemy models and Pydantic schemas matching the frontend contracts.",
    phase: "Phase 2",
  },
  {
    area: "X & Telegram ingestion",
    status: "future",
    detail: "Source connectors and a normalisation pipeline; a simulated feed comes first.",
    phase: "Phase 3",
  },
  {
    area: "Sentiment, topics & trend detection",
    status: "future",
    detail: "Transformers sentiment, Sentence-Transformers + scikit-learn topic clustering, real signal scoring.",
    phase: "Phase 4",
  },
  {
    area: "Network analytics & alert engine",
    status: "future",
    detail: "Community detection, influence scoring and rule-based alerts computed from ingested data.",
    phase: "Phase 4",
  },
];
