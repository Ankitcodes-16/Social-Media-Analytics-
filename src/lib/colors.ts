import type { AlertSeverity, Platform, Sentiment } from "@/types";

/** Chart palette — kept in sync with tailwind.config.ts. */
export const COLORS = {
  x: "#e2e8f0",
  telegram: "#38bdf8",
  positive: "#34d399",
  neutral: "#94a3b8",
  negative: "#fb7185",
  signal: "#4fd1c5",
  warning: "#fbbf24",
  grid: "#1c2330",
  axis: "#667085",
  surface: "#0e1218",
} as const;

export const PLATFORM_COLORS: Record<Platform, string> = { x: COLORS.x, telegram: COLORS.telegram };
export const SENTIMENT_COLORS: Record<Sentiment, string> = {
  positive: COLORS.positive,
  neutral: COLORS.neutral,
  negative: COLORS.negative,
};
export const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  low: "#60a5fa",
  medium: "#fbbf24",
  high: "#fb923c",
  critical: "#f43f5e",
};

export const platformLabel = (p: Platform): string => (p === "x" ? "X" : "Telegram");
export const sentimentLabel = (s: Sentiment): string => s.charAt(0).toUpperCase() + s.slice(1);
