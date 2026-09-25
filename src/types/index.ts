/**
 * Trend Sphere — shared data contracts.
 *
 * These interfaces are the frontend mirror of the FastAPI / Pydantic response
 * schemas that Phase 2 will implement. The backend serialises to camelCase JSON
 * (Pydantic `alias_generator=to_camel`, `populate_by_name=True`).
 *
 * Rules:
 *  - Timestamps are ISO-8601 strings in UTC.
 *  - Percentages are plain numbers in the 0–100 range unless the field name says otherwise.
 *  - `score` / `confidence` style fields are 0–1 unless stated.
 *  - Everything the UI renders comes through these types — never ad-hoc shapes.
 */

/* ───────────────────────── Primitives ───────────────────────── */

export type Platform = "x" | "telegram";
export type Sentiment = "positive" | "neutral" | "negative";
export type ImplementationStatus = "implemented" | "simulated" | "future";

export interface TopicRef {
  id: string;
  name: string;
}

export interface CommunityRef {
  id: string;
  name: string;
  color: string;
}

/* ───────────────────────── Posts ───────────────────────── */

export interface Engagement {
  likes?: number;
  replies?: number;
  shares?: number;
  views?: number;
}

export interface SocialPost {
  id: string;
  platform: Platform;
  authorId: string;
  /** Anonymised / demo handle. Never a real identity. */
  authorName: string;
  text: string;
  timestamp: string;
  engagement: Engagement;
  hashtags: string[];
  /** ISO 639-1 code */
  language: string;
  topic?: TopicRef;
  sentiment?: Sentiment;
  /** −1 (very negative) … +1 (very positive) */
  sentimentScore?: number;
  community?: CommunityRef;
}

export type PostSort = "newest" | "oldest" | "engagement" | "views";

export interface PostQuery {
  q?: string;
  platform?: Platform | "all";
  topicId?: string | "all";
  sentiment?: Sentiment | "all";
  /** Only posts from the last N hours (relative to the dataset's "now"). */
  rangeHours?: number | "all";
  sort?: PostSort;
  page?: number;
  pageSize?: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/* ───────────────────────── Topics ───────────────────────── */

export interface Topic {
  id: string;
  name: string;
  category: string;
  description: string;
  keywords: string[];
  platforms: Platform[];
  mentions24h: number;
  mentionsPerHour: number;
}

/* ───────────────────────── Sentiment ───────────────────────── */

export interface SentimentCounts {
  positive: number;
  neutral: number;
  negative: number;
}

export interface SentimentSummary {
  counts: SentimentCounts;
  total: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
  /** positivePct − negativePct, range −100…+100 */
  netScore: number;
}

export interface SentimentPoint extends SentimentSummary {
  ts: string;
}

export interface PlatformSentiment {
  platform: Platform;
  summary: SentimentSummary;
}

export interface TopicSentiment {
  topicId: string;
  topicName: string;
  summary: SentimentSummary;
}

export interface SentimentChange {
  topicId: string;
  topicName: string;
  trendId: string;
  /** Net score (pos% − neg%) over the last 3 hours */
  netNow: number;
  /** Net score over the 3 hours ending 6 hours earlier */
  netBefore: number;
  delta: number;
  negativePctNow: number;
  negativePctBefore: number;
  direction: "worsening" | "improving" | "steady";
  significant: boolean;
  mentionsPerHour: number;
}

export interface SentimentReport {
  overall: SentimentSummary;
  previous: SentimentSummary;
  timeline: SentimentPoint[];
  byPlatform: PlatformSentiment[];
  byTopic: TopicSentiment[];
  changes: SentimentChange[];
  windowHours: number;
}

/* ───────────────────────── Trends ───────────────────────── */

export type TrendStatus = "emerging" | "rising" | "stable" | "declining";
export type TrendSort = "score" | "growth" | "volume" | "recent";

export interface TrendQuery {
  status?: TrendStatus | "all";
  /** Only trends where the platform holds a meaningful share of mentions */
  platform?: Platform | "all";
  sort?: TrendSort;
}

export interface PlatformShare {
  platform: Platform;
  mentions: number;
  sharePct: number;
}

export interface TimePoint {
  ts: string;
  total: number;
  x: number;
  telegram: number;
}

export type SignalKey =
  | "volume_growth"
  | "sustained_growth"
  | "cross_platform"
  | "sentiment_shift"
  | "community_spread"
  | "engagement";

/**
 * One explainable detection signal. The same structure feeds the trend
 * "why is this emerging" panel and the alert "why was this generated" panel.
 */
export interface SignalEvaluation {
  key: SignalKey;
  label: string;
  /** Human readable observed value, e.g. "71 → 530 mentions/hour (+646%)" */
  observed: string;
  /** Human readable rule, e.g. "≥ +150% and ≥ 60 mentions/hour" */
  threshold: string;
  fired: boolean;
  /** 0–1 contribution strength before weighting */
  score: number;
  /** Weight of this signal in the composite score (weights sum to 1) */
  weight: number;
  explanation: string;
}

export interface RelatedKeyword {
  term: string;
  /** 0–1 relevance to the topic */
  weight: number;
  mentions: number;
  firstSeenAt?: string;
  /** First seen inside the last 6 hours */
  isNew: boolean;
}

export interface PlatformComparison {
  platform: Platform;
  mentions24h: number;
  sharePct: number;
  negativePct: number;
  /** Mean likes+replies+shares of indexed posts */
  avgEngagement: number;
  /** When the platform first held ≥ 15% of an hour with ≥ 30 mentions (end of that hour) */
  firstSeenAt?: string;
}

export interface TrendCommunity extends CommunityRef {
  postCount: number;
  sharePct: number;
  joinedAt: string;
  dominantSentiment: Sentiment;
}

export interface TrendMilestone {
  ts: string;
  kind: "detected" | "platform" | "alert" | "community" | "current";
  label: string;
  detail: string;
  mentionsPerHour?: number;
}

export interface TrendSummary {
  id: string;
  topicId: string;
  name: string;
  category: string;
  status: TrendStatus;
  /** 0–100 composite of the weighted signals */
  trendScore: number;
  /** 0–1: data sufficiency + signal agreement + platform coverage */
  confidence: number;
  mentionsPerHour: number;
  mentions24h: number;
  /** % change in mentions/hour versus 6 hours earlier */
  growthRate: number;
  /** Mean hourly increase in mentions/hour over the last 3 hours */
  velocity: number;
  sentiment: SentimentSummary;
  platforms: PlatformShare[];
  firstDetectedAt: string | null;
  keywords: string[];
  /** Last 12 hourly mention counts, oldest first */
  sparkline: number[];
  alertIds: string[];
}

export interface TrendDetail extends TrendSummary {
  description: string;
  /** Mean mentions/hour before the trend onset */
  baseline: number;
  timeline: TimePoint[];
  sentimentTimeline: SentimentPoint[];
  platformComparison: PlatformComparison[];
  relatedKeywords: RelatedKeyword[];
  signals: SignalEvaluation[];
  communities: TrendCommunity[];
  milestones: TrendMilestone[];
  evidence: string[];
}

/* ───────────────────────── Network ───────────────────────── */

export type NodeType = "user" | "channel";
export type NodeRole = "hub" | "bridge" | "member";
export type EdgeType = "retweet" | "reply" | "mention" | "forward" | "cross_post";

export interface NetworkNode {
  id: string;
  label: string;
  type: NodeType;
  platform: Platform;
  communityId: string;
  role: NodeRole;
  /** Total connections (in + out) in the full graph */
  degree: number;
  inDegree: number;
  outDegree: number;
  /** 0–1: 0.7 × normalised weighted out-flow + 0.3 × normalised degree */
  influence: number;
  /** Number of other communities this node is connected to */
  communityReach: number;
  /** Posts from this node present in the Data Explorer sample */
  postCount: number;
  topicIds: string[];
}

export interface NetworkEdge {
  id: string;
  /** Information flows source → target */
  source: string;
  target: string;
  type: EdgeType;
  weight: number;
  timestamp?: string;
  onPropagationPath?: boolean;
}

export interface Community {
  id: string;
  name: string;
  description: string;
  color: string;
  size: number;
  platformMix: PlatformShare[];
  topTopics: { topicId: string; name: string; posts: number }[];
  sentiment: SentimentSummary;
  /** Fraction of edges that stay inside the community (0–1) */
  cohesion: number;
  hubNodeIds: string[];
}

export interface PropagationHop {
  nodeId: string;
  at: string;
  via?: EdgeType;
}

export interface PropagationPath {
  id: string;
  topicId: string;
  topicName: string;
  label: string;
  hops: PropagationHop[];
  edgeIds: string[];
  startedAt: string;
  durationMinutes: number;
  platformsCrossed: number;
  communitiesCrossed: number;
  /** Distinct graph nodes adjacent to the path (indexed graph only) */
  nodesReached: number;
  seedPostId?: string;
}

export interface NetworkMetrics {
  nodeCount: number;
  edgeCount: number;
  communityCount: number;
  /** Directed density: edges / (n × (n − 1)) */
  density: number;
  avgDegree: number;
}

export interface NetworkGraph {
  topicId?: string;
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  communities: Community[];
  propagationPaths: PropagationPath[];
  metrics: NetworkMetrics;
}

export interface NetworkQuery {
  topicId?: string | "all";
}

/* ───────────────────────── Alerts ───────────────────────── */

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type AlertStatus = "new" | "investigating" | "resolved";

export interface AlertStatusEvent {
  ts: string;
  status: AlertStatus;
  note: string;
  actor: "system" | "analyst";
}

export interface Alert {
  id: string;
  topicId: string;
  topicName: string;
  trendId: string;
  severity: AlertSeverity;
  status: AlertStatus;
  createdAt: string;
  updatedAt: string;
  confidence: number;
  /** 0–1 weighted sum of fired signals at creation time */
  score: number;
  platforms: Platform[];
  /** One-line trigger reason */
  triggerReason: string;
  /** Plain-language bullets for "Why was this alert generated?" */
  whyBullets: string[];
  /** Full rule-by-rule evaluation at creation time (fired and not fired) */
  evidence: SignalEvaluation[];
  mentionsPerHourAtAlert: number;
  mentionsPerHourNow: number;
  history: AlertStatusEvent[];
}

export interface AlertDetail extends Alert {
  trend: TrendSummary;
  timeline: TimePoint[];
  supportingPosts: SocialPost[];
}

export interface AlertQuery {
  status?: AlertStatus | "all" | "active";
  severity?: AlertSeverity | "all";
}

export interface AlertStatusUpdate {
  status: AlertStatus;
  note?: string;
}

/* ───────────────────────── Overview ───────────────────────── */

export interface SourceStatus {
  platform: Platform;
  label: string;
  /** Feed provenance — never claim "live" for simulated data */
  mode: ImplementationStatus;
  postsPerHour: number;
  lastEventAt: string;
}

export interface ActivityPoint extends TimePoint {
  /** Mentions/hour for the currently emerging topic (0 when none) */
  emerging: number;
}

export interface OverviewKpis {
  postsAnalyzed24h: number;
  postsAnalyzedPrev24h: number;
  activeTopics: number;
  emergingTrends: number;
  risingTrends: number;
  activeAlerts: number;
  highSeverityAlerts: number;
  fastestTrend: {
    trendId: string;
    name: string;
    growthRate: number;
    mentionsPerHour: number;
  } | null;
}

export interface OverviewSummary {
  windowStart: string;
  windowEnd: string;
  windowHours: number;
  kpis: OverviewKpis;
  activity: ActivityPoint[];
  /** Name of the topic drawn as the highlighted line on the activity chart */
  emergingTopicName: string | null;
  /** Timestamp of the alert to annotate on the activity chart */
  alertMarkerAt: string | null;
  platformDistribution: PlatformShare[];
  sources: SourceStatus[];
}
