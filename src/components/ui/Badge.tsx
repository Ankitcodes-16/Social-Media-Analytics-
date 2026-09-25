import type { ReactNode } from "react";
import { Circle, FlaskConical, Send, TrendingDown } from "lucide-react";
import type { AlertSeverity, AlertStatus, ImplementationStatus, Platform, Sentiment, TrendStatus } from "@/types";

export type Tone = "neutral" | "signal" | "positive" | "negative" | "warning" | "info" | "orange" | "critical";

const TONES: Record<Tone, string> = {
  neutral: "border-line-strong bg-ink-800 text-fg-muted",
  signal: "border-signal/30 bg-signal/10 text-signal",
  positive: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  negative: "border-rose-400/30 bg-rose-400/10 text-rose-300",
  warning: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  info: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  orange: "border-orange-400/30 bg-orange-400/10 text-orange-300",
  critical: "border-rose-500/40 bg-rose-500/15 text-rose-300",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
  title,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 text-[11px] font-medium leading-4 ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PlatformBadge({ platform, compact = false }: { platform: Platform; compact?: boolean }) {
  if (platform === "x") {
    return (
      <span
        title="X"
        className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-slate-400/30 bg-slate-200/10 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-slate-100"
      >
        <span className="text-[10px] font-bold leading-none">𝕏</span>
        {compact ? null : "X"}
      </span>
    );
  }
  return (
    <span
      title="Telegram"
      className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-sky-400/30 bg-sky-400/10 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-sky-300"
    >
      <Send size={10} />
      {compact ? null : "Telegram"}
    </span>
  );
}

const SENTIMENT_TONE: Record<Sentiment, Tone> = { positive: "positive", neutral: "neutral", negative: "negative" };

export function SentimentBadge({ sentiment, score }: { sentiment: Sentiment; score?: number }) {
  return (
    <Badge tone={SENTIMENT_TONE[sentiment]} title={score !== undefined ? `Sentiment score ${score.toFixed(2)}` : undefined}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </Badge>
  );
}

const SEVERITY_TONE: Record<AlertSeverity, Tone> = { low: "info", medium: "warning", high: "orange", critical: "critical" };

export function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{severity.charAt(0).toUpperCase() + severity.slice(1)}</Badge>;
}

const ALERT_STATUS: Record<AlertStatus, { tone: Tone; label: string }> = {
  new: { tone: "signal", label: "New" },
  investigating: { tone: "info", label: "Investigating" },
  resolved: { tone: "positive", label: "Resolved" },
};

export function AlertStatusBadge({ status }: { status: AlertStatus }) {
  const s = ALERT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function TrendStatusBadge({ status }: { status: TrendStatus }) {
  switch (status) {
    case "emerging":
      return (
        <Badge tone="signal">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-signal" />
          </span>
          Emerging
        </Badge>
      );
    case "rising":
      return <Badge tone="warning">Rising</Badge>;
    case "declining":
      return (
        <Badge tone="neutral">
          <TrendingDown size={10} />
          Declining
        </Badge>
      );
    default:
      return (
        <Badge tone="neutral">
          <Circle size={7} />
          Stable
        </Badge>
      );
  }
}

const IMPLEMENTATION: Record<ImplementationStatus, { tone: Tone; label: string; hint: string }> = {
  implemented: { tone: "positive", label: "Implemented", hint: "Working in this build" },
  simulated: { tone: "warning", label: "Simulated", hint: "Works, but on synthetic data or in-memory state" },
  future: { tone: "neutral", label: "Future integration", hint: "Planned for a later phase — not built yet" },
};

export function ImplementationBadge({ status }: { status: ImplementationStatus }) {
  const s = IMPLEMENTATION[status];
  return (
    <Badge tone={s.tone} title={s.hint}>
      {status === "simulated" ? <FlaskConical size={10} /> : null}
      {s.label}
    </Badge>
  );
}
