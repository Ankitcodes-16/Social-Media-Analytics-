"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react";
import type { SentimentChange, SentimentReport } from "@/types";
import { getSentimentReport } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { formatCompact, formatNumber, formatSigned } from "@/lib/format";
import { COLORS, platformLabel } from "@/lib/colors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { ListSkeleton, LoadingState, Skeleton } from "@/components/ui/States";
import { Badge, ImplementationBadge } from "@/components/ui/Badge";
import { Segmented } from "@/components/ui/Controls";
import { DeltaText, StatTile } from "@/components/ui/Stat";
import { SentimentDonut } from "@/components/charts/SentimentDonut";
import { SentimentTimeline, type SentimentTimelineMode } from "@/components/charts/SentimentTimeline";
import { ShareBars } from "@/components/charts/ShareBars";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <LoadingState className="h-80 lg:col-span-4" label="Loading sentiment" />
        <LoadingState className="h-80 lg:col-span-8" label="Loading timeline" />
      </div>
      <ListSkeleton rows={4} />
    </div>
  );
}

function ChangeRow({ change }: { change: SentimentChange }) {
  const worse = change.direction === "worsening";
  const better = change.direction === "improving";
  const Icon = worse ? ArrowDownRight : better ? ArrowUpRight : Minus;
  return (
    <tr className="border-t border-line">
      <td className="py-2.5 pr-3">
        <Link href={`/trends/${change.trendId}`} className="text-[13px] font-medium text-fg hover:text-signal">
          {change.topicName}
        </Link>
        <div className="text-[11px] text-fg-dim">{formatNumber(change.mentionsPerHour)} mentions/h</div>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-muted">
        {formatSigned(change.netBefore, 1)} → <span className="text-fg">{formatSigned(change.netNow, 1)}</span>
      </td>
      <td className="px-3 py-2.5 tabular-nums text-fg-muted">
        {change.negativePctBefore.toFixed(0)}% → <span className="text-fg">{change.negativePctNow.toFixed(0)}%</span>
      </td>
      <td className="px-3 py-2.5">
        <span className={`inline-flex items-center gap-1 tabular-nums ${worse ? "text-rose-300" : better ? "text-emerald-300" : "text-fg-dim"}`}>
          <Icon size={13} />
          {formatSigned(change.delta, 1)} pts
        </span>
      </td>
      <td className="py-2.5 pl-3 text-right">
        {change.significant ? (
          <Badge tone={worse ? "negative" : "positive"}>{worse ? "Significant drop" : "Significant gain"}</Badge>
        ) : (
          <span className="text-xs text-fg-dim">Within normal range</span>
        )}
      </td>
    </tr>
  );
}

function SentimentView({ report }: { report: SentimentReport }) {
  const [mode, setMode] = useState<SentimentTimelineMode>("share");
  const { overall, previous } = report;
  const tiles = [
    { label: "Positive", value: overall.positivePct, prev: previous.positivePct, color: COLORS.positive, goodWhenUp: true },
    { label: "Neutral", value: overall.neutralPct, prev: previous.neutralPct, color: COLORS.neutral, goodWhenUp: true },
    { label: "Negative", value: overall.negativePct, prev: previous.negativePct, color: COLORS.negative, goodWhenUp: false },
  ];
  const topicRows = [...report.byTopic]
    .sort((a, b) => b.summary.negativePct - a.summary.negativePct)
    .map((t) => ({ key: t.topicId, name: t.topicName, summary: t.summary }));
  const platformRows = report.byPlatform.map((p) => ({ key: p.platform, name: platformLabel(p.platform), summary: p.summary }));
  const alarming = report.changes.filter((c) => c.significant && c.direction === "worsening");
  const netDelta = overall.netScore - previous.netScore;

  return (
    <div className="space-y-4">
      {alarming.length > 0 ? (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-rose-400/25 bg-rose-400/[0.05] p-4">
          <TriangleAlert size={18} className="mt-0.5 shrink-0 text-rose-300" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium text-fg">
              {alarming.length === 1 ? "Sentiment is turning sharply negative on one topic" : `Sentiment is turning sharply negative on ${alarming.length} topics`}
            </p>
            <p className="mt-1 text-fg-muted">
              {alarming.map((c, i) => (
                <span key={c.topicId}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/trends/${c.trendId}`} className="text-fg hover:text-signal">
                    {c.topicName}
                  </Link>{" "}
                  negative share {c.negativePctBefore.toFixed(0)}% → {c.negativePctNow.toFixed(0)}% ({formatSigned(c.delta, 1)} net pts)
                </span>
              ))}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t) => {
          const d = t.value - t.prev;
          const bad = t.label === "Neutral" ? false : t.goodWhenUp ? d < 0 : d > 0;
          return (
            <StatTile
              key={t.label}
              label={t.label}
              value={<span style={{ color: t.color }}>{t.value.toFixed(1)}%</span>}
              delta={{
                value: `${formatSigned(d, 1)} pp`,
                direction: Math.abs(d) < 0.5 ? "flat" : d > 0 ? "up" : "down",
                tone: Math.abs(d) < 0.5 || t.label === "Neutral" ? "neutral" : bad ? "negative" : "positive",
              }}
              sub="vs previous 24h"
            />
          );
        })}
        <StatTile
          label="Net sentiment"
          value={formatSigned(overall.netScore, 1)}
          delta={{ value: `${formatSigned(netDelta, 1)} vs prev`, direction: Math.abs(netDelta) < 0.5 ? "flat" : netDelta > 0 ? "up" : "down", tone: Math.abs(netDelta) < 0.5 ? "neutral" : netDelta > 0 ? "positive" : "negative" }}
          sub={`${formatCompact(overall.total)} posts classified`}
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader title="Overall distribution" subtitle="All topics, last 24 hours" />
          <CardBody>
            <SentimentDonut summary={overall} size={200} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              {[
                { label: "Positive", n: overall.counts.positive, color: COLORS.positive },
                { label: "Neutral", n: overall.counts.neutral, color: COLORS.neutral },
                { label: "Negative", n: overall.counts.negative, color: COLORS.negative },
              ].map((r) => (
                <div key={r.label} className="rounded-md border border-line bg-ink-850/60 py-2">
                  <div className="tabular-nums font-medium" style={{ color: r.color }}>
                    {formatCompact(r.n)}
                  </div>
                  <div className="text-[11px] text-fg-dim">{r.label}</div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader
            title="Sentiment over time"
            subtitle="Hourly, all topics"
            action={
              <Segmented<SentimentTimelineMode>
                ariaLabel="Timeline mode"
                value={mode}
                onChange={setMode}
                options={[
                  { value: "share", label: "Share %" },
                  { value: "volume", label: "Volume" },
                ]}
              />
            }
          />
          <CardBody>
            <SentimentTimeline data={report.timeline} mode={mode} height={300} />
          </CardBody>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-12">
        <Card className="lg:col-span-5">
          <CardHeader title="By platform" subtitle="Sentiment share on X versus Telegram" />
          <CardBody>
            <ShareBars rows={platformRows} labelWidth={80} rowHeight={48} />
            <ul className="mt-3 space-y-1.5 border-t border-line pt-3 text-xs text-fg-muted">
              {report.byPlatform.map((p) => (
                <li key={p.platform} className="flex justify-between">
                  <span>{platformLabel(p.platform)}</span>
                  <span className="tabular-nums">
                    {formatCompact(p.summary.total)} posts · net {formatSigned(p.summary.netScore, 1)}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card className="lg:col-span-7">
          <CardHeader title="By topic" subtitle="Ordered by negative share" />
          <CardBody>
            <ShareBars rows={topicRows} labelWidth={165} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent sentiment changes"
          subtitle="Last 3 hours compared with the 3 hours ending 6 hours earlier · net = positive % − negative %"
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="eyebrow">
                  <th className="pb-2 pr-3 font-medium">Topic</th>
                  <th className="px-3 pb-2 font-medium">Net score</th>
                  <th className="px-3 pb-2 font-medium">Negative share</th>
                  <th className="px-3 pb-2 font-medium">Change</th>
                  <th className="pb-2 pl-3 text-right font-medium">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {report.changes.map((c) => (
                  <ChangeRow key={c.topicId} change={c} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-fg-dim">
            A change is flagged as significant when net sentiment moves by 15 points or more on a topic with at least 30 mentions per hour.
          </p>
        </CardBody>
      </Card>

      <p className="flex flex-wrap items-center gap-2 text-[11px] leading-relaxed text-fg-dim">
        <ImplementationBadge status="simulated" />
        Sentiment labels in this build are simulated. Phase 4 classifies posts with Hugging Face Transformers models.
      </p>
    </div>
  );
}

export default function SentimentPage() {
  const report = useAsync(() => getSentimentReport(), []);
  return (
    <>
      <PageHeader
        title="Sentiment"
        description="How people feel about what they are discussing — over time, across platforms and by topic."
        meta={<span>Last 24 hours · hourly · all times UTC</span>}
      />
      <AsyncBoundary state={report} loading={<PageSkeleton />} errorTitle="Couldn't load sentiment analytics">
        {(r) => <SentimentView report={r} />}
      </AsyncBoundary>
    </>
  );
}
