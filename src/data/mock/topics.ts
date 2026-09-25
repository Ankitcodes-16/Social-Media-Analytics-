import type { Platform, SentimentCounts } from "@/types";
import { BUCKETS, bucketIso, dayFactor, hourOfBucket } from "./scenario";
import { clamp, interp, mulberry32 } from "./random";

/**
 * Topic specifications for the simulated 48-hour stream.
 *
 * One topic — "Railway Disruption" — carries the demo story:
 *   baseline chatter → 120/h → 250/h → 530/h, sentiment turning negative,
 *   spreading from X to Telegram and from one community to four.
 * The other topics provide realistic background activity, a low-confidence
 * early signal ("Power Outage Reports"), and contrast (stable / declining).
 */

export interface KeywordSpec {
  term: string;
  weight: number;
  firstSeenBucket?: number;
}

export interface SentimentFractions {
  pos: number;
  neu: number;
  neg: number;
}

export interface TopicSpec {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Mean mentions/hour when the daily rhythm factor is 1.0 */
  base: number;
  /** Volume multiplier keyframes over bucket index */
  keyframes: Array<readonly [number, number]>;
  /** Hand-set hourly totals for the hero topic (undefined → use the formula) */
  volumeOverride?: (i: number) => number | undefined;
  /** Share of mentions that are on X (the rest is Telegram) */
  xShare: (i: number) => number;
  /** Sentiment mix on X; Telegram is shifted by tgShift */
  sentiment: (i: number) => SentimentFractions;
  tgShift: { pos: number; neg: number };
  keywords: KeywordSpec[];
  seed: number;
  /** Number of posts to place in the Data Explorer sample */
  sampleSize: number;
}

const kf =
  (keys: Array<readonly [number, number]>) =>
  (i: number): number =>
    interp(keys, i);

/* ───────────────────────── Railway Disruption (hero) ───────────────────────── */

const RAILWAY_HOURLY: Record<number, number> = {
  39: 24, // 05:00
  40: 38, // 06:00
  41: 71, // 07:00
  42: 120, // 08:00  ← first detected (end of this bucket)
  43: 168, // 09:00
  44: 250, // 10:00  ← alert generated (end of this bucket)
  45: 331, // 11:00
  46: 412, // 12:00
  47: 530, // 13:00  ← latest complete hour
};

const railwayNeg = kf([
  [0, 0.22],
  [39, 0.22],
  [40, 0.3],
  [41, 0.36],
  [42, 0.41],
  [43, 0.48],
  [44, 0.55],
  [45, 0.61],
  [46, 0.66],
  [47, 0.71],
]);

const railwayX = kf([
  [0, 0.88],
  [39, 0.88],
  [40, 0.93],
  [41, 0.92],
  [42, 0.9],
  [43, 0.82],
  [44, 0.68],
  [45, 0.64],
  [46, 0.62],
  [47, 0.6],
]);

/* ───────────────────────── Sentiment helpers ───────────────────────── */

const fixedMix =
  (pos: number, neu: number, neg: number) =>
  (): SentimentFractions => ({ pos, neu, neg });

const drift =
  (posKeys: Array<readonly [number, number]>, negKeys: Array<readonly [number, number]>) =>
  (i: number): SentimentFractions => {
    const pos = interp(posKeys, i);
    const neg = interp(negKeys, i);
    return { pos, neg, neu: Math.max(0.02, 1 - pos - neg) };
  };

export const TOPIC_SPECS: TopicSpec[] = [
  {
    id: "t-railway",
    name: "Railway Disruption",
    category: "Transport",
    description:
      "Service suspension on Line 4 after a signalling fault near Meridian Central, with crowding, cancellations and refund complaints.",
    base: 17,
    keyframes: [
      [0, 1],
      [47, 1],
    ],
    volumeOverride: (i) => RAILWAY_HOURLY[i],
    xShare: railwayX,
    sentiment: (i) => {
      const neg = railwayNeg(i);
      const progress = clamp((neg - 0.22) / (0.71 - 0.22), 0, 1);
      const pos = 0.2 - 0.13 * progress;
      return { pos, neg, neu: Math.max(0.02, 1 - pos - neg) };
    },
    tgShift: { pos: -0.03, neg: 0.05 },
    keywords: [
      { term: "signal failure", weight: 0.95, firstSeenBucket: 41 },
      { term: "Line 4", weight: 0.91, firstSeenBucket: 40 },
      { term: "Meridian Central", weight: 0.82, firstSeenBucket: 41 },
      { term: "stranded passengers", weight: 0.74, firstSeenBucket: 42 },
      { term: "cancelled trains", weight: 0.71, firstSeenBucket: 42 },
      { term: "refund", weight: 0.66, firstSeenBucket: 43 },
      { term: "shuttle buses", weight: 0.61, firstSeenBucket: 44 },
      { term: "platform crowding", weight: 0.55, firstSeenBucket: 44 },
      { term: "alternate routes", weight: 0.49, firstSeenBucket: 43 },
      { term: "festival travel", weight: 0.36, firstSeenBucket: 45 },
    ],
    seed: 1101,
    sampleSize: 165,
  },
  {
    id: "t-monsoon",
    name: "Monsoon Flooding",
    category: "Weather",
    description: "Heavy rainfall, waterlogged underpasses and drainage complaints across the city.",
    base: 330,
    keyframes: [
      [0, 1],
      [34, 1],
      [41, 1.3],
      [47, 2.0],
    ],
    xShare: kf([
      [0, 0.58],
      [47, 0.46],
    ]),
    sentiment: drift(
      [
        [0, 0.1],
        [47, 0.08],
      ],
      [
        [0, 0.3],
        [34, 0.32],
        [41, 0.36],
        [47, 0.42],
      ],
    ),
    tgShift: { pos: -0.02, neg: 0.04 },
    keywords: [
      { term: "waterlogging", weight: 0.92 },
      { term: "heavy rain advisory", weight: 0.85 },
      { term: "Ring Road underpass", weight: 0.7, firstSeenBucket: 43 },
      { term: "drainage", weight: 0.62 },
      { term: "red alert", weight: 0.5, firstSeenBucket: 44 },
      { term: "rainfall", weight: 0.45 },
    ],
    seed: 1102,
    sampleSize: 52,
  },
  {
    id: "t-festival",
    name: "Festival Travel Rush",
    category: "Travel",
    description: "Advance bookings, ticket prices and crowd planning ahead of the festival long weekend.",
    base: 250,
    keyframes: [
      [0, 1],
      [36, 1],
      [41, 1.15],
      [47, 1.55],
    ],
    xShare: () => 0.7,
    sentiment: drift(
      [
        [0, 0.43],
        [40, 0.42],
        [47, 0.35],
      ],
      [
        [0, 0.16],
        [40, 0.18],
        [47, 0.27],
      ],
    ),
    tgShift: { pos: -0.02, neg: 0.03 },
    keywords: [
      { term: "long weekend", weight: 0.88 },
      { term: "ticket prices", weight: 0.74 },
      { term: "early booking", weight: 0.66 },
      { term: "travel plans", weight: 0.58 },
      { term: "crowds", weight: 0.5, firstSeenBucket: 44 },
    ],
    seed: 1103,
    sampleSize: 40,
  },
  {
    id: "t-power",
    name: "Power Outage Reports",
    category: "Utilities",
    description: "Localised outage reports from Sector 12, so far seen almost only in Telegram community channels.",
    base: 9,
    keyframes: [
      [0, 1],
      [38, 1],
      [41, 1.6],
      [42, 2.4],
      [43, 3],
      [44, 3.8],
      [45, 4.2],
      [46, 4.6],
      [47, 5],
    ],
    xShare: () => 0.08,
    sentiment: fixedMix(0.04, 0.26, 0.7),
    tgShift: { pos: 0, neg: 0 },
    keywords: [
      { term: "outage", weight: 0.9, firstSeenBucket: 40 },
      { term: "Sector 12", weight: 0.93, firstSeenBucket: 40 },
      { term: "transformer fault", weight: 0.72, firstSeenBucket: 43 },
      { term: "generators", weight: 0.5, firstSeenBucket: 45 },
    ],
    seed: 1104,
    sampleSize: 22,
  },
  {
    id: "t-cricket",
    name: "Cricket Series Final",
    category: "Sports",
    description: "Live match discussion, player performances and umpiring debates.",
    base: 1150,
    keyframes: [
      [0, 1],
      [24, 1],
      [30, 1.35],
      [36, 1.1],
      [47, 1.0],
    ],
    xShare: () => 0.82,
    sentiment: fixedMix(0.58, 0.3, 0.12),
    tgShift: { pos: -0.04, neg: 0.02 },
    keywords: [
      { term: "final", weight: 0.9 },
      { term: "captain", weight: 0.65 },
      { term: "review", weight: 0.5 },
      { term: "innings", weight: 0.72 },
    ],
    seed: 1105,
    sampleSize: 58,
  },
  {
    id: "t-fuel",
    name: "Fuel Price Update",
    category: "Economy",
    description: "Weekly fuel price revision and its impact on commuting and small businesses.",
    base: 360,
    keyframes: [
      [0, 1],
      [20, 1.1],
      [47, 1],
    ],
    xShare: () => 0.58,
    sentiment: fixedMix(0.1, 0.4, 0.5),
    tgShift: { pos: -0.01, neg: 0.03 },
    keywords: [
      { term: "price hike", weight: 0.85 },
      { term: "petrol", weight: 0.8 },
      { term: "diesel", weight: 0.7 },
      { term: "carpool", weight: 0.4 },
    ],
    seed: 1106,
    sampleSize: 40,
  },
  {
    id: "t-exam",
    name: "Exam Result Announcement",
    category: "Education",
    description: "Result publication, portal availability and re-evaluation queries, mostly in student channels.",
    base: 300,
    keyframes: [
      [0, 1],
      [47, 1.05],
    ],
    xShare: () => 0.22,
    sentiment: fixedMix(0.28, 0.48, 0.24),
    tgShift: { pos: 0.02, neg: -0.02 },
    keywords: [
      { term: "results", weight: 0.95 },
      { term: "portal", weight: 0.8 },
      { term: "re-evaluation", weight: 0.6 },
      { term: "server", weight: 0.5 },
    ],
    seed: 1107,
    sampleSize: 34,
  },
  {
    id: "t-metro",
    name: "Metro Fare Revision",
    category: "Transport",
    description: "Reactions to the fare-slab revision announced yesterday; discussion has since faded.",
    base: 140,
    keyframes: [
      [0, 1],
      [10, 1],
      [14, 2.6],
      [20, 1.8],
      [30, 1.2],
      [40, 1],
      [47, 0.95],
    ],
    xShare: () => 0.64,
    sentiment: drift(
      [
        [0, 0.18],
        [10, 0.18],
        [14, 0.06],
        [24, 0.09],
        [47, 0.1],
      ],
      [
        [0, 0.3],
        [10, 0.3],
        [13, 0.55],
        [14, 0.65],
        [18, 0.6],
        [24, 0.5],
        [47, 0.45],
      ],
    ),
    tgShift: { pos: -0.02, neg: 0.03 },
    keywords: [
      { term: "fare revision", weight: 0.9 },
      { term: "concessions", weight: 0.6 },
      { term: "slabs", weight: 0.55 },
    ],
    seed: 1108,
    sampleSize: 36,
  },
  {
    id: "t-phone",
    name: "Smartphone Launch Event",
    category: "Technology",
    description: "Launch-night reactions to a new smartphone; interest is tapering off.",
    base: 260,
    keyframes: [
      [0, 1],
      [30, 1],
      [32, 2.4],
      [34, 2.0],
      [41, 1.2],
      [47, 0.75],
    ],
    xShare: () => 0.88,
    sentiment: drift(
      [
        [0, 0.55],
        [47, 0.44],
      ],
      [
        [0, 0.08],
        [47, 0.14],
      ],
    ),
    tgShift: { pos: -0.05, neg: 0.03 },
    keywords: [
      { term: "launch event", weight: 0.75 },
      { term: "camera", weight: 0.8 },
      { term: "battery", weight: 0.7 },
      { term: "pricing", weight: 0.55 },
    ],
    seed: 1109,
    sampleSize: 30,
  },
];

/* ───────────────────────── Hourly generation ───────────────────────── */

export interface HourBucket {
  i: number;
  ts: string;
  x: SentimentCounts;
  telegram: SentimentCounts;
}

function fractionsFor(spec: TopicSpec, i: number, platform: Platform): SentimentFractions {
  const f = spec.sentiment(i);
  if (platform === "x") return f;
  const neg = clamp(f.neg + spec.tgShift.neg, 0.01, 0.95);
  const pos = clamp(f.pos + spec.tgShift.pos, 0.01, 0.95);
  return { pos, neg, neu: Math.max(0.02, 1 - neg - pos) };
}

function splitCounts(n: number, f: SentimentFractions): SentimentCounts {
  const negative = Math.round(n * f.neg);
  const positive = Math.min(n - negative, Math.round(n * f.pos));
  return { positive, neutral: n - negative - positive, negative };
}

export function buildHourly(spec: TopicSpec): HourBucket[] {
  const rng = mulberry32(spec.seed);
  const out: HourBucket[] = [];
  for (let i = 0; i < BUCKETS; i++) {
    const noise = 1 + (rng() - 0.5) * 0.08;
    const override = spec.volumeOverride?.(i);
    const total =
      override !== undefined
        ? override
        : Math.max(1, Math.round(spec.base * dayFactor(hourOfBucket(i)) * interp(spec.keyframes, i) * noise));
    const nx = Math.round(total * spec.xShare(i));
    const nt = total - nx;
    out.push({
      i,
      ts: bucketIso(i),
      x: splitCounts(nx, fractionsFor(spec, i, "x")),
      telegram: splitCounts(nt, fractionsFor(spec, i, "telegram")),
    });
  }
  return out;
}
