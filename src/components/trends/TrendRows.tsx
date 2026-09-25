"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { TrendSummary } from "@/types";
import { formatCompact, formatNumber, formatSigned, formatSignedPct, formatTime, timeAgo } from "@/lib/format";
import { TrendStatusBadge } from "@/components/ui/Badge";
import { ConfidenceMeter, ScoreRing, SentimentBar } from "@/components/ui/Meters";
import { Sparkline } from "@/components/charts/Sparkline";
import { GROWTH_TEXT, STATUS_COLOR } from "./trendStyle";

/** Compact ranked row used on the Overview. */
export function TopTrendRow({ trend, rank }: { trend: TrendSummary; rank: number }) {
  return (
    <Link
      href={`/trends/${trend.id}`}
      className="grid grid-cols-[1.25rem_minmax(0,1fr)_5.5rem] items-center gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-ink-800"
    >
      <span className="text-xs tabular-nums text-fg-dim">{rank}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span title={trend.name} className="truncate text-[13px] font-medium text-fg">{trend.name}</span>
          <TrendStatusBadge status={trend.status} />
        </div>
        <div className="mt-1 flex items-center gap-2.5 text-xs text-fg-dim">
          <span className="tabular-nums">{formatNumber(trend.mentionsPerHour)}/h</span>
          <span className={`font-medium tabular-nums ${GROWTH_TEXT[trend.status]}`}>{formatSignedPct(trend.growthRate)}</span>
          <span className="tabular-nums">{trend.sentiment.negativePct.toFixed(0)}% neg</span>
        </div>
      </div>
      <Sparkline values={trend.sparkline} color={STATUS_COLOR[trend.status]} height={30} />
    </Link>
  );
}

function Metric({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 text-[13px] text-fg">{children}</dd>
      {sub ? <div className="mt-0.5 text-[11px] text-fg-dim">{sub}</div> : null}
    </div>
  );
}

/** Full row used on the Trends page. */
export function TrendRow({ trend }: { trend: TrendSummary }) {
  const x = trend.platforms.find((p) => p.platform === "x")?.sharePct ?? 0;
  const tg = trend.platforms.find((p) => p.platform === "telegram")?.sharePct ?? 0;
  const showConfidence = trend.status === "emerging" || trend.status === "rising";
  return (
    <Link
      href={`/trends/${trend.id}`}
      className={`block rounded-lg border p-4 transition-colors hover:border-line-strong ${
        trend.status === "emerging" ? "border-signal/30 bg-signal/[0.03]" : "border-line bg-ink-900"
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-fg">{trend.name}</h3>
            <TrendStatusBadge status={trend.status} />
            <span className="text-xs text-fg-dim">{trend.category}</span>
          </div>
          <div className="mt-1 text-xs text-fg-dim">
            {trend.firstDetectedAt ? (
              <>
                Detected {formatTime(trend.firstDetectedAt)} UTC · {timeAgo(trend.firstDetectedAt)}
              </>
            ) : trend.status === "rising" ? (
              "Below the detection threshold (trend score 60)"
            ) : (
              "No detection signal"
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {trend.keywords.slice(0, 4).map((k) => (
              <span key={k} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px] text-fg-muted">
                {k}
              </span>
            ))}
          </div>
        </div>
        <div className="hidden w-44 shrink-0 self-center sm:block">
          <Sparkline values={trend.sparkline} color={STATUS_COLOR[trend.status]} height={44} />
          <div className="mt-0.5 text-center text-[10px] uppercase tracking-wider text-fg-dim">Last 12 hours</div>
        </div>
        <ScoreRing score={trend.trendScore} label="Score" />
      </div>

      <dl className="mt-3.5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3.5 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Mentions / hour" sub={`${formatCompact(trend.mentions24h)} in 24h`}>
          <span className="tabular-nums font-medium">{formatNumber(trend.mentionsPerHour)}</span>
        </Metric>
        <Metric label="Growth (6h)" sub="vs 6 hours earlier">
          <span className={`tabular-nums font-medium ${GROWTH_TEXT[trend.status]}`}>{formatSignedPct(trend.growthRate)}</span>
        </Metric>
        <Metric label="Velocity" sub="mentions/h per hour">
          <span className="tabular-nums font-medium">{formatSigned(trend.velocity, 0)}</span>
        </Metric>
        <Metric label="Sentiment" sub={`${trend.sentiment.negativePct.toFixed(0)}% negative`}>
          <SentimentBar summary={trend.sentiment} className="mt-2" />
        </Metric>
        <Metric label="Platforms" sub={`X ${x.toFixed(0)}% · Telegram ${tg.toFixed(0)}%`}>
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-ink-700">
            <div style={{ width: `${x}%`, backgroundColor: "#e2e8f0", opacity: 0.8 }} />
            <div style={{ width: `${tg}%`, backgroundColor: "#38bdf8" }} />
          </div>
        </Metric>
        <Metric label="Confidence">
          {showConfidence ? <ConfidenceMeter value={trend.confidence} /> : <span className="text-fg-dim">—</span>}
        </Metric>
      </dl>
    </Link>
  );
}
