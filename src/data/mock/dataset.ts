import type { Alert, NetworkGraph, SentimentReport, SocialPost, Topic, TrendDetail } from "@/types";
import { TOPIC_SPECS, buildHourly, type HourBucket } from "./topics";
import { buildGraphBase, finalizeGraph } from "./graph";
import { buildPosts } from "./posts";
import { buildContext, type EvalContext } from "./signals";
import { buildAlerts } from "./alerts";
import { buildTrends } from "./trends";
import { buildSentimentReport } from "./sentiment";
import { BUCKETS, WINDOW_START_INDEX } from "./scenario";
import { bucketTotal } from "./aggregate";

/**
 * The complete simulated dataset, built once and memoised.
 * Everything downstream (services, pages) reads from this single source so that
 * every view tells the same story.
 */
export interface Dataset {
  hourly: Record<string, HourBucket[]>;
  posts: SocialPost[];
  seedIdByKey: Record<string, string>;
  graph: NetworkGraph;
  ctx: EvalContext;
  /** Mutable: analysts can change status during a session (in memory only). */
  alerts: Alert[];
  trends: TrendDetail[];
  topics: Topic[];
  sentiment: SentimentReport;
}

let cache: Dataset | null = null;

export function getDataset(): Dataset {
  if (cache) return cache;

  const hourly: Record<string, HourBucket[]> = {};
  for (const spec of TOPIC_SPECS) hourly[spec.id] = buildHourly(spec);

  const base = buildGraphBase();
  const { posts, seedIdByKey } = buildPosts(base, hourly);
  const graph = finalizeGraph(base, posts, TOPIC_SPECS, seedIdByKey);
  const ctx = buildContext(hourly, posts);
  const alerts = buildAlerts(ctx);
  const trends = buildTrends(ctx, alerts);
  const sentiment = buildSentimentReport(hourly);

  const topics: Topic[] = TOPIC_SPECS.map((spec) => {
    const h = hourly[spec.id];
    let x = 0;
    let tg = 0;
    for (let i = WINDOW_START_INDEX; i < BUCKETS; i++) {
      x += bucketTotal(h[i], "x");
      tg += bucketTotal(h[i], "telegram");
    }
    const total = Math.max(1, x + tg);
    return {
      id: spec.id,
      name: spec.name,
      category: spec.category,
      description: spec.description,
      keywords: spec.keywords.map((k) => k.term),
      platforms: [...(x / total >= 0.05 ? (["x"] as const) : []), ...(tg / total >= 0.05 ? (["telegram"] as const) : [])],
      mentions24h: x + tg,
      mentionsPerHour: bucketTotal(h[BUCKETS - 1]),
    };
  });

  cache = { hourly, posts, seedIdByKey, graph, ctx, alerts, trends, topics, sentiment };
  return cache;
}
