import type { Platform, SentimentChange, SentimentCounts, SentimentPoint, SentimentReport } from "@/types";
import { BUCKETS, WINDOW_HOURS, WINDOW_START_INDEX } from "./scenario";
import { addCounts, bucketCounts, bucketTotal, emptyCounts, sumRange, summarize } from "./aggregate";
import { TOPIC_SPECS, type HourBucket } from "./topics";
import { trendIdOf } from "./trends-ids";

function sumTopics(hourly: Record<string, HourBucket[]>, from: number, to: number, platform?: Platform): SentimentCounts {
  let acc = emptyCounts();
  for (const spec of TOPIC_SPECS) acc = addCounts(acc, sumRange(hourly[spec.id], from, to, platform));
  return acc;
}

export function buildSentimentReport(hourly: Record<string, HourBucket[]>): SentimentReport {
  const now = BUCKETS - 1;

  const timeline: SentimentPoint[] = [];
  for (let i = WINDOW_START_INDEX; i <= now; i++) {
    let counts = emptyCounts();
    for (const spec of TOPIC_SPECS) counts = addCounts(counts, bucketCounts(hourly[spec.id][i]));
    timeline.push({ ts: hourly[TOPIC_SPECS[0].id][i].ts, ...summarize(counts) });
  }

  const changes: SentimentChange[] = TOPIC_SPECS.map((spec): SentimentChange => {
    const h = hourly[spec.id];
    const nowSummary = summarize(sumRange(h, now - 2, now));
    const beforeSummary = summarize(sumRange(h, now - 8, now - 6));
    const delta = Math.round((nowSummary.netScore - beforeSummary.netScore) * 10) / 10;
    const mentionsPerHour = bucketTotal(h[now]);
    return {
      topicId: spec.id,
      topicName: spec.name,
      trendId: trendIdOf(spec.id),
      netNow: nowSummary.netScore,
      netBefore: beforeSummary.netScore,
      delta,
      negativePctNow: nowSummary.negativePct,
      negativePctBefore: beforeSummary.negativePct,
      direction: delta <= -10 ? "worsening" : delta >= 10 ? "improving" : "steady",
      significant: Math.abs(delta) >= 15 && mentionsPerHour >= 30,
      mentionsPerHour,
    };
  }).sort((a, b) => a.delta - b.delta);

  return {
    windowHours: WINDOW_HOURS,
    overall: summarize(sumTopics(hourly, WINDOW_START_INDEX, now)),
    previous: summarize(sumTopics(hourly, 0, WINDOW_START_INDEX - 1)),
    timeline,
    byPlatform: (["x", "telegram"] as Platform[]).map((platform) => ({
      platform,
      summary: summarize(sumTopics(hourly, WINDOW_START_INDEX, now, platform)),
    })),
    byTopic: TOPIC_SPECS.map((spec) => ({
      topicId: spec.id,
      topicName: spec.name,
      summary: summarize(sumRange(hourly[spec.id], WINDOW_START_INDEX, now)),
    })).sort((a, b) => b.summary.total - a.summary.total),
    changes,
  };
}
