import type { SignalEvaluation, SignalKey, SocialPost } from "@/types";
import type { HourBucket } from "./topics";
import { bucketCounts, bucketTotal, countsTotal } from "./aggregate";
import { bucketEndMs, bucketStartMs } from "./scenario";
import { clamp, median, round1, round2 } from "./random";

/**
 * Explainable detection signals.
 *
 * This module is the executable specification of the scoring that the Phase 4
 * pipeline will implement in Python: six signals, each with a plain-language
 * rule, an observed value, a 0–1 strength and a weight. The same evaluation
 * powers the trend "why is this emerging" panel and the alert
 * "why was this generated" panel.
 */

export const SIGNAL_WEIGHTS: Record<SignalKey, number> = {
  volume_growth: 0.3,
  sustained_growth: 0.15,
  cross_platform: 0.2,
  sentiment_shift: 0.15,
  community_spread: 0.1,
  engagement: 0.1,
};

export const SIGNAL_LABELS: Record<SignalKey, string> = {
  volume_growth: "Mention volume growth",
  sustained_growth: "Sustained growth",
  cross_platform: "Cross-platform spread",
  sentiment_shift: "Negative sentiment shift",
  community_spread: "Community spread",
  engagement: "Engagement above baseline",
};

export interface EvalContext {
  hourly: Record<string, HourBucket[]>;
  posts: SocialPost[];
  /** Median likes+replies+shares across every indexed post */
  globalMedianEngagement: number;
}

export const totalEngagement = (p: SocialPost): number =>
  (p.engagement.likes ?? 0) + (p.engagement.replies ?? 0) + (p.engagement.shares ?? 0);

export function buildContext(hourly: Record<string, HourBucket[]>, posts: SocialPost[]): EvalContext {
  return { hourly, posts, globalMedianEngagement: median(posts.map(totalEngagement)) };
}

const signed = (n: number, digits = 0): string => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(digits)}`;

/** Evaluate the six signals for a topic at bucket `e` (the "current" hour). */
export function evaluateSignals(ctx: EvalContext, topicId: string, e: number): SignalEvaluation[] {
  const h = ctx.hourly[topicId];
  const v = (i: number): number => bucketTotal(h[Math.max(0, i)]);

  /* 1 — volume growth */
  const cur = v(e);
  const ref = v(e - 6);
  const growth = ((cur - ref) / Math.max(ref, 1)) * 100;
  const volumeFired = growth >= 150 && cur >= 60;
  const volumeScore = clamp(growth / 400, 0, 1) * Math.min(1, cur / 60);
  const volume: SignalEvaluation = {
    key: "volume_growth",
    label: SIGNAL_LABELS.volume_growth,
    observed: `${ref} → ${cur} mentions/hour (${signed(growth)}%)`,
    threshold: "≥ +150% vs 6 hours earlier and ≥ 60 mentions/hour",
    fired: volumeFired,
    score: round2(volumeScore),
    weight: SIGNAL_WEIGHTS.volume_growth,
    explanation: volumeFired
      ? `Mentions per hour rose from ${ref} to ${cur} over six hours, well above the +150% growth threshold.`
      : growth >= 150
        ? `Growth of ${signed(growth)}% is large, but ${cur} mentions/hour is below the 60/hour volume floor, so it is treated as a low-volume signal.`
        : `Growth of ${signed(growth)}% versus six hours earlier is below the +150% threshold.`,
  };

  /* 2 — sustained growth */
  let streak = 0;
  while (e - streak - 1 >= 0 && v(e - streak) > v(e - streak - 1)) streak += 1;
  const sustainedFired = streak >= 3;
  const sustained: SignalEvaluation = {
    key: "sustained_growth",
    label: SIGNAL_LABELS.sustained_growth,
    observed: `${streak} consecutive hourly increase${streak === 1 ? "" : "s"}`,
    threshold: "≥ 3 consecutive hourly increases",
    fired: sustainedFired,
    score: round2(clamp(streak / 6, 0, 1)),
    weight: SIGNAL_WEIGHTS.sustained_growth,
    explanation: sustainedFired
      ? `Volume has climbed for ${streak} hours in a row, which separates a real trend from a one-hour spike.`
      : `Only ${streak} consecutive hourly increase${streak === 1 ? "" : "s"}; growth is not yet sustained.`,
  };

  /* 3 — cross-platform spread (last 3 hours) */
  let xSum = 0;
  let tgSum = 0;
  for (let i = Math.max(0, e - 2); i <= e; i++) {
    xSum += bucketTotal(h[i], "x");
    tgSum += bucketTotal(h[i], "telegram");
  }
  const platTotal = Math.max(1, xSum + tgSum);
  const xPct = (xSum / platTotal) * 100;
  const tgPct = 100 - xPct;
  const minShare = Math.min(xPct, tgPct) / 100;
  const crossFired = minShare >= 0.15;
  const dominant = xPct >= tgPct ? "X" : "Telegram";
  const lesser = xPct >= tgPct ? "Telegram" : "X";
  const cross: SignalEvaluation = {
    key: "cross_platform",
    label: SIGNAL_LABELS.cross_platform,
    observed: `X ${Math.round(xPct)}% · Telegram ${Math.round(tgPct)}% (last 3 hours)`,
    threshold: "each platform ≥ 15% of mentions",
    fired: crossFired,
    score: round2(clamp(minShare / 0.4, 0, 1)),
    weight: SIGNAL_WEIGHTS.cross_platform,
    explanation: crossFired
      ? "The topic is active on both platforms, so it is spreading beyond a single audience."
      : `${lesser} accounts for only ${Math.round(Math.min(xPct, tgPct))}% of mentions; the topic is still confined mainly to ${dominant}.`,
  };

  /* 4 — negative sentiment shift */
  const negPctAt = (i: number): number => {
    const c = bucketCounts(h[Math.max(0, i)]);
    const t = countsTotal(c);
    return t === 0 ? 0 : (c.negative / t) * 100;
  };
  const negNow = negPctAt(e);
  const negBefore = negPctAt(e - 6);
  const delta = negNow - negBefore;
  const sentimentFired = delta >= 15;
  const sentiment: SignalEvaluation = {
    key: "sentiment_shift",
    label: SIGNAL_LABELS.sentiment_shift,
    observed: `Negative share ${Math.round(negBefore)}% → ${Math.round(negNow)}% (${signed(delta)} pp)`,
    threshold: "negative share up ≥ 15 percentage points vs 6 hours earlier",
    fired: sentimentFired,
    score: round2(clamp(delta / 40, 0, 1)),
    weight: SIGNAL_WEIGHTS.sentiment_shift,
    explanation: sentimentFired
      ? `The share of negative posts rose by ${round1(delta)} percentage points in six hours, so reactions are turning against the situation.`
      : `Negative share moved by ${signed(delta, 1)} pp, below the 15 pp shift threshold.`,
  };

  /* 5 — community spread (last 6 hours) */
  const from = bucketStartMs(Math.max(0, e - 5));
  const to = bucketEndMs(e);
  const byCommunity: Record<string, { name: string; n: number }> = {};
  for (const p of ctx.posts) {
    if (p.topic?.id !== topicId || !p.community) continue;
    const ts = Date.parse(p.timestamp);
    if (ts < from || ts >= to) continue;
    (byCommunity[p.community.id] ??= { name: p.community.name, n: 0 }).n += 1;
  }
  const active = Object.values(byCommunity).filter((c) => c.n >= 3);
  const communityFired = active.length >= 3;
  const community: SignalEvaluation = {
    key: "community_spread",
    label: SIGNAL_LABELS.community_spread,
    observed: `${active.length} communit${active.length === 1 ? "y" : "ies"} with ≥ 3 indexed posts (last 6 hours)`,
    threshold: "≥ 3 distinct communities engaged",
    fired: communityFired,
    score: round2(clamp(active.length / 4, 0, 1)),
    weight: SIGNAL_WEIGHTS.community_spread,
    explanation:
      active.length === 0
        ? "No community has produced enough indexed posts about this topic yet."
        : `Active in ${active.map((c) => c.name).join(", ")}${communityFired ? ", so the topic has crossed community boundaries." : "; it has not yet crossed enough community boundaries."}`,
  };

  /* 6 — engagement above baseline (last 3 hours) */
  const engFrom = bucketStartMs(Math.max(0, e - 2));
  const recent = ctx.posts
    .filter((p) => p.topic?.id === topicId && Date.parse(p.timestamp) >= engFrom && Date.parse(p.timestamp) < to)
    .map(totalEngagement);
  const mult = recent.length === 0 || ctx.globalMedianEngagement === 0 ? 0 : median(recent) / ctx.globalMedianEngagement;
  const engagementFired = mult >= 2;
  const engagement: SignalEvaluation = {
    key: "engagement",
    label: SIGNAL_LABELS.engagement,
    observed: `${mult.toFixed(2)}× typical post engagement (median, last 3 hours)`,
    threshold: "median engagement ≥ 2× the typical indexed post",
    fired: engagementFired,
    score: round2(clamp(mult / 3, 0, 1)),
    weight: SIGNAL_WEIGHTS.engagement,
    explanation: engagementFired
      ? `Posts on this topic are drawing ${mult.toFixed(2)}× the usual engagement, a sign that people are actively amplifying it.`
      : `Median engagement is ${mult.toFixed(2)}× the typical post, below the 2× threshold: amplification is not unusual yet.`,
  };

  return [volume, sustained, cross, sentiment, community, engagement];
}

/** Weighted 0–1 composite of the signal strengths. */
export function compositeScore(signals: SignalEvaluation[]): number {
  return round2(signals.reduce((acc, s) => acc + s.weight * s.score, 0));
}

/** Data sufficiency + signal agreement + platform coverage, 0–1. */
export function computeConfidence(ctx: EvalContext, topicId: string, e: number, signals: SignalEvaluation[]): number {
  const h = ctx.hourly[topicId];
  const cur = bucketTotal(h[e]);
  let x = 0;
  let tg = 0;
  for (let i = Math.max(0, e - 2); i <= e; i++) {
    x += bucketTotal(h[i], "x");
    tg += bucketTotal(h[i], "telegram");
  }
  const total = Math.max(1, x + tg);
  const platformsPresent = (x / total >= 0.05 ? 1 : 0) + (tg / total >= 0.05 ? 1 : 0);
  const fired = signals.filter((s) => s.fired).length;
  return round2(clamp(0.45 * Math.min(1, cur / 150) + 0.35 * (fired / 6) + 0.2 * (platformsPresent / 2), 0, 1));
}
