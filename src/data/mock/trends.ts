import type {
  Alert,
  PlatformComparison,
  PlatformShare,
  RelatedKeyword,
  Sentiment,
  SentimentPoint,
  TimePoint,
  TrendCommunity,
  TrendDetail,
  TrendMilestone,
  TrendStatus,
} from "@/types";
import {
  BUCKETS,
  MINUTE_MS,
  SCENARIO_NOW_ISO,
  WINDOW_START_INDEX,
  bucketEndMs,
  bucketIso,
  bucketStartMs,
} from "./scenario";
import { bucketCounts, bucketTotal, sumRange, summarize } from "./aggregate";
import { TOPIC_SPECS } from "./topics";
import {
  SIGNAL_WEIGHTS,
  compositeScore,
  computeConfidence,
  evaluateSignals,
  totalEngagement,
  type EvalContext,
} from "./signals";
import { mean, median, round1 } from "./random";
import { trendIdOf } from "./trends-ids";

/** A trend is "detected" the first hour its composite score reaches this value. */
export const DETECTION_SCORE = 0.6;

function onsetBucket(v: number[], baseline: number): number {
  const threshold = Math.max(baseline * 2, baseline + 10);
  for (let i = 1; i < v.length; i++) if (v[i] >= threshold) return i;
  return -1;
}

export function buildTrends(ctx: EvalContext, alerts: Alert[]): TrendDetail[] {
  const now = BUCKETS - 1;
  const windowStartMs = bucketStartMs(WINDOW_START_INDEX);
  const out: TrendDetail[] = [];

  for (const spec of TOPIC_SPECS) {
    const h = ctx.hourly[spec.id];
    const v = h.map((b) => bucketTotal(b));
    const cur = v[now];
    const ref6 = v[now - 6];
    const growthRate = round1(((cur - ref6) / Math.max(ref6, 1)) * 100);
    const velocity = round1((v[now] - v[now - 3]) / 3);
    const signals = evaluateSignals(ctx, spec.id, now);
    const score = compositeScore(signals);
    const confidence = computeConfidence(ctx, spec.id, now, signals);
    const baseline = Math.round(median(v));

    // Detection: first hour the composite score reached the threshold, or the alert time
    let detectedBucket = -1;
    for (let e = 6; e <= now; e++) {
      if (compositeScore(evaluateSignals(ctx, spec.id, e)) >= DETECTION_SCORE) {
        detectedBucket = e;
        break;
      }
    }
    const topicAlerts = alerts.filter((a) => a.topicId === spec.id);
    const candidates: number[] = [];
    if (detectedBucket >= 0) candidates.push(bucketEndMs(detectedBucket) + 5 * MINUTE_MS);
    for (const a of topicAlerts) candidates.push(Date.parse(a.createdAt));
    const detectedMs = candidates.length > 0 ? Math.min(...candidates) : null;

    const status: TrendStatus =
      detectedMs !== null && growthRate >= 100 && cur >= 25
        ? "emerging"
        : growthRate >= 25
          ? "rising"
          : growthRate <= -20
            ? "declining"
            : "stable";
    const firstDetectedAt =
      (status === "emerging" || status === "rising") && detectedMs !== null && detectedMs >= windowStartMs
        ? new Date(detectedMs).toISOString()
        : null;

    // 24h aggregates
    let x24 = 0;
    let tg24 = 0;
    for (let i = WINDOW_START_INDEX; i <= now; i++) {
      x24 += bucketTotal(h[i], "x");
      tg24 += bucketTotal(h[i], "telegram");
    }
    const mentions24h = x24 + tg24;
    const platforms: PlatformShare[] = [
      { platform: "x", mentions: x24, sharePct: round1((x24 / Math.max(1, mentions24h)) * 100) },
      { platform: "telegram", mentions: tg24, sharePct: round1((tg24 / Math.max(1, mentions24h)) * 100) },
    ];
    const sentiment = summarize(sumRange(h, WINDOW_START_INDEX, now));

    // Detail: timelines
    const timeline: TimePoint[] = [];
    const sentimentTimeline: SentimentPoint[] = [];
    for (let i = WINDOW_START_INDEX; i <= now; i++) {
      timeline.push({ ts: h[i].ts, total: v[i], x: bucketTotal(h[i], "x"), telegram: bucketTotal(h[i], "telegram") });
      sentimentTimeline.push({ ts: h[i].ts, ...summarize(bucketCounts(h[i])) });
    }

    // Onset and posts in the window
    const onset = onsetBucket(v, baseline);
    const fromBucket = Math.max(WINDOW_START_INDEX, onset);
    const fromMs = bucketStartMs(fromBucket);
    const topicPosts = ctx.posts.filter((p) => p.topic?.id === spec.id);
    const windowPosts = topicPosts.filter((p) => Date.parse(p.timestamp) >= windowStartMs);

    // Platform comparison
    const platformComparison: PlatformComparison[] = platforms.map((ps) => {
      const posts = windowPosts.filter((p) => p.platform === ps.platform);
      let firstSeenAt: string | undefined;
      for (let i = fromBucket; i <= now; i++) {
        const share = bucketTotal(h[i], ps.platform) / Math.max(1, v[i]);
        if (share >= 0.15 && v[i] >= 30) {
          firstSeenAt = new Date(bucketEndMs(i)).toISOString();
          break;
        }
      }
      return {
        platform: ps.platform,
        mentions24h: ps.mentions,
        sharePct: ps.sharePct,
        negativePct: summarize(sumRange(h, WINDOW_START_INDEX, now, ps.platform)).negativePct,
        avgEngagement: Math.round(mean(posts.map(totalEngagement))),
        firstSeenAt,
      };
    });

    // Keywords
    const relatedKeywords: RelatedKeyword[] = spec.keywords.map((k) => ({
      term: k.term,
      weight: k.weight,
      mentions: Math.round(k.weight * mentions24h * 0.55),
      firstSeenAt: k.firstSeenBucket !== undefined ? bucketIso(k.firstSeenBucket) : undefined,
      isNew: k.firstSeenBucket !== undefined && k.firstSeenBucket >= now - 5,
    }));

    // Communities involved (posts since onset, within the window)
    const communityPosts = topicPosts.filter((p) => Date.parse(p.timestamp) >= fromMs);
    const byCommunity: Record<string, { name: string; color: string; posts: typeof communityPosts }> = {};
    for (const p of communityPosts) {
      if (!p.community) continue;
      (byCommunity[p.community.id] ??= { name: p.community.name, color: p.community.color, posts: [] }).posts.push(p);
    }
    const communities: TrendCommunity[] = Object.entries(byCommunity)
      .map(([id, c]) => {
        const counts: Record<Sentiment, number> = { positive: 0, neutral: 0, negative: 0 };
        for (const p of c.posts) if (p.sentiment) counts[p.sentiment] += 1;
        const dominantSentiment = (Object.keys(counts) as Sentiment[]).reduce((best, s) => (counts[s] > counts[best] ? s : best), "neutral");
        const joinedAt = c.posts.reduce((min, p) => (p.timestamp < min ? p.timestamp : min), c.posts[0].timestamp);
        return {
          id,
          name: c.name,
          color: c.color,
          postCount: c.posts.length,
          sharePct: round1((c.posts.length / Math.max(1, communityPosts.length)) * 100),
          joinedAt,
          dominantSentiment,
        };
      })
      .sort((a, b) => b.postCount - a.postCount);

    // Milestones
    const milestones: TrendMilestone[] = [];
    if (status === "emerging" || status === "rising") {
      if (detectedBucket >= 0 && bucketEndMs(detectedBucket) + 5 * MINUTE_MS >= windowStartMs) {
        milestones.push({
          ts: new Date(bucketEndMs(detectedBucket) + 5 * MINUTE_MS).toISOString(),
          kind: "detected",
          label: "First detected",
          detail: `Trend score reached ${Math.round(DETECTION_SCORE * 100)} at ${v[detectedBucket]} mentions/hour.`,
          mentionsPerHour: v[detectedBucket],
        });
      }
      const lesser = [...platformComparison].sort((a, b) => a.sharePct - b.sharePct)[0];
      if (lesser.firstSeenAt && Date.parse(lesser.firstSeenAt) >= windowStartMs && onset >= 0) {
        milestones.push({
          ts: lesser.firstSeenAt,
          kind: "platform",
          label: `Spreads to ${lesser.platform === "x" ? "X" : "Telegram"}`,
          detail: `${lesser.platform === "x" ? "X" : "Telegram"} now carries a substantial share of hourly mentions.`,
        });
      }
      for (const a of topicAlerts) {
        milestones.push({
          ts: a.createdAt,
          kind: "alert",
          label: "Alert generated",
          detail: `${a.id} · ${a.severity} severity · ${a.evidence.filter((s) => s.fired).length} of ${a.evidence.length} signals fired.`,
          mentionsPerHour: a.mentionsPerHourAtAlert,
        });
      }
      if (communities.length >= 3 && onset >= 0) {
        const last = [...communities].sort((a, b) => (a.joinedAt < b.joinedAt ? 1 : -1))[0];
        milestones.push({
          ts: last.joinedAt,
          kind: "community",
          label: `${last.name} joins`,
          detail: `${communities.length} communities are now discussing the topic.`,
        });
      }
    }
    milestones.push({
      ts: SCENARIO_NOW_ISO,
      kind: "current",
      label: "Latest complete hour",
      detail: `${cur} mentions/hour · ${sentiment.negativePct}% negative over 24h.`,
      mentionsPerHour: cur,
    });
    milestones.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));

    // Evidence
    const fired = signals.filter((s) => s.fired);
    let x3 = 0;
    let tg3 = 0;
    for (let i = now - 2; i <= now; i++) {
      x3 += bucketTotal(h[i], "x");
      tg3 += bucketTotal(h[i], "telegram");
    }
    const t3 = Math.max(1, x3 + tg3);
    const platformsPresent = (x3 / t3 >= 0.05 ? 1 : 0) + (tg3 / t3 >= 0.05 ? 1 : 0);
    const evidence: string[] = fired.map((s) => s.explanation);
    if (fired.length === 0) evidence.push("No detection signal has fired for this topic.");
    evidence.push(
      `Trend score ${Math.round(score * 100)}/100 is the weighted sum of the six signal strengths (volume ${SIGNAL_WEIGHTS.volume_growth * 100}%, sustained growth ${SIGNAL_WEIGHTS.sustained_growth * 100}%, cross-platform ${SIGNAL_WEIGHTS.cross_platform * 100}%, sentiment ${SIGNAL_WEIGHTS.sentiment_shift * 100}%, community ${SIGNAL_WEIGHTS.community_spread * 100}%, engagement ${SIGNAL_WEIGHTS.engagement * 100}%).`,
    );
    evidence.push(
      `Confidence ${Math.round(confidence * 100)}%: ${cur} mentions/hour against a 150/hour data-sufficiency target, ${fired.length} of ${signals.length} signals agree, ${platformsPresent} platform${platformsPresent === 1 ? "" : "s"} present.`,
    );
    const lowReasons: string[] = [];
    if (cur < 60) lowReasons.push("volume is below the 60 mentions/hour floor");
    if (Math.min(x3, tg3) / t3 < 0.15) lowReasons.push("activity is concentrated on a single platform");
    if (confidence < 0.5 && lowReasons.length > 0) {
      evidence.push(`Kept as a watch item rather than an alert because ${lowReasons.join(" and ")}.`);
    }

    out.push({
      id: trendIdOf(spec.id),
      topicId: spec.id,
      name: spec.name,
      category: spec.category,
      description: spec.description,
      status,
      trendScore: Math.round(score * 100),
      confidence,
      mentionsPerHour: cur,
      mentions24h,
      growthRate,
      velocity,
      sentiment,
      platforms,
      firstDetectedAt,
      keywords: [...spec.keywords].sort((a, b) => b.weight - a.weight).slice(0, 5).map((k) => k.term),
      sparkline: v.slice(now - 11, now + 1),
      alertIds: topicAlerts.map((a) => a.id),
      baseline,
      timeline,
      sentimentTimeline,
      platformComparison,
      relatedKeywords,
      signals,
      communities,
      milestones,
      evidence,
    });
  }
  return out;
}
