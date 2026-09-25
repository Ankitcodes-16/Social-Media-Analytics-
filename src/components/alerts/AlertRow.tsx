import Link from "next/link";
import type { Alert } from "@/types";
import { formatNumber, timeAgo } from "@/lib/format";
import { AlertStatusBadge, PlatformBadge, SeverityBadge } from "@/components/ui/Badge";

export function AlertRow({ alert, compact = false }: { alert: Alert; compact?: boolean }) {
  return (
    <Link
      href={`/alerts/${alert.id}`}
      className={`block rounded-lg border p-3.5 transition-colors hover:border-line-strong ${
        alert.status === "resolved" ? "border-line bg-ink-900/60" : "border-line bg-ink-900"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={alert.severity} />
        <AlertStatusBadge status={alert.status} />
        <span className="font-mono text-[11px] text-fg-dim">{alert.id}</span>
        <span className="ml-auto text-xs text-fg-dim">{timeAgo(alert.createdAt)}</span>
      </div>
      <div className="mt-2 text-[14px] font-medium text-fg">{alert.topicName}</div>
      <p className={`mt-0.5 text-xs leading-relaxed text-fg-muted ${compact ? "line-clamp-2" : ""}`}>{alert.triggerReason}</p>
      {compact ? null : (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-fg-dim">
          <span className="flex items-center gap-1.5">
            {alert.platforms.map((p) => (
              <PlatformBadge key={p} platform={p} compact />
            ))}
          </span>
          <span>
            Confidence <span className="tabular-nums text-fg">{Math.round(alert.confidence * 100)}%</span>
          </span>
          <span>
            <span className="tabular-nums text-fg">{formatNumber(alert.mentionsPerHourAtAlert)}</span> mentions/h at alert →{" "}
            <span className="tabular-nums text-fg">{formatNumber(alert.mentionsPerHourNow)}</span> now
          </span>
        </div>
      )}
    </Link>
  );
}
