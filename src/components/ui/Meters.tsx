import type { SentimentSummary } from "@/types";
import { SENTIMENT_COLORS } from "@/lib/colors";

/** Stacked positive / neutral / negative bar. */
export function SentimentBar({ summary, className = "" }: { summary: SentimentSummary; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`${summary.positivePct}% positive, ${summary.neutralPct}% neutral, ${summary.negativePct}% negative`}
      className={`flex h-1.5 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}
    >
      <div style={{ width: `${summary.positivePct}%`, backgroundColor: SENTIMENT_COLORS.positive }} />
      <div style={{ width: `${summary.neutralPct}%`, backgroundColor: SENTIMENT_COLORS.neutral, opacity: 0.55 }} />
      <div style={{ width: `${summary.negativePct}%`, backgroundColor: SENTIMENT_COLORS.negative }} />
    </div>
  );
}

export function ProgressBar({ value, color = "#4fd1c5", className = "" }: { value: number; color?: string; className?: string }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink-700 ${className}`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

export function confidenceLabel(value: number): { label: string; color: string } {
  if (value >= 0.75) return { label: "High", color: "#34d399" };
  if (value >= 0.5) return { label: "Medium", color: "#fbbf24" };
  return { label: "Low", color: "#fb923c" };
}

export function ConfidenceMeter({ value, className = "" }: { value: number; className?: string }) {
  const c = confidenceLabel(value);
  return (
    <div className={className}>
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="font-medium" style={{ color: c.color }}>
          {c.label}
        </span>
        <span className="tabular-nums text-fg-muted">{Math.round(value * 100)}%</span>
      </div>
      <ProgressBar value={value} color={c.color} />
    </div>
  );
}

/** Circular 0–100 score. */
export function ScoreRing({ score, size = 56, label }: { score: number; size?: number; label?: string }) {
  const stroke = 4;
  const r = (size - stroke * 2) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * c;
  const color = score >= 60 ? "#4fd1c5" : score >= 40 ? "#fbbf24" : "#667085";
  return (
    <div className="inline-flex flex-col items-center gap-1" title={label ? `${label}: ${score}/100` : `${score}/100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? "Score"} ${score} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1c2330" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#e6e9ef"
          fontSize={size * 0.32}
          fontWeight={600}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {score}
        </text>
      </svg>
      {label ? <span className="eyebrow">{label}</span> : null}
    </div>
  );
}
