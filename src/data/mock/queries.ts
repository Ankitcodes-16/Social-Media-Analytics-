import type {
  ActivityPoint,
  Alert,
  AlertDetail,
  AlertQuery,
  AlertStatusEvent,
  AlertStatusUpdate,
  NetworkGraph,
  NetworkQuery,
  OverviewSummary,
  Paginated,
  PostQuery,
  PlatformShare,
  SentimentReport,
  SocialPost,
  Topic,
  TrendDetail,
  TrendQuery,
  TrendSummary,
} from "@/types";
import { getDataset } from "./dataset";
import {
  BUCKETS,
  HOUR_MS,
  SCENARIO_NOW,
  SCENARIO_NOW_ISO,
  WINDOW_HOURS,
  WINDOW_START_INDEX,
  bucketIso,
  mockNow,
} from "./scenario";
import { bucketTotal } from "./aggregate";
import { TOPIC_SPECS } from "./topics";
import { totalEngagement } from "./signals";
import { round1, round2 } from "./random";
import { topicIdOfTrend } from "./trends-ids";

/**
 * "Backend in miniature": the query logic FastAPI will implement in Phase 2.
 * Services call these functions while a service is in simulated mode.
 */

/* ───────────────────────── Overview ───────────────────────── */

export function queryOverview(): OverviewSummary {
  const ds = getDataset();
  const emerging = ds.trends.filter((t) => t.status === "emerging").sort((a, b) => b.trendScore - a.trendScore)[0];

  const activity: ActivityPoint[] = [];
  let posts24h = 0;
  let postsPrev = 0;
  let x24 = 0;
  let tg24 = 0;
  for (let i = 0; i < BUCKETS; i++) {
    let x = 0;
    let tg = 0;
    for (const spec of TOPIC_SPECS) {
      x += bucketTotal(ds.hourly[spec.id][i], "x");
      tg += bucketTotal(ds.hourly[spec.id][i], "telegram");
    }
    if (i >= WINDOW_START_INDEX) {
      posts24h += x + tg;
      x24 += x;
      tg24 += tg;
      activity.push({
        ts: bucketIso(i),
        total: x + tg,
        x,
        telegram: tg,
        emerging: emerging ? bucketTotal(ds.hourly[emerging.topicId][i]) : 0,
      });
    } else {
      postsPrev += x + tg;
    }
  }

  const active = ds.alerts.filter((a) => a.status !== "resolved");
  const growing = ds.trends
    .filter((t) => t.mentionsPerHour >= 25)
    .sort((a, b) => b.growthRate - a.growthRate)[0];
  const marker = emerging
    ? ds.alerts
        .filter((a) => a.topicId === emerging.topicId)
        .map((a) => a.createdAt)
        .sort()[0]
    : undefined;

  const platformDistribution: PlatformShare[] = [
    { platform: "x", mentions: x24, sharePct: round1((x24 / Math.max(1, posts24h)) * 100) },
    { platform: "telegram", mentions: tg24, sharePct: round1((tg24 / Math.max(1, posts24h)) * 100) },
  ];
  const last = activity[activity.length - 1];

  return {
    windowStart: bucketIso(WINDOW_START_INDEX),
    windowEnd: SCENARIO_NOW_ISO,
    windowHours: WINDOW_HOURS,
    kpis: {
      postsAnalyzed24h: posts24h,
      postsAnalyzedPrev24h: postsPrev,
      activeTopics: ds.topics.filter((t) => t.mentionsPerHour >= 25).length,
      emergingTrends: ds.trends.filter((t) => t.status === "emerging").length,
      risingTrends: ds.trends.filter((t) => t.status === "rising").length,
      activeAlerts: active.length,
      highSeverityAlerts: active.filter((a) => a.severity === "high" || a.severity === "critical").length,
      fastestTrend: growing
        ? { trendId: growing.id, name: growing.name, growthRate: growing.growthRate, mentionsPerHour: growing.mentionsPerHour }
        : null,
    },
    activity,
    emergingTopicName: emerging?.name ?? null,
    alertMarkerAt: marker ?? null,
    platformDistribution,
    sources: [
      { platform: "x", label: "X", mode: "simulated", postsPerHour: last.x, lastEventAt: SCENARIO_NOW_ISO },
      { platform: "telegram", label: "Telegram", mode: "simulated", postsPerHour: last.telegram, lastEventAt: SCENARIO_NOW_ISO },
    ],
  };
}

/* ───────────────────────── Topics & sentiment ───────────────────────── */

export const queryTopics = (): Topic[] => getDataset().topics;
export const querySentiment = (): SentimentReport => getDataset().sentiment;

/* ───────────────────────── Trends ───────────────────────── */

function toSummary(d: TrendDetail): TrendSummary {
  return {
    id: d.id,
    topicId: d.topicId,
    name: d.name,
    category: d.category,
    status: d.status,
    trendScore: d.trendScore,
    confidence: d.confidence,
    mentionsPerHour: d.mentionsPerHour,
    mentions24h: d.mentions24h,
    growthRate: d.growthRate,
    velocity: d.velocity,
    sentiment: d.sentiment,
    platforms: d.platforms,
    firstDetectedAt: d.firstDetectedAt,
    keywords: d.keywords,
    sparkline: d.sparkline,
    alertIds: d.alertIds,
  };
}

export function queryTrends(q: TrendQuery = {}): TrendSummary[] {
  let items = getDataset().trends.map(toSummary);
  if (q.status && q.status !== "all") items = items.filter((t) => t.status === q.status);
  if (q.platform && q.platform !== "all") {
    items = items.filter((t) => (t.platforms.find((p) => p.platform === q.platform)?.sharePct ?? 0) >= 10);
  }
  const sort = q.sort ?? "score";
  items = [...items].sort((a, b) => {
    switch (sort) {
      case "growth":
        return b.growthRate - a.growthRate;
      case "volume":
        return b.mentions24h - a.mentions24h;
      case "recent": {
        const at = a.firstDetectedAt ? Date.parse(a.firstDetectedAt) : 0;
        const bt = b.firstDetectedAt ? Date.parse(b.firstDetectedAt) : 0;
        return bt - at || b.trendScore - a.trendScore;
      }
      default:
        return b.trendScore - a.trendScore;
    }
  });
  return items;
}

export function queryTrend(id: string): TrendDetail | null {
  const topicId = topicIdOfTrend(id);
  return getDataset().trends.find((t) => t.id === id || t.topicId === topicId) ?? null;
}

/* ───────────────────────── Posts ───────────────────────── */

export function queryPosts(q: PostQuery = {}): Paginated<SocialPost> {
  const ds = getDataset();
  const term = q.q?.trim().toLowerCase().replace(/^#/, "");
  const cutoff = q.rangeHours !== undefined && q.rangeHours !== "all" ? SCENARIO_NOW - q.rangeHours * HOUR_MS : null;

  let items = ds.posts.filter((p) => {
    if (q.platform && q.platform !== "all" && p.platform !== q.platform) return false;
    if (q.topicId && q.topicId !== "all" && p.topic?.id !== q.topicId) return false;
    if (q.sentiment && q.sentiment !== "all" && p.sentiment !== q.sentiment) return false;
    if (cutoff !== null && Date.parse(p.timestamp) < cutoff) return false;
    if (term) {
      const hay = `${p.text} ${p.authorName} ${p.hashtags.join(" ")} ${p.topic?.name ?? ""}`.toLowerCase();
      if (!hay.includes(term)) return false;
    }
    return true;
  });

  const sort = q.sort ?? "newest";
  items = [...items].sort((a, b) => {
    if (sort === "oldest") return Date.parse(a.timestamp) - Date.parse(b.timestamp);
    if (sort === "engagement") return totalEngagement(b) - totalEngagement(a);
    if (sort === "views") return (b.engagement.views ?? 0) - (a.engagement.views ?? 0);
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });

  const pageSize = Math.min(100, Math.max(1, q.pageSize ?? 20));
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(pages, Math.max(1, q.page ?? 1));
  return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize };
}

export const queryPost = (id: string): SocialPost | null => getDataset().posts.find((p) => p.id === id) ?? null;

/* ───────────────────────── Alerts ───────────────────────── */

const cloneAlert = (a: Alert): Alert => ({
  ...a,
  platforms: [...a.platforms],
  whyBullets: [...a.whyBullets],
  evidence: a.evidence.map((e) => ({ ...e })),
  history: a.history.map((h) => ({ ...h })),
});

export function queryAlerts(q: AlertQuery = {}): Alert[] {
  let items = getDataset().alerts;
  if (q.status === "active") items = items.filter((a) => a.status !== "resolved");
  else if (q.status && q.status !== "all") items = items.filter((a) => a.status === q.status);
  if (q.severity && q.severity !== "all") items = items.filter((a) => a.severity === q.severity);
  return items.map(cloneAlert);
}

export function queryAlert(id: string): AlertDetail | null {
  const ds = getDataset();
  const alert = ds.alerts.find((a) => a.id === id);
  if (!alert) return null;
  const trend = ds.trends.find((t) => t.id === alert.trendId);
  if (!trend) return null;

  const createdMs = Date.parse(alert.createdAt);
  const from = createdMs - 6 * HOUR_MS;
  const supportingPosts = ds.posts
    .filter((p) => p.topic?.id === alert.topicId && Date.parse(p.timestamp) >= from && Date.parse(p.timestamp) <= createdMs)
    .sort((a, b) => totalEngagement(b) - totalEngagement(a))
    .slice(0, 5);

  return { ...cloneAlert(alert), trend: toSummary(trend), timeline: trend.timeline, supportingPosts };
}

export function mutateAlertStatus(id: string, update: AlertStatusUpdate): Alert {
  const alert = getDataset().alerts.find((a) => a.id === id);
  if (!alert) throw new Error(`Alert ${id} not found`);
  const defaults = { new: "Reopened.", investigating: "Marked as investigating.", resolved: "Marked as resolved." } as const;
  const event: AlertStatusEvent = {
    ts: new Date(mockNow()).toISOString(),
    status: update.status,
    note: update.note?.trim() || defaults[update.status],
    actor: "analyst",
  };
  alert.status = update.status;
  alert.updatedAt = event.ts;
  alert.history.push(event);
  return cloneAlert(alert);
}

/* ───────────────────────── Network ───────────────────────── */

export function queryNetwork(q: NetworkQuery = {}): NetworkGraph {
  const { graph } = getDataset();
  const topicId = q.topicId && q.topicId !== "all" ? q.topicId : undefined;
  if (!topicId) return graph;

  const nodes = graph.nodes.filter((n) => n.topicIds.includes(topicId));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = graph.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const communities = graph.communities
    .filter((c) => nodes.some((n) => n.communityId === c.id))
    .map((c) => ({
      ...c,
      size: nodes.filter((n) => n.communityId === c.id).length,
      hubNodeIds: c.hubNodeIds.filter((id) => ids.has(id)),
    }));
  const n = nodes.length;
  return {
    topicId,
    nodes,
    edges,
    communities,
    propagationPaths: graph.propagationPaths.filter((p) => p.topicId === topicId),
    metrics: {
      nodeCount: n,
      edgeCount: edges.length,
      communityCount: communities.length,
      density: n > 1 ? round2(edges.length / (n * (n - 1))) : 0,
      avgDegree: n > 0 ? round1((2 * edges.length) / n) : 0,
    },
  };
}

