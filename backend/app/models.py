"""
SQLAlchemy ORM models.

Everything the six-signal detector and the trend/alert views need is
persisted here, generated once by `app/seed/build.py` from the same
coherent scenario the Phase 1 frontend mocked, and served by the routers
in `app/routers/`. `Topic.hourly` is the one deliberate simplification:
it stores the topic's already-aggregated 48-hour mention/sentiment time
series as JSONB rather than one row per post per hour. That's the
realistic shape for this phase (a pre-aggregated feed), and it's exactly
the artifact a real ingestion + aggregation pipeline (Phase 3/4) would
produce and this table would then be populated by rather than a
generator; nothing above it needs to change.
"""
from __future__ import annotations

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Topic(Base):
    __tablename__ = "topics"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    keywords: Mapped[list] = mapped_column(JSON, nullable=False)  # [{term, weight, firstSeenBucket}]
    platforms: Mapped[list] = mapped_column(JSON, nullable=False)  # ["x", "telegram"]
    # 48 hourly buckets: [{ts, x:{positive,neutral,negative}, telegram:{...}}]
    hourly: Mapped[list] = mapped_column(JSON, nullable=False)

    posts: Mapped[list["Post"]] = relationship(back_populates="topic")
    alerts: Mapped[list["Alert"]] = relationship(back_populates="topic")


class Community(Base):
    __tablename__ = "communities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)

    nodes: Mapped[list["Node"]] = relationship(back_populates="community")


class Node(Base):
    """An account (X) or channel (Telegram). Degree/influence/role are
    computed once at seed time from the generated edge set and cached
    here, the way a graph-analytics batch job would."""

    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    label: Mapped[str] = mapped_column(String, nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # user | channel
    platform: Mapped[str] = mapped_column(String, nullable=False)
    community_id: Mapped[str] = mapped_column(ForeignKey("communities.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # hub | bridge | member
    in_degree: Mapped[int] = mapped_column(Integer, default=0)
    out_degree: Mapped[int] = mapped_column(Integer, default=0)
    influence: Mapped[float] = mapped_column(Float, default=0.0)
    community_reach: Mapped[int] = mapped_column(Integer, default=0)
    topic_ids: Mapped[list] = mapped_column(JSON, default=list)

    community: Mapped["Community"] = relationship(back_populates="nodes")


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    source_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False)
    target_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False)
    type: Mapped[str] = mapped_column(String, nullable=False)  # retweet|reply|mention|forward|cross_post
    weight: Mapped[float] = mapped_column(Float, default=1.0)
    timestamp: Mapped[str | None] = mapped_column(String, nullable=True)
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True)
    on_propagation_path: Mapped[bool] = mapped_column(Boolean, default=False)


class PropagationPath(Base):
    __tablename__ = "propagation_paths"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), nullable=False)
    label: Mapped[str] = mapped_column(String, nullable=False)
    hops: Mapped[list] = mapped_column(JSON, nullable=False)  # [{nodeId, at, via}]
    edge_ids: Mapped[list] = mapped_column(JSON, nullable=False)
    started_at: Mapped[str] = mapped_column(String, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    platforms_crossed: Mapped[int] = mapped_column(Integer, nullable=False)
    communities_crossed: Mapped[int] = mapped_column(Integer, nullable=False)
    nodes_reached: Mapped[int] = mapped_column(Integer, nullable=False)
    seed_post_id: Mapped[str | None] = mapped_column(String, nullable=True)


class Post(Base):
    __tablename__ = "posts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    platform: Mapped[str] = mapped_column(String, nullable=False)
    author_id: Mapped[str] = mapped_column(ForeignKey("nodes.id"), nullable=False)
    author_name: Mapped[str] = mapped_column(String, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp: Mapped[str] = mapped_column(String, nullable=False, index=True)
    likes: Mapped[int] = mapped_column(Integer, default=0)
    replies: Mapped[int] = mapped_column(Integer, default=0)
    shares: Mapped[int] = mapped_column(Integer, default=0)
    views: Mapped[int] = mapped_column(Integer, default=0)
    hashtags: Mapped[list] = mapped_column(JSON, default=list)
    language: Mapped[str] = mapped_column(String, default="en")
    topic_id: Mapped[str | None] = mapped_column(ForeignKey("topics.id"), nullable=True, index=True)
    sentiment: Mapped[str | None] = mapped_column(String, nullable=True)
    sentiment_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    community_id: Mapped[str | None] = mapped_column(ForeignKey("communities.id"), nullable=True)

    topic: Mapped["Topic"] = relationship(back_populates="posts")


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    topic_id: Mapped[str] = mapped_column(ForeignKey("topics.id"), nullable=False)
    trend_id: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="new")
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[float] = mapped_column(Float, nullable=False)
    platforms: Mapped[list] = mapped_column(JSON, nullable=False)
    trigger_reason: Mapped[str] = mapped_column(Text, nullable=False)
    why_bullets: Mapped[list] = mapped_column(JSON, nullable=False)
    evidence: Mapped[list] = mapped_column(JSON, nullable=False)  # frozen SignalEvaluation[] snapshot
    mentions_per_hour_at_alert: Mapped[int] = mapped_column(Integer, nullable=False)
    bucket_index: Mapped[int] = mapped_column(Integer, nullable=False)  # bucket the alert fired at
    history: Mapped[list] = mapped_column(JSON, nullable=False)  # AlertStatusEvent[], newest last

    topic: Mapped["Topic"] = relationship(back_populates="alerts")


class Meta(Base):
    """Single-row table holding the scenario anchor time, so `mockNow()`-style
    relative timestamps stay stable across the life of a seeded dataset."""

    __tablename__ = "meta"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False)
