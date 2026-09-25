import type { TrendStatus } from "@/types";

export const STATUS_COLOR: Record<TrendStatus, string> = {
  emerging: "#4fd1c5",
  rising: "#fbbf24",
  stable: "#667085",
  declining: "#667085",
};

export const GROWTH_TEXT: Record<TrendStatus, string> = {
  emerging: "text-signal",
  rising: "text-amber-300",
  stable: "text-fg-muted",
  declining: "text-fg-dim",
};
