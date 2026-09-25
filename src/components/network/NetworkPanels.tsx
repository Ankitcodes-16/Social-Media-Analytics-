"use client";

import { useMemo, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Database, Route, X } from "lucide-react";
import type { Community, EdgeType, NetworkEdge, NetworkGraph, NetworkNode, PropagationPath } from "@/types";
import { formatDuration, formatNumber, formatTime } from "@/lib/format";
import { platformLabel } from "@/lib/colors";
import { Badge, PlatformBadge } from "@/components/ui/Badge";
import { Button, LinkButton } from "@/components/ui/Controls";
import { ProgressBar, SentimentBar } from "@/components/ui/Meters";

const EDGE_LABEL: Record<EdgeType, string> = {
  retweet: "Retweet",
  reply: "Reply",
  mention: "Mention",
  forward: "Forward",
  cross_post: "Cross-post (X ↔ Telegram)",
};

const ROLE: Record<NetworkNode["role"], { label: string; tone: "signal" | "info" | "neutral"; hint: string }> = {
  hub: { label: "Hub", tone: "signal", hint: "Among the 8 most influential nodes in the graph" },
  bridge: { label: "Bridge", tone: "info", hint: "Connects to two or more other communities" },
  member: { label: "Member", tone: "neutral", hint: "Mostly connected inside its own community" },
};

function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="border-t border-line px-4 py-3.5 first:border-t-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="eyebrow">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-ink-850/60 px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wider text-fg-dim">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-fg">{value}</div>
    </div>
  );
}

/* ───────────────────────── Node ───────────────────────── */

export function NodePanel({
  node,
  graph,
  topicName,
  onSelectNode,
  onClose,
}: {
  node: NetworkNode;
  graph: NetworkGraph;
  topicName: (id: string) => string;
  onSelectNode: (id: string) => void;
  onClose: () => void;
}) {
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const community = graph.communities.find((c) => c.id === node.communityId);
  const links = useMemo(() => {
    const out: Array<{ edge: NetworkEdge; outgoing: boolean; other: NetworkNode }> = [];
    for (const edge of graph.edges) {
      if (edge.source !== node.id && edge.target !== node.id) continue;
      const outgoing = edge.source === node.id;
      const other = nodeById.get(outgoing ? edge.target : edge.source);
      if (other) out.push({ edge, outgoing, other });
    }
    return out.sort((a, b) => b.edge.weight - a.edge.weight);
  }, [graph, node.id, nodeById]);
  const role = ROLE[node.role];

  return (
    <div>
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <PlatformBadge platform={node.platform} />
            <Badge tone={role.tone} title={role.hint}>
              {role.label}
            </Badge>
          </div>
          <h2 className="mt-2 break-words text-[15px] font-semibold text-fg">{node.label}</h2>
          <div className="mt-0.5 text-xs text-fg-dim">
            {node.type === "channel" ? "Telegram channel" : "X account"} · synthetic demo identity
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded p-1 text-fg-dim hover:bg-ink-800 hover:text-fg">
          <X size={15} />
        </button>
      </div>

      {community ? (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-line bg-ink-850/60 px-2.5 py-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: community.color }} />
          <span className="text-fg-muted">Community</span>
          <span className="font-medium text-fg">{community.name}</span>
        </div>
      ) : null}

      <Section title="Metrics">
        <div className="mb-3">
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-fg-muted">Influence</span>
            <span className="tabular-nums text-fg">{(node.influence * 100).toFixed(0)} / 100</span>
          </div>
          <ProgressBar value={node.influence} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Connections" value={node.degree} />
          <Fact label="Reaches communities" value={node.communityReach} />
          <Fact label="Sends to" value={node.outDegree} />
          <Fact label="Receives from" value={node.inDegree} />
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-dim">
          Influence = 0.7 × normalised weighted out-flow + 0.3 × normalised connections. Simulated metric.
        </p>
      </Section>

      <Section title="Topics discussed">
        {node.topicIds.length === 0 ? (
          <p className="text-xs text-fg-dim">No indexed posts from this node.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {node.topicIds.map((id) => (
              <Badge key={id}>{topicName(id)}</Badge>
            ))}
          </div>
        )}
        <div className="mt-3">
          <LinkButton href={`/explorer?q=${encodeURIComponent(node.label)}`} size="sm">
            <Database size={12} />
            View {node.postCount} indexed post{node.postCount === 1 ? "" : "s"}
          </LinkButton>
        </div>
      </Section>

      <Section title={`Connections (${links.length})`}>
        <ul className="space-y-1">
          {links.slice(0, 8).map(({ edge, outgoing, other }) => (
            <li key={edge.id}>
              <button
                type="button"
                onClick={() => onSelectNode(other.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-ink-800"
              >
                {outgoing ? <ArrowRight size={12} className="shrink-0 text-fg-dim" /> : <ArrowLeft size={12} className="shrink-0 text-fg-dim" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-fg">{other.label}</span>
                  <span className="text-[11px] text-fg-dim">
                    {outgoing ? "to" : "from"} · {EDGE_LABEL[edge.type]}
                  </span>
                </span>
                <span className="tabular-nums text-fg-dim">×{edge.weight}</span>
              </button>
            </li>
          ))}
        </ul>
        {links.length > 8 ? <p className="mt-1 px-2 text-[11px] text-fg-dim">+ {links.length - 8} more connections</p> : null}
      </Section>
    </div>
  );
}

/* ───────────────────────── Community ───────────────────────── */

export function CommunityPanel({
  community,
  graph,
  onSelectNode,
  onIsolate,
  onClose,
}: {
  community: Community;
  graph: NetworkGraph;
  onSelectNode: (id: string) => void;
  onIsolate: () => void;
  onClose: () => void;
}) {
  const members = graph.nodes.filter((n) => n.communityId === community.id);
  const hubs = community.hubNodeIds
    .map((id) => graph.nodes.find((n) => n.id === id))
    .filter((n): n is NetworkNode => n !== undefined);
  return (
    <div>
      <div className="flex items-start justify-between gap-2 px-4 pb-3 pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: community.color }} />
            <h2 className="text-[15px] font-semibold text-fg">{community.name}</h2>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{community.description}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded p-1 text-fg-dim hover:bg-ink-800 hover:text-fg">
          <X size={15} />
        </button>
      </div>

      <Section title="Structure">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Members" value={members.length} />
          <Fact label="Cohesion" value={`${Math.round(community.cohesion * 100)}%`} />
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-fg-dim">
          Cohesion is the share of this community&apos;s edges that stay inside it (higher = more insular).
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {community.platformMix.map((p) => (
            <Badge key={p.platform}>
              {platformLabel(p.platform)} {p.mentions}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Sentiment of its posts">
        <SentimentBar summary={community.sentiment} className="h-2" />
        <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-fg-dim">
          <span>{community.sentiment.positivePct.toFixed(0)}% positive</span>
          <span>{community.sentiment.negativePct.toFixed(0)}% negative</span>
        </div>
      </Section>

      <Section title="Main topics">
        {community.topTopics.length === 0 ? (
          <p className="text-xs text-fg-dim">No indexed posts.</p>
        ) : (
          <ul className="space-y-1.5 text-xs">
            {community.topTopics.map((t) => (
              <li key={t.topicId} className="flex justify-between">
                <span className="text-fg">{t.name}</span>
                <span className="tabular-nums text-fg-dim">{t.posts} posts</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Most influential members">
        <ul className="space-y-1">
          {hubs.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelectNode(n.id)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-ink-800"
              >
                <span className="truncate text-fg">{n.label}</span>
                <span className="tabular-nums text-fg-dim">{(n.influence * 100).toFixed(0)}</span>
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <Button size="sm" onClick={onIsolate}>
            Show only this community
          </Button>
        </div>
      </Section>
    </div>
  );
}

/* ───────────────────────── Overview ───────────────────────── */

function PathCard({
  path,
  graph,
  active,
  onToggle,
}: {
  path: PropagationPath;
  graph: NetworkGraph;
  active: boolean;
  onToggle: () => void;
}) {
  const nodeById = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  return (
    <li className={`rounded-md border ${active ? "border-orange-400/40 bg-orange-400/[0.05]" : "border-line bg-ink-850/60"}`}>
      <button type="button" onClick={onToggle} aria-pressed={active} className="w-full px-3 py-2.5 text-left">
        <div className="flex items-start gap-2">
          <Route size={14} className={`mt-0.5 shrink-0 ${active ? "text-orange-300" : "text-fg-dim"}`} />
          <div className="min-w-0">
            <div className="text-xs font-medium text-fg">{path.label}</div>
            <div className="mt-0.5 text-[11px] text-fg-dim">
              {path.topicName} · {path.hops.length} nodes · {formatDuration(path.durationMinutes)} · {path.platformsCrossed} platform jump
              {path.platformsCrossed === 1 ? "" : "s"} · {path.communitiesCrossed} community jump{path.communitiesCrossed === 1 ? "" : "s"}
            </div>
          </div>
        </div>
      </button>
      {active ? (
        <div className="border-t border-orange-400/20 px-3 py-2.5">
          <ol className="space-y-1.5">
            {path.hops.map((hop, i) => {
              const n = nodeById.get(hop.nodeId);
              return (
                <li key={`${hop.nodeId}-${i}`} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-400/20 text-[10px] font-semibold text-orange-300">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-fg">{n?.label ?? hop.nodeId}</span>
                    <span className="text-[11px] text-fg-dim">
                      {formatTime(hop.at)} UTC{hop.via ? ` · ${EDGE_LABEL[hop.via]}` : " · first post"}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-fg-dim">
            <span>{path.nodesReached} adjacent nodes reached</span>
            {path.seedPostId ? (
              <Link href={`/explorer?post=${path.seedPostId}`} className="font-medium text-signal hover:underline">
                Open first post →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function NetworkOverviewPanel({
  graph,
  activePathId,
  onSelectNode,
  onSelectCommunity,
  onTogglePath,
}: {
  graph: NetworkGraph;
  activePathId: string | null;
  onSelectNode: (id: string) => void;
  onSelectCommunity: (id: string) => void;
  onTogglePath: (id: string) => void;
}) {
  const top = useMemo(() => [...graph.nodes].sort((a, b) => b.influence - a.influence).slice(0, 6), [graph]);
  const m = graph.metrics;
  return (
    <div>
      <Section title="Network">
        <div className="grid grid-cols-2 gap-2">
          <Fact label="Nodes" value={formatNumber(m.nodeCount)} />
          <Fact label="Edges" value={formatNumber(m.edgeCount)} />
          <Fact label="Communities" value={m.communityCount} />
          <Fact label="Avg. degree" value={m.avgDegree} />
        </div>
        <p className="mt-2.5 text-[11px] leading-relaxed text-fg-dim">
          Directed density {m.density}. Arrows show the direction information flowed. Click a node, community or path to explore.
        </p>
      </Section>

      <Section title="Propagation paths">
        {graph.propagationPaths.length === 0 ? (
          <p className="text-xs text-fg-dim">No traced propagation path for this selection.</p>
        ) : (
          <ul className="space-y-2">
            {graph.propagationPaths.map((p) => (
              <PathCard key={p.id} path={p} graph={graph} active={activePathId === p.id} onToggle={() => onTogglePath(p.id)} />
            ))}
          </ul>
        )}
      </Section>

      <Section title="Most influential nodes">
        <ul className="space-y-0.5">
          {top.map((n, i) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => onSelectNode(n.id)}
                className="grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-ink-800"
              >
                <span className="tabular-nums text-fg-dim">{i + 1}</span>
                <span className="truncate text-fg">{n.label}</span>
                <span className="tabular-nums text-fg-dim">{(n.influence * 100).toFixed(0)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Communities">
        <ul className="space-y-0.5">
          {graph.communities.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelectCommunity(c.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-ink-800"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="min-w-0 flex-1 truncate text-fg">{c.name}</span>
                <span className="tabular-nums text-fg-dim">{c.size}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

/* ───────────────────────── Legend ───────────────────────── */

export function NetworkLegend() {
  return (
    <div className="pointer-events-none flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-line bg-ink-900/85 px-3 py-2 text-[11px] text-fg-dim backdrop-blur">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-full bg-fg-muted" /> X account
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-[3px] bg-fg-muted" /> Telegram channel
      </span>
      <span>Size = influence</span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-4 border-t border-dashed border-fg-dim" /> cross-platform link
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded bg-orange-400" /> propagation path
      </span>
    </div>
  );
}
