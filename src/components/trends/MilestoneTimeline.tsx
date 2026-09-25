import type { TrendMilestone } from "@/types";
import { formatDateTime, formatNumber } from "@/lib/format";

const DOT: Record<TrendMilestone["kind"], string> = {
  detected: "bg-signal",
  platform: "bg-sky-400",
  alert: "bg-orange-400",
  community: "bg-violet-400",
  current: "bg-fg",
};

/** Chronological story of how the trend developed. */
export function MilestoneTimeline({ milestones }: { milestones: TrendMilestone[] }) {
  return (
    <ol className="relative space-y-4 border-l border-line pl-5">
      {milestones.map((m) => (
        <li key={`${m.kind}-${m.ts}`} className="relative">
          <span className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-ink-900 ${DOT[m.kind]}`} />
          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[13px] font-medium text-fg">{m.label}</span>
            <span className="text-[11px] tabular-nums text-fg-dim">{formatDateTime(m.ts)}</span>
          </div>
          <p className="mt-0.5 text-xs text-fg-muted">{m.detail}</p>
          {m.mentionsPerHour !== undefined ? (
            <span className="mt-1 inline-block rounded bg-ink-800 px-1.5 py-0.5 text-[11px] tabular-nums text-fg-muted">
              {formatNumber(m.mentionsPerHour)} mentions/hour
            </span>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
