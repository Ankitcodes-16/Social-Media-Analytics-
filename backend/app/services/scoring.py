"""
Runtime scoring: builds TrendSummary/TrendDetail/OverviewSummary/
SentimentReport straight from what's in Postgres (Topic.hourly + Post
rows + Alert rows), the same way `src/data/mock/trends.ts` and
`src/data/mock/queries.ts` build them from the in-memory mock dataset.
Recomputing per request is deliberate and cheap at this dataset's size
(a few thousand rows); a production Phase 4 would cache/materialise this.
"""
from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert as AlertRow
from app.models import Post as PostRow
from app.models import Topic as TopicRow
from app.seed.aggregate import bucket_counts, bucket_total, mean, median, summarize, sum_range
from app.seed.network import COMMUNITIES
from app.seed.scenario import (
    BUCKETS,
    MINUTE,
    NOW_INDEX,
    SCENARIO_NOW,
    WINDOW_START_INDEX,
    bucket_end,
    bucket_start,
    iso,
)
from app.seed.signals import SIGNAL_WEIGHTS, build_context, composite_score, compute_confidence, evaluate_signals, total_engagement
from app.seed.topics import TOPIC_SPECS_BY_ID, trend_id_of

COMMUNITY_BY_ID = {c["id"]: c for c in COMMUNITIES}
DETECTION_SCORE = 0.6


def _bucket_ms(i: int) -> float:
    return bucket_start(i).timestamp() * 1000


def _bucket_end_ms(i: int) -> float:
    return bucket_end(i).timestamp() * 1000


def load_context(db: Session) -> dict:
    """Everything the scorer needs, loaded once per request."""
    topics = db.execute(select(TopicRow)).scalars().all()
    hourly = {t.id: t.hourly for t in topics}
    post_rows = db.execute(select(PostRow)).scalars().all()
    posts = []
    for p in post_rows:
        ts_ms = _parse_iso_ms(p.timestamp)
        posts.append(
            {
                "id": p.id, "platform": p.platform, "author_id": p.author_id, "author_name": p.author_name,
                "text": p.text, "timestamp": p.timestamp, "timestampMs": ts_ms,
                "likes": p.likes, "replies": p.replies, "shares": p.shares, "views": p.views,
                "hashtags": p.hashtags, "language": p.language, "topic_id": p.topic_id,
                "sentiment": p.sentiment, "sentiment_score": p.sentiment_score, "community_id": p.community_id,
                "community_name": COMMUNITY_BY_ID.get(p.community_id, {}).get("name", p.community_id),
            }
        )
    ctx = build_context(hourly, posts)
    ctx["topics"] = {t.id: t for t in topics}
    return ctx


def _parse_iso_ms(ts: str) -> float:
    from datetime import datetime

    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000


def _signals_at(ctx: dict, topic_id: str, e: int) -> list[dict]:
    return evaluate_signals(ctx, topic_id, e, _bucket_ms, _bucket_end_ms)


def social_post_dict(p: dict) -> dict:
    return {
        "id": p["id"], "platform": p["platform"], "author_id": p["author_id"], "author_name": p["author_name"],
        "text": p["text"], "timestamp": p["timestamp"],
        "engagement": {"likes": p["likes"], "replies": p["replies"], "shares": p["shares"], "views": p["views"]},
        "hashtags": p["hashtags"], "language": p["language"],
        "topic": {"id": p["topic_id"], "name": TOPIC_SPECS_BY_ID[p["topic_id"]].name} if p.get("topic_id") in TOPIC_SPECS_BY_ID else None,
        "sentiment": p.get("sentiment"), "sentiment_score": p.get("sentiment_score"),
        "community": (
            {"id": p["community_id"], "name": COMMUNITY_BY_ID[p["community_id"]]["name"], "color": COMMUNITY_BY_ID[p["community_id"]]["color"]}
            if p.get("community_id") in COMMUNITY_BY_ID else None
        ),
    }


def build_trend_detail(ctx: dict, topic_id: str, alerts_for_topic: list[AlertRow]) -> dict:
    spec = TOPIC_SPECS_BY_ID[topic_id]
    h = ctx["hourly"][topic_id]
    now = NOW_INDEX
    v = [bucket_total(b) for b in h]
    cur = v[now]
    ref6 = v[now - 6]
    growth_rate = round((cur - ref6) / max(ref6, 1) * 100, 1)
    velocity = round((v[now] - v[now - 3]) / 3, 1)
    signals = _signals_at(ctx, topic_id, now)
    score = composite_score(signals)
    confidence = compute_confidence(ctx, topic_id, now, signals)
    baseline = round(median(v))

    detected_bucket = -1
    for e in range(6, now + 1):
        if composite_score(_signals_at(ctx, topic_id, e)) >= DETECTION_SCORE:
            detected_bucket = e
            break

    candidates = []
    if detected_bucket >= 0:
        candidates.append((bucket_end(detected_bucket) + 5 * MINUTE).timestamp() * 1000)
    for a in alerts_for_topic:
        candidates.append(_parse_iso_ms(a.created_at))
    detected_ms = min(candidates) if candidates else None

    window_start_ms = bucket_start(WINDOW_START_INDEX).timestamp() * 1000
    if detected_ms is not None and growth_rate >= 100 and cur >= 25:
        status = "emerging"
    elif growth_rate >= 25:
        status = "rising"
    elif growth_rate <= -20:
        status = "declining"
    else:
        status = "stable"
    first_detected_at = (
        iso_from_ms(detected_ms) if status in ("emerging", "rising") and detected_ms is not None and detected_ms >= window_start_ms else None
    )

    x24 = sum(bucket_total(h[i], "x") for i in range(WINDOW_START_INDEX, now + 1))
    tg24 = sum(bucket_total(h[i], "telegram") for i in range(WINDOW_START_INDEX, now + 1))
    mentions_24h = x24 + tg24
    platforms = [
        {"platform": "x", "mentions": x24, "sharePct": round(x24 / max(1, mentions_24h) * 100, 1)},
        {"platform": "telegram", "mentions": tg24, "sharePct": round(tg24 / max(1, mentions_24h) * 100, 1)},
    ]
    sentiment = summarize(sum_range(h, WINDOW_START_INDEX, now))

    timeline, sentiment_timeline = [], []
    for i in range(WINDOW_START_INDEX, now + 1):
        timeline.append({"ts": h[i]["ts"], "total": v[i], "x": bucket_total(h[i], "x"), "telegram": bucket_total(h[i], "telegram")})
        sentiment_timeline.append({"ts": h[i]["ts"], **summarize(bucket_counts(h[i]))})

    onset = _onset_bucket(v, baseline)
    from_bucket = max(WINDOW_START_INDEX, onset) if onset >= 0 else WINDOW_START_INDEX
    from_ms = bucket_start(from_bucket).timestamp() * 1000
    topic_posts = [p for p in ctx["posts"] if p.get("topic_id") == topic_id]
    window_posts = [p for p in topic_posts if p["timestampMs"] >= window_start_ms]

    platform_comparison = []
    for ps in platforms:
        plat = ps["platform"]
        posts_p = [p for p in window_posts if p["platform"] == plat]
        first_seen_at = None
        for i in range(from_bucket, now + 1):
            share = bucket_total(h[i], plat) / max(1, v[i])
            if share >= 0.15 and v[i] >= 30:
                first_seen_at = iso(bucket_end(i))
                break
        platform_comparison.append(
            {
                "platform": plat, "mentions_24h": ps["mentions"], "share_pct": ps["sharePct"],
                "negative_pct": summarize(sum_range(h, WINDOW_START_INDEX, now, plat))["negativePct"],
                "avg_engagement": round(mean([total_engagement(p) for p in posts_p])),
                "first_seen_at": first_seen_at,
            }
        )

    related_keywords = [
        {
            "term": k["term"], "weight": k["weight"], "mentions": round(k["weight"] * mentions_24h * 0.55),
            "first_seen_at": bucket_start(k["firstSeenBucket"]).isoformat().replace("+00:00", "Z") if "firstSeenBucket" in k else None,
            "is_new": "firstSeenBucket" in k and k["firstSeenBucket"] >= now - 5,
        }
        for k in spec.keywords
    ]

    community_posts = [p for p in topic_posts if p["timestampMs"] >= from_ms]
    by_community: dict[str, dict] = {}
    for p in community_posts:
        if not p.get("community_id"):
            continue
        entry = by_community.setdefault(p["community_id"], {"name": p["community_name"], "color": COMMUNITY_BY_ID.get(p["community_id"], {}).get("color", "#64748b"), "posts": []})
        entry["posts"].append(p)
    communities = []
    for cid, c in by_community.items():
        counts = {"positive": 0, "neutral": 0, "negative": 0}
        for p in c["posts"]:
            if p.get("sentiment"):
                counts[p["sentiment"]] += 1
        dominant = max(counts, key=lambda k: counts[k]) if any(counts.values()) else "neutral"
        joined_at = min(p["timestamp"] for p in c["posts"])
        communities.append(
            {
                "id": cid, "name": c["name"], "color": c["color"], "post_count": len(c["posts"]),
                "share_pct": round(len(c["posts"]) / max(1, len(community_posts)) * 100, 1),
                "joined_at": joined_at, "dominant_sentiment": dominant,
            }
        )
    communities.sort(key=lambda c: c["post_count"], reverse=True)

    milestones = []
    if status in ("emerging", "rising"):
        if detected_bucket >= 0 and (bucket_end(detected_bucket) + 5 * MINUTE).timestamp() * 1000 >= window_start_ms:
            milestones.append(
                {
                    "ts": iso(bucket_end(detected_bucket) + 5 * MINUTE), "kind": "detected", "label": "First detected",
                    "detail": f"Trend score reached {round(DETECTION_SCORE * 100)} at {v[detected_bucket]} mentions/hour.",
                    "mentions_per_hour": v[detected_bucket],
                }
            )
        lesser = min(platform_comparison, key=lambda pc: pc["share_pct"])
        if lesser["first_seen_at"] and _parse_iso_ms(lesser["first_seen_at"]) >= window_start_ms and onset >= 0:
            label = "X" if lesser["platform"] == "x" else "Telegram"
            milestones.append({"ts": lesser["first_seen_at"], "kind": "platform", "label": f"Spreads to {label}", "detail": f"{label} now carries a substantial share of hourly mentions.", "mentions_per_hour": None})
        for a in alerts_for_topic:
            fired_n = sum(1 for s in a.evidence if s["fired"])
            milestones.append({"ts": a.created_at, "kind": "alert", "label": "Alert generated", "detail": f"{a.id} · {a.severity} severity · {fired_n} of {len(a.evidence)} signals fired.", "mentions_per_hour": a.mentions_per_hour_at_alert})
        if len(communities) >= 3 and onset >= 0:
            last = sorted(communities, key=lambda c: c["joined_at"], reverse=True)[0]
            milestones.append({"ts": last["joined_at"], "kind": "community", "label": f"{last['name']} joins", "detail": f"{len(communities)} communities are now discussing the topic.", "mentions_per_hour": None})
    milestones.append({"ts": iso(SCENARIO_NOW), "kind": "current", "label": "Latest complete hour", "detail": f"{cur} mentions/hour · {sentiment['negativePct']}% negative over 24h.", "mentions_per_hour": cur})
    milestones.sort(key=lambda m: m["ts"])

    fired = [s for s in signals if s["fired"]]
    x3 = sum(bucket_total(h[i], "x") for i in range(now - 2, now + 1))
    tg3 = sum(bucket_total(h[i], "telegram") for i in range(now - 2, now + 1))
    t3 = max(1, x3 + tg3)
    platforms_present = (1 if x3 / t3 >= 0.05 else 0) + (1 if tg3 / t3 >= 0.05 else 0)
    evidence = [s["explanation"] for s in fired] or ["No detection signal has fired for this topic."]
    evidence.append(
        f"Trend score {round(score * 100)}/100 is the weighted sum of the six signal strengths "
        f"(volume {SIGNAL_WEIGHTS['volume_growth']*100:.0f}%, sustained growth {SIGNAL_WEIGHTS['sustained_growth']*100:.0f}%, "
        f"cross-platform {SIGNAL_WEIGHTS['cross_platform']*100:.0f}%, sentiment {SIGNAL_WEIGHTS['sentiment_shift']*100:.0f}%, "
        f"community {SIGNAL_WEIGHTS['community_spread']*100:.0f}%, engagement {SIGNAL_WEIGHTS['engagement']*100:.0f}%)."
    )
    evidence.append(
        f"Confidence {round(confidence * 100)}%: {cur} mentions/hour against a 150/hour data-sufficiency target, "
        f"{len(fired)} of {len(signals)} signals agree, {platforms_present} platform{'s' if platforms_present != 1 else ''} present."
    )
    low_reasons = []
    if cur < 60:
        low_reasons.append("volume is below the 60 mentions/hour floor")
    if min(x3, tg3) / t3 < 0.15:
        low_reasons.append("activity is concentrated on a single platform")
    if confidence < 0.5 and low_reasons:
        evidence.append(f"Kept as a watch item rather than an alert because {' and '.join(low_reasons)}.")

    topic_alert_ids = [a.id for a in alerts_for_topic]

    return {
        "id": trend_id_of(spec.id), "topic_id": spec.id, "name": spec.name, "category": spec.category,
        "description": spec.description, "status": status, "trend_score": round(score * 100),
        "confidence": confidence, "mentions_per_hour": cur, "mentions_24h": mentions_24h,
        "growth_rate": growth_rate, "velocity": velocity, "sentiment": sentiment, "platforms": platforms,
        "first_detected_at": first_detected_at,
        "keywords": [k["term"] for k in sorted(spec.keywords, key=lambda k: -k["weight"])[:5]],
        "sparkline": v[now - 11: now + 1], "alert_ids": topic_alert_ids,
        "baseline": baseline, "timeline": timeline, "sentiment_timeline": sentiment_timeline,
        "platform_comparison": platform_comparison, "related_keywords": related_keywords, "signals": signals,
        "communities": communities, "milestones": milestones, "evidence": evidence,
    }


def _onset_bucket(v: list[int], baseline: int) -> int:
    threshold = max(baseline * 2, baseline + 10)
    for i in range(1, len(v)):
        if v[i] >= threshold:
            return i
    return -1


def iso_from_ms(ms: float) -> str:
    from datetime import datetime, timezone

    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def trend_summary_fields(detail: dict) -> dict:
    keys = [
        "id", "topic_id", "name", "category", "status", "trend_score", "confidence", "mentions_per_hour",
        "mentions_24h", "growth_rate", "velocity", "sentiment", "platforms", "first_detected_at", "keywords",
        "sparkline", "alert_ids",
    ]
    return {k: detail[k] for k in keys}


def build_sentiment_report(ctx: dict) -> dict:
    from app.seed.aggregate import add_counts, empty_counts
    from app.seed.scenario import WINDOW_HOURS

    now = NOW_INDEX
    specs = list(TOPIC_SPECS_BY_ID.values())

    def sum_topics(frm: int, to: int, platform: str | None = None) -> dict:
        acc = empty_counts()
        for spec in specs:
            acc = add_counts(acc, sum_range(ctx["hourly"][spec.id], frm, to, platform))
        return acc

    timeline = []
    for i in range(WINDOW_START_INDEX, now + 1):
        counts = empty_counts()
        for spec in specs:
            counts = add_counts(counts, bucket_counts(ctx["hourly"][spec.id][i]))
        timeline.append({"ts": ctx["hourly"][specs[0].id][i]["ts"], **summarize(counts)})

    changes = []
    for spec in specs:
        h = ctx["hourly"][spec.id]
        now_summary = summarize(sum_range(h, now - 2, now))
        before_summary = summarize(sum_range(h, now - 8, now - 6))
        delta = round((now_summary["netScore"] - before_summary["netScore"]) * 10) / 10
        mph = bucket_total(h[now])
        changes.append(
            {
                "topic_id": spec.id, "topic_name": spec.name, "trend_id": trend_id_of(spec.id),
                "net_now": now_summary["netScore"], "net_before": before_summary["netScore"], "delta": delta,
                "negative_pct_now": now_summary["negativePct"], "negative_pct_before": before_summary["negativePct"],
                "direction": "worsening" if delta <= -10 else ("improving" if delta >= 10 else "steady"),
                "significant": abs(delta) >= 15 and mph >= 30, "mentions_per_hour": mph,
            }
        )
    changes.sort(key=lambda c: c["delta"])

    return {
        "window_hours": WINDOW_HOURS,
        "overall": summarize(sum_topics(WINDOW_START_INDEX, now)),
        "previous": summarize(sum_topics(0, WINDOW_START_INDEX - 1)),
        "timeline": timeline,
        "by_platform": [{"platform": p, "summary": summarize(sum_topics(WINDOW_START_INDEX, now, p))} for p in ("x", "telegram")],
        "by_topic": sorted(
            [{"topic_id": s.id, "topic_name": s.name, "summary": summarize(sum_range(ctx["hourly"][s.id], WINDOW_START_INDEX, now))} for s in specs],
            key=lambda t: t["summary"]["total"], reverse=True,
        ),
        "changes": changes,
    }


def build_overview(ctx: dict, all_trends: list[dict], alerts: list[AlertRow]) -> dict:
    emerging_candidates = sorted([t for t in all_trends if t["status"] == "emerging"], key=lambda t: -t["trend_score"])
    emerging = emerging_candidates[0] if emerging_candidates else None

    activity = []
    posts_24h = posts_prev = x24 = tg24 = 0
    for i in range(BUCKETS):
        x = sum(bucket_total(ctx["hourly"][s.id][i], "x") for s in TOPIC_SPECS_BY_ID.values())
        tg = sum(bucket_total(ctx["hourly"][s.id][i], "telegram") for s in TOPIC_SPECS_BY_ID.values())
        if i >= WINDOW_START_INDEX:
            posts_24h += x + tg
            x24 += x
            tg24 += tg
            activity.append(
                {
                    "ts": ctx["hourly"][next(iter(TOPIC_SPECS_BY_ID))][i]["ts"], "total": x + tg, "x": x, "telegram": tg,
                    "emerging": bucket_total(ctx["hourly"][emerging["topic_id"]][i]) if emerging else 0,
                }
            )
        else:
            posts_prev += x + tg

    active_alerts = [a for a in alerts if a.status != "resolved"]
    growing_candidates = sorted([t for t in all_trends if t["mentions_per_hour"] >= 25], key=lambda t: -t["growth_rate"])
    growing = growing_candidates[0] if growing_candidates else None
    marker = None
    if emerging:
        marker_candidates = sorted(a.created_at for a in alerts if a.topic_id == emerging["topic_id"])
        marker = marker_candidates[0] if marker_candidates else None

    platform_distribution = [
        {"platform": "x", "mentions": x24, "sharePct": round(x24 / max(1, posts_24h) * 100, 1)},
        {"platform": "telegram", "mentions": tg24, "sharePct": round(tg24 / max(1, posts_24h) * 100, 1)},
    ]
    last = activity[-1]

    return {
        "window_start": bucket_start(WINDOW_START_INDEX).isoformat().replace("+00:00", "Z"),
        "window_end": iso(SCENARIO_NOW),
        "window_hours": BUCKETS - WINDOW_START_INDEX,
        "kpis": {
            "posts_analyzed_24h": posts_24h,
            "posts_analyzed_prev_24h": posts_prev,
            "active_topics": sum(1 for t in all_trends if t["mentions_per_hour"] >= 25),
            "emerging_trends": sum(1 for t in all_trends if t["status"] == "emerging"),
            "rising_trends": sum(1 for t in all_trends if t["status"] == "rising"),
            "active_alerts": len(active_alerts),
            "high_severity_alerts": sum(1 for a in active_alerts if a.severity in ("high", "critical")),
            "fastest_trend": (
                {"trend_id": growing["id"], "name": growing["name"], "growth_rate": growing["growth_rate"], "mentions_per_hour": growing["mentions_per_hour"]}
                if growing else None
            ),
        },
        "activity": activity,
        "emerging_topic_name": emerging["name"] if emerging else None,
        "alert_marker_at": marker,
        "platform_distribution": platform_distribution,
        "sources": [
            {"platform": "x", "label": "X", "mode": "simulated", "posts_per_hour": last["x"], "last_event_at": iso(SCENARIO_NOW)},
            {"platform": "telegram", "label": "Telegram", "mode": "simulated", "posts_per_hour": last["telegram"], "last_event_at": iso(SCENARIO_NOW)},
        ],
    }
