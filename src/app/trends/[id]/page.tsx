"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Bell, Database, Network } from "lucide-react";
import type { Paginated, SocialPost, TrendDetail } from "@/types";
import { getPosts, getTrend } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { formatCompact, formatDateTime, formatNumber, formatSigned, formatSignedPct, formatTime, timeAgo } from "@/lib/format";
import { sentimentLabel } from "@/lib/colors";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, LoadingState, Skeleton } from "@/components/ui/States";
import { Badge, ImplementationBadge, PlatformBadge, SentimentBadge, TrendStatusBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Controls";
import { ConfidenceMeter, ProgressBar } from "@/components/ui/Meters";
import { StatTile } from "@/components/ui/Stat";
import { MentionTimeline } from "@/components/charts/MentionTimeline";
import { SentimentTimeline } from "@/components/charts/SentimentTimeline";
import { PlatformComparisonChart } from "@/components/charts/PlatformComparisonChart";
import { SignalList } from "@/components/trends/SignalList";
import { MilestoneTimeline } from "@/components/trends/MilestoneTimeline";
import { PostCard } from "@/components/explorer/PostCard";
import { GROWTH_TEXT } from "@/components/trends/trendStyle";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <LoadingState className="h-96 lg:col-span-7" label="Loading trend" />
        <LoadingState className="h-96 lg:col-span-5" label="Loading signals" />
      </div>
    </div>
  );
}

function RelatedPosts({ trend, posts }: { trend: TrendDetail; posts: Paginated<SocialPost> | null | undefined }) {
  const router = useRouter();
  if (!posts) return <LoadingState label="Loading posts" className="h-48 border-0 p-0" />;
  if (posts.items.length === 0) {
    return <EmptyState title="No indexed posts" description="No posts about this topic are in the explorer sample." />;
  }
  return (
    <div className="space-y-2.5">
      {posts.items.map((p) => (
        <PostCard
          key={p.id}
          post={p}
          showTopic={false}
          onSelect={(post) => router.push(`/explorer?topic=${trend.topicId}&sort=engagement&post=${post.id}`)}
        />
      ))}
      <div className="pt-1 text-right">
        <Link href={`/explorer?topic=${trend.topicId}&sort=engagement`} className="text-xs font-medium text-signal hover:underline">
          See all {posts.total} indexed posts in the Data Explorer →
        </Link>
      </div>
    </div>
  );
}

function Detail({ trend, posts }: { trend: TrendDetail; posts: Paginated<SocialPost> | null | undefined }) {
  const active = trend.status === "emerging" || trend.status === "rising";
  return (
    <>
      <PageHeader
        back={{ href: "/trends", label: "All trends" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {trend.name}
            <TrendStatusBadge status={trend.status} />
          </span>
        }
        description={trend.description}
        meta={
          <>
            <span>{trend.category}</span>
            <span>
              {trend.firstDetectedAt
                ? `First detected ${formatDateTime(trend.firstDetectedAt)} (${timeAgo(trend.firstDetectedAt)})`
                : "Not flagged as a trend"}
            </span>
            <span>Baseline {trend.baseline} mentions/hour</span>
          </>
        }
        actions={
          <>
            {trend.alertIds.map((id) => (
              <LinkButton key={id} href={`/alerts/${id}`} variant="primary">
                <Bell size={13} />
                Alert {id}
              </LinkButton>
            ))}
            <LinkButton href={`/network?topic=${trend.topicId}`}>
              <Network size={13} />
              View network
            </LinkButton>
            <LinkButton href={`/explorer?topic=${trend.topicId}&sort=engagement`}>
              <Database size={13} />
              Posts
            </LinkButton>
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatTile
            label="Mentions / hour"
            value={formatNumber(trend.mentionsPerHour)}
            sub={`${formatCompact(trend.mentions24h)} in 24h`}
          />
          <StatTile
            label="Growth (6h)"
            value={<span className={GROWTH_TEXT[trend.status]}>{formatSignedPct(trend.growthRate)}</span>}
            sub="vs 6 hours earlier"
            highlight={trend.status === "emerging"}
          />
          <StatTile label="Velocity" value={`${formatSigned(trend.velocity, 0)}/h`} sub="mentions/h gained each hour" />
          <StatTile
            label="Negative share"
            value={`${trend.sentiment.negativePct.toFixed(0)}%`}
            sub={`Net sentiment ${formatSigned(trend.sentiment.netScore, 1)}`}
          />
          <StatTile
            label="Trend score"
            value={`${trend.trendScore}/100`}
            sub={active ? `Confidence ${Math.round(trend.confidence * 100)}%` : "Not an active trend"}
            highlight={trend.trendScore >= 60}
          />
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader title="Mention volume" subtitle="Mentions per hour by platform, last 24 hours" />
            <CardBody>
              <MentionTimeline data={trend.timeline} baseline={trend.baseline} milestones={trend.milestones} />
            </CardBody>
          </Card>
          <Card className="lg:col-span-5">
            <CardHeader
              title="Why is this trending?"
              subtitle="Six explainable signals combine into the trend score"
              action={<ImplementationBadge status="simulated" />}
            />
            <CardBody>
              <SignalList signals={trend.signals} />
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-6">
            <CardHeader title="Sentiment over time" subtitle="Share of negative, neutral and positive posts by hour" />
            <CardBody>
              <SentimentTimeline data={trend.sentimentTimeline} height={256} />
            </CardBody>
          </Card>
          <Card className="lg:col-span-6">
            <CardHeader title="Platform comparison" subtitle="How the topic behaves on X versus Telegram" />
            <CardBody>
              <PlatformComparisonChart data={trend.platformComparison} />
              <div className="mt-3 grid grid-cols-2 gap-3">
                {trend.platformComparison.map((p) => (
                  <div key={p.platform} className="rounded-md border border-line bg-ink-850/60 p-3">
                    <PlatformBadge platform={p.platform} />
                    <dl className="mt-2 space-y-1 text-xs">
                      <div className="flex justify-between">
                        <dt className="text-fg-dim">Mentions (24h)</dt>
                        <dd className="tabular-nums text-fg">{formatNumber(p.mentions24h)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-fg-dim">Avg engagement</dt>
                        <dd className="tabular-nums text-fg">{formatNumber(p.avgEngagement)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-fg-dim">Substantial since</dt>
                        <dd className="tabular-nums text-fg">{p.firstSeenAt ? `${formatTime(p.firstSeenAt)} UTC` : "—"}</dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-4">
            <CardHeader title="How it developed" subtitle="Key moments, oldest first" />
            <CardBody>
              <MilestoneTimeline milestones={trend.milestones} />
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Related keywords" subtitle="Terms most associated with the topic" />
            <CardBody>
              <ul className="space-y-3">
                {trend.relatedKeywords.map((k) => (
                  <li key={k.term}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2 text-fg">
                        {k.term}
                        {k.isNew ? <Badge tone="signal">new</Badge> : null}
                      </span>
                      <span className="tabular-nums text-fg-dim">{formatNumber(k.mentions)}</span>
                    </div>
                    <ProgressBar value={k.weight} color={k.isNew ? "#4fd1c5" : "#475467"} className="mt-1.5" />
                    {k.firstSeenAt ? (
                      <div className="mt-1 text-[11px] text-fg-dim">First seen {formatTime(k.firstSeenAt)} UTC</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader
              title="Communities involved"
              subtitle="Where the conversation is happening"
              action={
                <Link href={`/network?topic=${trend.topicId}`} className="text-xs font-medium text-signal hover:underline">
                  Open network →
                </Link>
              }
            />
            <CardBody>
              {trend.communities.length === 0 ? (
                <EmptyState title="No community data" description="No indexed posts yet." className="py-8" />
              ) : (
                <ul className="space-y-3.5">
                  {trend.communities.map((c) => (
                    <li key={c.id}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 text-[13px] text-fg">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                          <span className="truncate">{c.name}</span>
                        </span>
                        <span className="text-xs tabular-nums text-fg-dim">{c.sharePct.toFixed(0)}%</span>
                      </div>
                      <ProgressBar value={c.sharePct / 100} color={c.color} className="mt-1.5" />
                      <div className="mt-1 flex items-center justify-between text-[11px] text-fg-dim">
                        <span>
                          {c.postCount} posts · joined {formatTime(c.joinedAt)} UTC
                        </span>
                        <span>Mostly {sentimentLabel(c.dominantSentiment).toLowerCase()}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-8">
            <CardHeader title="Related posts" subtitle="Highest-engagement posts about this topic" />
            <CardBody>
              <RelatedPosts trend={trend} posts={posts} />
            </CardBody>
          </Card>

          <Card className="lg:col-span-4">
            <CardHeader title="Confidence & evidence" subtitle="What the score is based on" />
            <CardBody>
              <ConfidenceMeter value={trend.confidence} />
              <ul className="mt-4 space-y-2.5">
                {trend.evidence.map((line, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-fg-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-fg-dim" />
                    {line}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 text-[11px] leading-relaxed text-fg-dim">
                Simulated scoring: these six signals run on the demo dataset. In Phase 4 the same definitions are computed from ingested X and
                Telegram data.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}

export default function TrendDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const trend = useAsync(() => getTrend(id), [id]);
  const topicId = trend.data?.topicId;
  const posts = useAsync(
    () => (topicId ? getPosts({ topicId, sort: "engagement", pageSize: 5 }) : Promise.resolve(null)),
    [topicId],
  );

  return (
    <AsyncBoundary
      state={trend}
      loading={<PageSkeleton />}
      errorTitle="Couldn't load this trend"
      isEmpty={(d) => d === null}
      empty={
        <EmptyState
          title="Trend not found"
          description="This trend doesn't exist or is no longer tracked."
          action={<LinkButton href="/trends">Back to all trends</LinkButton>}
        />
      }
    >
      {(t) => (t ? <Detail trend={t} posts={posts.data} /> : null)}
    </AsyncBoundary>
  );
}
