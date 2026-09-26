"""
Pydantic response schemas — the exact JSON contract the frontend already
expects (mirrors src/types/index.ts field-for-field). alias_generator
converts snake_case to camelCase on the way out; populate_by_name lets
routers build these from either name; from_attributes lets them build
straight off ORM rows where useful.
"""
from __future__ import annotations

from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel

Platform = Literal["x", "telegram"]
Sentiment = Literal["positive", "neutral", "negative"]
ImplementationStatus = Literal["implemented", "simulated", "future"]
SignalKey = Literal[
    "volume_growth", "sustained_growth", "cross_platform",
    "sentiment_shift", "community_spread", "engagement",
]
TrendStatus = Literal["emerging", "rising", "stable", "declining"]
AlertSeverity = Literal["low", "medium", "high", "critical"]
AlertStatus = Literal["new", "investigating", "resolved"]
NodeType = Literal["user", "channel"]
NodeRole = Literal["hub", "bridge", "member"]
EdgeType = Literal["retweet", "reply", "mention", "forward", "cross_post"]


class Camel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


T = TypeVar("T")


class Paginated(Camel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int


# ───────────────────────── Primitives ─────────────────────────

class TopicRef(Camel):
    id: str
    name: str


class CommunityRef(Camel):
    id: str
    name: str
    color: str


# ───────────────────────── Posts ─────────────────────────

class Engagement(Camel):
    likes: int | None = None
    replies: int | None = None
    shares: int | None = None
    views: int | None = None


class SocialPost(Camel):
    id: str
    platform: Platform
    author_id: str
    author_name: str
    text: str
    timestamp: str
    engagement: Engagement
    hashtags: list[str]
    language: str
    topic: TopicRef | None = None
    sentiment: Sentiment | None = None
    sentiment_score: float | None = None
    community: CommunityRef | None = None


# ───────────────────────── Topics ─────────────────────────

class Topic(Camel):
    id: str
    name: str
    category: str
    description: str
    keywords: list[str]
    platforms: list[Platform]
    mentions_24h: int
    mentions_per_hour: int


# ───────────────────────── Sentiment ─────────────────────────

class SentimentCounts(Camel):
    positive: int
    neutral: int
    negative: int


class SentimentSummary(Camel):
    counts: SentimentCounts
    total: int
    positive_pct: float
    neutral_pct: float
    negative_pct: float
    net_score: float


class SentimentPoint(SentimentSummary):
    ts: str


class PlatformSentiment(Camel):
    platform: Platform
    summary: SentimentSummary


class TopicSentiment(Camel):
    topic_id: str
    topic_name: str
    summary: SentimentSummary


class SentimentChange(Camel):
    topic_id: str
    topic_name: str
    trend_id: str
    net_now: float
    net_before: float
    delta: float
    negative_pct_now: float
    negative_pct_before: float
    direction: Literal["worsening", "improving", "steady"]
    significant: bool
    mentions_per_hour: int


class SentimentReport(Camel):
    overall: SentimentSummary
    previous: SentimentSummary
    timeline: list[SentimentPoint]
    by_platform: list[PlatformSentiment]
    by_topic: list[TopicSentiment]
    changes: list[SentimentChange]
    window_hours: int


# ───────────────────────── Trends ─────────────────────────

class PlatformShare(Camel):
    platform: Platform
    mentions: int
    share_pct: float


class TimePoint(Camel):
    ts: str
    total: int
    x: int
    telegram: int


class SignalEvaluation(Camel):
    key: SignalKey
    label: str
    observed: str
    threshold: str
    fired: bool
    score: float
    weight: float
    explanation: str


class RelatedKeyword(Camel):
    term: str
    weight: float
    mentions: int
    first_seen_at: str | None = None
    is_new: bool


class PlatformComparison(Camel):
    platform: Platform
    mentions_24h: int
    share_pct: float
    negative_pct: float
    avg_engagement: int
    first_seen_at: str | None = None


class TrendCommunity(CommunityRef):
    post_count: int
    share_pct: float
    joined_at: str
    dominant_sentiment: Sentiment


class TrendMilestone(Camel):
    ts: str
    kind: Literal["detected", "platform", "alert", "community", "current"]
    label: str
    detail: str
    mentions_per_hour: int | None = None


class TrendSummary(Camel):
    id: str
    topic_id: str
    name: str
    category: str
    status: TrendStatus
    trend_score: int
    confidence: float
    mentions_per_hour: int
    mentions_24h: int
    growth_rate: float
    velocity: float
    sentiment: SentimentSummary
    platforms: list[PlatformShare]
    first_detected_at: str | None = None
    keywords: list[str]
    sparkline: list[int]
    alert_ids: list[str]


class TrendDetail(TrendSummary):
    description: str
    baseline: int
    timeline: list[TimePoint]
    sentiment_timeline: list[SentimentPoint]
    platform_comparison: list[PlatformComparison]
    related_keywords: list[RelatedKeyword]
    signals: list[SignalEvaluation]
    communities: list[TrendCommunity]
    milestones: list[TrendMilestone]
    evidence: list[str]


# ───────────────────────── Network ─────────────────────────

class NetworkNode(Camel):
    id: str
    label: str
    type: NodeType
    platform: Platform
    community_id: str
    role: NodeRole
    degree: int
    in_degree: int
    out_degree: int
    influence: float
    community_reach: int
    post_count: int
    topic_ids: list[str]


class NetworkEdge(Camel):
    id: str
    source: str
    target: str
    type: EdgeType
    weight: float
    timestamp: str | None = None
    on_propagation_path: bool | None = None


class Community(Camel):
    id: str
    name: str
    description: str
    color: str
    size: int
    platform_mix: list[PlatformShare]
    top_topics: list[dict]
    sentiment: SentimentSummary
    cohesion: float
    hub_node_ids: list[str]


class PropagationHop(Camel):
    node_id: str
    at: str
    via: EdgeType | None = None


class PropagationPath(Camel):
    id: str
    topic_id: str
    topic_name: str
    label: str
    hops: list[PropagationHop]
    edge_ids: list[str]
    started_at: str
    duration_minutes: int
    platforms_crossed: int
    communities_crossed: int
    nodes_reached: int
    seed_post_id: str | None = None


class NetworkMetrics(Camel):
    node_count: int
    edge_count: int
    community_count: int
    density: float
    avg_degree: float


class NetworkGraph(Camel):
    topic_id: str | None = None
    nodes: list[NetworkNode]
    edges: list[NetworkEdge]
    communities: list[Community]
    propagation_paths: list[PropagationPath]
    metrics: NetworkMetrics


# ───────────────────────── Alerts ─────────────────────────

class AlertStatusEvent(Camel):
    ts: str
    status: AlertStatus
    note: str
    actor: Literal["system", "analyst"]


class AlertOut(Camel):
    id: str
    topic_id: str
    topic_name: str
    trend_id: str
    severity: AlertSeverity
    status: AlertStatus
    created_at: str
    updated_at: str
    confidence: float
    score: float
    platforms: list[Platform]
    trigger_reason: str
    why_bullets: list[str]
    evidence: list[SignalEvaluation]
    mentions_per_hour_at_alert: int
    mentions_per_hour_now: int
    history: list[AlertStatusEvent]


class AlertDetail(AlertOut):
    trend: TrendSummary
    timeline: list[TimePoint]
    supporting_posts: list[SocialPost]


class AlertStatusUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
    status: AlertStatus
    note: str | None = None


# ───────────────────────── Overview ─────────────────────────

class SourceStatus(Camel):
    platform: Platform
    label: str
    mode: ImplementationStatus
    posts_per_hour: int
    last_event_at: str


class ActivityPoint(TimePoint):
    emerging: int


class FastestTrend(Camel):
    trend_id: str
    name: str
    growth_rate: float
    mentions_per_hour: int


class OverviewKpis(Camel):
    posts_analyzed_24h: int
    posts_analyzed_prev_24h: int
    active_topics: int
    emerging_trends: int
    rising_trends: int
    active_alerts: int
    high_severity_alerts: int
    fastest_trend: FastestTrend | None = None


class OverviewSummary(Camel):
    window_start: str
    window_end: str
    window_hours: int
    kpis: OverviewKpis
    activity: list[ActivityPoint]
    emerging_topic_name: str | None = None
    alert_marker_at: str | None = None
    platform_distribution: list[PlatformShare]
    sources: list[SourceStatus]
