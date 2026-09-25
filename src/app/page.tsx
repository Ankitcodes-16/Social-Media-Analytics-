"use client";

import Link from "next/link";
import { Activity, Bell, Flame, Layers, TrendingUp } from "lucide-react";
import type { SentimentReport, TrendSummary } from "@/types";
import { getAlerts, getOverview, getSentimentReport, getTrends } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { formatCompact, formatDateTime, formatNumber, formatSigned, formatSignedPct, formatTime } from "@/lib/format";
import { COLORS } from "@/lib/colors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, LoadingState, Skeleton } from "@/components/ui/States";
import { ImplementationBadge, PlatformBadge } from "@/components/ui/Badge";
import { StatTile } from "@/components/ui/Stat";
import { BuildStatus } from "@/components/ui/BuildStatus";
import { ActivityChart } from "@/components/charts/ActivityChart";
import { SentimentDonut } from "@/components/charts/SentimentDonut";
import { TopTrendRow } from "@/components/trends/TrendRows";
import { AlertRow } from "@/components/alerts/AlertRow";

const CardLink = ({ href, children }: { href: string; children: string }) => (
  <Link href={href} className="text-xs font-medium text-signal hover:underline">
    {children}
  </Link>
);

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="rounded-lg border border-line bg-ink-900 p-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3 h-7 w-24" />
          <Skeleton className="mt-2 h-2.5 w-28" />
        </div>
      ))}
    </div>
  );
}

function SentimentSummaryCard({ report }: { report: SentimentReport }) {
  const rows = [
    { label: "Positive", pct: report.overall.positivePct, prev: report.previous.positivePct, color: COLORS.positive, goodWhenUp: true },
    { label: "Neutral", pct: report.overall.neutralPct, prev: report.previous.neutralPct, color: COLORS.neutral, goodWhenUp: true },
    { label: "Negative", pct: report.overall.negativePct, prev: report.previous.negativePct, color: COLORS.negative, goodWhenUp: false },
  ];
  return (
    <>
      <SentimentDonut summary={report.overall} size={168} />
      <ul className="mt-4 space-y-2">
        {rows.map((r) => {
          const delta = r.pct - r.prev;
          const bad = r.label === "Neutral" ? false : r.goodWhenUp ? delta < 0 : delta > 0;
          return (
            <li key={r.label} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 text-fg-muted">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: r.color, opacity: r.label === "Neutral" ? 0.6 : 1 }} />
                {r.label}
              </span>
              <span className="flex items-center gap-3 tabular-nums">
                <span className="text-fg">{r.pct.toFixed(1)}%</span>
                <span className={`w-16 text-right ${Math.abs(delta) < 0.5 ? "text-fg-dim" : bad ? "text-rose-300" : "text-emerald-300"}`}>
                  {formatSigned(delta, 1)} pp
                </span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11px] text-fg-dim">Change is versus the previous 24 hours.</p>
    </>
  );
}

function VelocityList({ trends }: { trends: TrendSummary[] }) {
  const items = trends
    .filter((t) => t.mentionsPerHour >= 25)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 6);
  const max = Math.max(1, ...items.map((t) => Math.abs(t.velocity)));
  return (
    <ul className="space-y-3">
      {items.map((t) => {
        const up = t.velocity >= 0;
        return (
          <li key={t.id}>
            <Link href={`/trends/${t.id}`} className="block">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-fg-muted hover:text-fg">{t.name}</span>
                <span className={`tabular-nums ${up ? "text-fg" : "text-fg-dim"}`}>{formatSigned(t.velocity, 0)}/h</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-ink-700">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(Math.abs(t.velocity) / max) * 100}%`, backgroundColor: up ? (t.status === "emerging" ? COLORS.signal : "#fbbf24") : "#667085" }}
                />
              </div>
            </Link>
          </li>
        );
      })}
      <li className="pt-1 text-[11px] text-fg-dim">Mean hourly increase in mentions/hour over the last 3 hours.</li>
    </ul>
  );
}

export default function OverviewPage() {
  const overview = useAsync(() => getOverview(), []);
  const trends = useAsync(() => getTrends({ sort: "score" }), []);
  const alerts = useAsync(() => getAlerts({}), []);
  const sentiment = useAsync(() => getSentimentReport(), []);

  const o = overview.data;

  return (
    <>
      <PageHeader
        title="Overview"
        description="What is changing across X and Telegram right now, and what needs attention."
        meta={
          o ? (
            <>
              <span>
                Window: {formatDateTime(o.windowStart)} → {formatTime(o.windowEnd)} UTC
              </span>
              <span>Hourly buckets</span>
            </>
          ) : null
        }
      />

      <div className="space-y-4">
        <AsyncBoundary state={overview} loading={<KpiSkeleton />} errorTitle="Couldn't load the summary metrics">
          {(data) => {
            const k = data.kpis;
            const change = ((k.postsAnalyzed24h - k.postsAnalyzedPrev24h) / Math.max(1, k.postsAnalyzedPrev24h)) * 100;
            const last = data.activity[data.activity.length - 1];
            return (
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                <StatTile
                  label="Posts analysed · 24h"
                  value={formatNumber(k.postsAnalyzed24h)}
                  delta={{ value: `${formatSignedPct(change, 1)} vs prior 24h`, direction: change >= 0 ? "up" : "down", tone: "neutral" }}
                  icon={<Layers size={15} />}
                />
                <StatTile
                  label="Active topics"
                  value={k.activeTopics}
                  sub={`${k.emergingTrends} emerging · ${k.risingTrends} rising`}
                  icon={<Activity size={15} />}
                  href="/trends"
                />
                <StatTile
                  label="Emerging trends"
                  value={k.emergingTrends}
                  highlight={k.emergingTrends > 0}
                  sub={
                    k.fastestTrend
                      ? `${k.fastestTrend.name} ${formatSignedPct(k.fastestTrend.growthRate)} in 6h`
                      : "No emerging trend right now"
                  }
                  icon={<Flame size={15} />}
                  href={k.fastestTrend ? `/trends/${k.fastestTrend.trendId}` : "/trends"}
                />
                <StatTile
                  label="Active alerts"
                  value={k.activeAlerts}
                  sub={`${k.highSeverityAlerts} high severity`}
                  icon={<Bell size={15} />}
                  href="/alerts"
                />
                <StatTile
                  label="Posts / hour · latest"
                  value={formatNumber(last.total)}
                  sub={`X ${formatCompact(last.x)} · Telegram ${formatCompact(last.telegram)}`}
                  icon={<TrendingUp size={15} />}
                />
              </div>
            );
          }}
        </AsyncBoundary>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader title="Activity timeline" subtitle="Posts per hour across all monitored topics" />
            <CardBody>
              <AsyncBoundary state={overview} loading={<LoadingState label="Loading activity" className="h-80 border-0 p-0" />}>
                {(data) => <ActivityChart data={data.activity} emergingName={data.emergingTopicName} alertAt={data.alertMarkerAt} />}
              </AsyncBoundary>
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Top emerging topics" subtitle="Ranked by trend score" action={<CardLink href="/trends">All trends →</CardLink>} />
            <CardBody className="px-2">
              <AsyncBoundary
                state={trends}
                loading={<LoadingState label="Ranking topics" className="h-72 border-0" />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState title="No topics yet" description="Topics appear once posts have been analysed." />}
              >
                {(data) => (
                  <div>
                    {data.slice(0, 5).map((t, i) => (
                      <TopTrendRow key={t.id} trend={t} rank={i + 1} />
                    ))}
                  </div>
                )}
              </AsyncBoundary>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader title="Sentiment summary" subtitle="All topics, last 24 hours" action={<CardLink href="/sentiment">Details →</CardLink>} />
            <CardBody>
              <AsyncBoundary state={sentiment} loading={<LoadingState label="Loading sentiment" className="h-72 border-0 p-0" />}>
                {(report) => <SentimentSummaryCard report={report} />}
              </AsyncBoundary>
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Platform distribution" subtitle="Share of posts, last 24 hours" />
            <CardBody>
              <AsyncBoundary state={overview} loading={<LoadingState label="Loading platforms" className="h-72 border-0 p-0" />}>
                {(data) => (
                  <ul className="space-y-5">
                    {data.platformDistribution.map((p) => {
                      const src = data.sources.find((s) => s.platform === p.platform);
                      return (
                        <li key={p.platform}>
                          <div className="flex items-center justify-between">
                            <PlatformBadge platform={p.platform} />
                            <span className="text-lg font-semibold tabular-nums text-fg">{p.sharePct.toFixed(1)}%</span>
                          </div>
                          <div className="mt-2 h-1.5 rounded-full bg-ink-700">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${p.sharePct}%`, backgroundColor: p.platform === "x" ? COLORS.x : COLORS.telegram, opacity: p.platform === "x" ? 0.8 : 1 }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-between text-xs text-fg-dim">
                            <span className="tabular-nums">
                              {formatNumber(p.mentions)} posts{src ? ` · ${formatNumber(src.postsPerHour)}/h now` : ""}
                            </span>
                            {src ? <ImplementationBadge status={src.mode} /> : null}
                          </div>
                        </li>
                      );
                    })}
                    <li className="border-t border-line pt-3 text-[11px] text-fg-dim">
                      Feed status: connectors are not built yet, so both sources run on a simulated stream.
                    </li>
                  </ul>
                )}
              </AsyncBoundary>
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Trend velocity" subtitle="Which topics are accelerating fastest" />
            <CardBody>
              <AsyncBoundary state={trends} loading={<LoadingState label="Loading velocity" className="h-72 border-0 p-0" />}>
                {(data) => <VelocityList trends={[...data]} />}
              </AsyncBoundary>
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader title="Recent alerts" subtitle="Most recent first" action={<CardLink href="/alerts">All alerts →</CardLink>} />
            <CardBody>
              <AsyncBoundary
                state={alerts}
                loading={<LoadingState label="Loading alerts" className="h-64 border-0 p-0" />}
                isEmpty={(d) => d.length === 0}
                empty={<EmptyState title="No alerts" description="Alerts appear when several detection signals fire together." icon={<Bell size={22} />} />}
              >
                {(data) => (
                  <div className="space-y-2.5">
                    {data.slice(0, 3).map((a) => (
                      <AlertRow key={a.id} alert={a} compact />
                    ))}
                  </div>
                )}
              </AsyncBoundary>
            </CardBody>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader title="Build status" subtitle="What is implemented, simulated, or still to come" />
            <CardBody>
              <BuildStatus />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
