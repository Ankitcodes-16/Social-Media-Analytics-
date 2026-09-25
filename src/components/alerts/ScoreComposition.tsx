import type { SignalEvaluation, SignalKey } from "@/types";

const SIGNAL_COLOR: Record<SignalKey, string> = {
  volume_growth: "#4fd1c5",
  sustained_growth: "#38bdf8",
  cross_platform: "#a78bfa",
  sentiment_shift: "#fb7185",
  community_spread: "#fbbf24",
  engagement: "#34d399",
};

/** Shows how each signal contributed to the composite score (weight × strength). */
export function ScoreComposition({ signals, score }: { signals: SignalEvaluation[]; score: number }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs text-fg-muted">Alert score</span>
        <span className="text-lg font-semibold tabular-nums text-fg">{Math.round(score * 100)}/100</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-700">
        {signals.map((s) => (
          <div
            key={s.key}
            title={`${s.label}: +${(s.weight * s.score * 100).toFixed(1)}`}
            style={{ width: `${s.weight * s.score * 100}%`, backgroundColor: SIGNAL_COLOR[s.key] }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {signals.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex min-w-0 items-center gap-2 text-fg-muted">
              <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: SIGNAL_COLOR[s.key], opacity: s.score > 0 ? 1 : 0.3 }} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="tabular-nums text-fg">+{(s.weight * s.score * 100).toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
