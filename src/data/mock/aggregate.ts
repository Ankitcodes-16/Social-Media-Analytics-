import type { Platform, SentimentCounts, SentimentSummary } from "@/types";
import type { HourBucket } from "./topics";
import { round1 } from "./random";

export const emptyCounts = (): SentimentCounts => ({ positive: 0, neutral: 0, negative: 0 });

export const addCounts = (a: SentimentCounts, b: SentimentCounts): SentimentCounts => ({
  positive: a.positive + b.positive,
  neutral: a.neutral + b.neutral,
  negative: a.negative + b.negative,
});

export const countsTotal = (c: SentimentCounts): number => c.positive + c.neutral + c.negative;

export const bucketCounts = (b: HourBucket, platform?: Platform): SentimentCounts => {
  if (platform === "x") return b.x;
  if (platform === "telegram") return b.telegram;
  return addCounts(b.x, b.telegram);
};

export const bucketTotal = (b: HourBucket, platform?: Platform): number => countsTotal(bucketCounts(b, platform));

/** Sum counts over buckets in [from, to] inclusive. */
export function sumRange(buckets: HourBucket[], from: number, to: number, platform?: Platform): SentimentCounts {
  let acc = emptyCounts();
  for (let i = Math.max(0, from); i <= Math.min(buckets.length - 1, to); i++) {
    acc = addCounts(acc, bucketCounts(buckets[i], platform));
  }
  return acc;
}

export function summarize(counts: SentimentCounts): SentimentSummary {
  const total = countsTotal(counts);
  if (total === 0) {
    return { counts, total: 0, positivePct: 0, neutralPct: 0, negativePct: 0, netScore: 0 };
  }
  const positivePct = round1((counts.positive / total) * 100);
  const negativePct = round1((counts.negative / total) * 100);
  const neutralPct = round1(100 - positivePct - negativePct);
  return { counts, total, positivePct, neutralPct, negativePct, netScore: round1(positivePct - negativePct) };
}
