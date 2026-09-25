import { CheckCircle2, Circle } from "lucide-react";
import type { SignalEvaluation } from "@/types";
import { ProgressBar } from "@/components/ui/Meters";

/**
 * Rule-by-rule explanation. Shows every signal — fired and not fired — so the
 * scoring is never a black box.
 */
export function SignalList({ signals, compact = false }: { signals: SignalEvaluation[]; compact?: boolean }) {
  const fired = signals.filter((s) => s.fired).length;
  return (
    <div>
      <div className="mb-3 text-xs text-fg-dim">
        <span className="font-medium text-fg">{fired}</span> of {signals.length} signals fired
      </div>
      <ul className="space-y-3">
        {signals.map((s) => (
          <li key={s.key} className={`rounded-md border p-3 ${s.fired ? "border-signal/25 bg-signal/[0.04]" : "border-line bg-ink-850/60"}`}>
            <div className="flex items-start gap-2.5">
              {s.fired ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-signal" />
              ) : (
                <Circle size={16} className="mt-0.5 shrink-0 text-fg-dim" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className={`text-[13px] font-medium ${s.fired ? "text-fg" : "text-fg-muted"}`}>{s.label}</span>
                  <span className="text-[11px] uppercase tracking-wider text-fg-dim">
                    {s.fired ? "Fired" : "Not fired"} · weight {Math.round(s.weight * 100)}%
                  </span>
                </div>
                <div className="mt-1 text-xs tabular-nums text-fg">{s.observed}</div>
                <div className="mt-0.5 text-[11px] text-fg-dim">Rule: {s.threshold}</div>
                {compact ? null : <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{s.explanation}</p>}
                <div className="mt-2 flex items-center gap-2">
                  <ProgressBar value={s.score} color={s.fired ? "#4fd1c5" : "#3a4558"} className="max-w-[10rem]" />
                  <span className="text-[11px] tabular-nums text-fg-dim">strength {Math.round(s.score * 100)}%</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
