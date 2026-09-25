"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Database, Network, TrendingUp } from "lucide-react";
import type { AlertDetail, AlertStatus } from "@/types";
import { getAlert, updateAlertStatus } from "@/services";
import { useAsync } from "@/hooks/useAsync";
import { formatDateTime, formatNumber, formatTime, timeAgo } from "@/lib/format";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AsyncBoundary } from "@/components/ui/AsyncBoundary";
import { EmptyState, LoadingState, Skeleton } from "@/components/ui/States";
import { AlertStatusBadge, Badge, ImplementationBadge, PlatformBadge, SeverityBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Controls";
import { ConfidenceMeter } from "@/components/ui/Meters";
import { MentionTimeline } from "@/components/charts/MentionTimeline";
import { SignalList } from "@/components/trends/SignalList";
import { ScoreComposition } from "@/components/alerts/ScoreComposition";
import { PostCard } from "@/components/explorer/PostCard";

function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-80" />
      <div className="grid gap-4 lg:grid-cols-12">
        <LoadingState className="h-[28rem] lg:col-span-8" label="Loading alert" />
        <LoadingState className="h-[28rem] lg:col-span-4" label="Loading details" />
      </div>
    </div>
  );
}

const TRANSITIONS: Record<AlertStatus, Array<{ to: AlertStatus; label: string; primary?: boolean }>> = {
  new: [
    { to: "investigating", label: "Start investigating", primary: true },
    { to: "resolved", label: "Resolve" },
  ],
  investigating: [
    { to: "resolved", label: "Resolve", primary: true },
    { to: "new", label: "Move back to new" },
  ],
  resolved: [{ to: "investigating", label: "Reopen", primary: true }],
};

function StatusPanel({ alert, onChanged }: { alert: AlertDetail; onChanged: () => void }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<AlertStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = async (to: AlertStatus): Promise<void> => {
    setBusy(to);
    setError(null);
    try {
      await updateAlertStatus(alert.id, { status: to, note: note.trim() || undefined });
      setNote("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The status could not be updated.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-fg-muted">Current status</span>
        <AlertStatusBadge status={alert.status} />
      </div>
      <label className="mt-3 block">
        <span className="eyebrow">Note (optional)</span>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
          placeholder="What did you find or decide?"
          className="mt-1.5 h-8 w-full rounded-md border border-line bg-ink-850 px-2.5 text-xs text-fg placeholder:text-fg-dim hover:border-line-strong focus:border-signal/50"
        />
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        {TRANSITIONS[alert.status].map((t) => (
          <Button key={t.to} variant={t.primary ? "primary" : "secondary"} disabled={busy !== null} onClick={() => void change(t.to)}>
            {busy === t.to ? "Saving…" : t.label}
          </Button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-fg-dim">
        Simulated persistence: the change is applied to the demo dataset in memory and resets when the page is reloaded.
      </p>
    </div>
  );
}

function Detail({ alert, reload }: { alert: AlertDetail; reload: () => void }) {
  const router = useRouter();
  const firedCount = alert.evidence.filter((s) => s.fired).length;
  const history = [...alert.history].reverse();

  return (
    <>
      <PageHeader
        back={{ href: "/alerts", label: "All alerts" }}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {alert.topicName}
            <SeverityBadge severity={alert.severity} />
            <AlertStatusBadge status={alert.status} />
          </span>
        }
        description={alert.triggerReason}
        meta={
          <>
            <span className="font-mono">{alert.id}</span>
            <span>
              Raised {formatDateTime(alert.createdAt)} ({timeAgo(alert.createdAt)})
            </span>
          </>
        }
        actions={
          <>
            <LinkButton href={`/trends/${alert.trendId}`}>
              <TrendingUp size={13} />
              View trend
            </LinkButton>
            <LinkButton href={`/network?topic=${alert.topicId}`}>
              <Network size={13} />
              View network
            </LinkButton>
            <LinkButton href={`/explorer?topic=${alert.topicId}&sort=engagement`}>
              <Database size={13} />
              Posts
            </LinkButton>
          </>
        }
      />

      <div className="space-y-4">
        <div className="grid items-start gap-4 lg:grid-cols-12">
          <Card className="border-signal/25 lg:col-span-8">
            <CardHeader
              title={<span className="text-xs font-semibold uppercase tracking-[0.12em] text-signal">Why was this alert generated?</span>}
              subtitle={`Evidence evaluated for the hour ending ${formatTime(new Date(Date.parse(alert.createdAt) - 5 * 60_000).toISOString())} UTC · rule: at least 3 of 6 signals must fire`}
              action={<ImplementationBadge status="simulated" />}
            />
            <CardBody>
              <p className="text-[13px] text-fg">
                <span className="font-semibold">
                  {firedCount} of {alert.evidence.length} signals fired.
                </span>{" "}
                Here is what the system observed:
              </p>
              <ul className="mt-3 space-y-2">
                {alert.whyBullets.map((line, i) => (
                  <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-fg-muted">
                    <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-signal" />
                    {line}
                  </li>
                ))}
              </ul>

              <div className="my-5 border-t border-line" />
              <ScoreComposition signals={alert.evidence} score={alert.score} />

              <div className="my-5 border-t border-line" />
              <h3 className="mb-3 text-xs font-medium text-fg-muted">Rule-by-rule evaluation</h3>
              <SignalList signals={alert.evidence} />
            </CardBody>
          </Card>

          <div className="space-y-4 lg:col-span-4">
            <Card>
              <CardHeader title="Update status" />
              <CardBody>
                <StatusPanel alert={alert} onChanged={reload} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Alert facts" />
              <CardBody>
                <ConfidenceMeter value={alert.confidence} />
                <dl className="mt-4 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-fg-dim">Platforms</dt>
                    <dd className="flex gap-1.5">
                      {alert.platforms.map((p) => (
                        <PlatformBadge key={p} platform={p} />
                      ))}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-fg-dim">Mentions/h at alert</dt>
                    <dd className="tabular-nums text-fg">{formatNumber(alert.mentionsPerHourAtAlert)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-fg-dim">Mentions/h now</dt>
                    <dd className="tabular-nums text-fg">{formatNumber(alert.mentionsPerHourNow)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-fg-dim">Trend</dt>
                    <dd>
                      <Link href={`/trends/${alert.trendId}`} className="text-signal hover:underline">
                        {alert.trend.name} ({alert.trend.trendScore}/100)
                      </Link>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-fg-dim">Last updated</dt>
                    <dd className="tabular-nums text-fg">{formatDateTime(alert.updatedAt)}</dd>
                  </div>
                </dl>
              </CardBody>
            </Card>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-12">
          <Card className="lg:col-span-7">
            <CardHeader title="Mention volume" subtitle="Supporting evidence: last 24 hours with the alert marked" />
            <CardBody>
              <MentionTimeline
                data={alert.timeline}
                milestones={[{ ts: alert.createdAt, kind: "alert", label: "Alert generated", detail: alert.id }]}
              />
            </CardBody>
          </Card>

          <Card className="lg:col-span-5">
            <CardHeader title="Status history" subtitle="Newest first" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-line pl-5">
                {history.map((h, i) => (
                  <li key={`${h.ts}-${i}`} className="relative">
                    <span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-fg-dim ring-4 ring-ink-900" />
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertStatusBadge status={h.status} />
                      <Badge>{h.actor === "system" ? "System" : "Analyst (demo)"}</Badge>
                      <span className="ml-auto text-[11px] tabular-nums text-fg-dim">{formatDateTime(h.ts)}</span>
                    </div>
                    <p className="mt-1 text-xs text-fg-muted">{h.note}</p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Supporting posts"
            subtitle="Highest-engagement posts about this topic in the six hours before the alert"
            action={
              <Link href={`/explorer?topic=${alert.topicId}&sort=engagement`} className="text-xs font-medium text-signal hover:underline">
                Open in Data Explorer →
              </Link>
            }
          />
          <CardBody>
            {alert.supportingPosts.length === 0 ? (
              <EmptyState title="No indexed posts" description="No posts from before the alert are in the explorer sample." />
            ) : (
              <div className="grid gap-2.5 lg:grid-cols-2">
                {alert.supportingPosts.map((p) => (
                  <PostCard
                    key={p.id}
                    post={p}
                    showTopic={false}
                    onSelect={(post) => router.push(`/explorer?topic=${alert.topicId}&sort=engagement&post=${post.id}`)}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}

export default function AlertDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const alert = useAsync(() => getAlert(id), [id]);

  return (
    <AsyncBoundary
      state={alert}
      loading={<PageSkeleton />}
      errorTitle="Couldn't load this alert"
      isEmpty={(a) => a === null}
      empty={
        <EmptyState
          title="Alert not found"
          description="This alert doesn't exist."
          action={<LinkButton href="/alerts">Back to all alerts</LinkButton>}
        />
      }
    >
      {(a) => (a ? <Detail alert={a} reload={alert.reload} /> : null)}
    </AsyncBoundary>
  );
}
