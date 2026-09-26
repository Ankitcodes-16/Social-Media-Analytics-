"""
The six explainable detection signals.

This is a direct Python port of the frontend's `src/data/mock/signals.ts` —
same weights, same thresholds, same plain-language explanations — because
that file is written as "the executable specification of the scoring
that the Phase 4 pipeline will implement in Python". This module keeps
that promise: it's now the one place (used by both trends and alerts)
that decides whether a signal fires.
"""
from __future__ import annotations

from app.seed.aggregate import bucket_counts, bucket_total, clamp, counts_total, median

SIGNAL_WEIGHTS = {
    "volume_growth": 0.30,
    "sustained_growth": 0.15,
    "cross_platform": 0.20,
    "sentiment_shift": 0.15,
    "community_spread": 0.10,
    "engagement": 0.10,
}

SIGNAL_LABELS = {
    "volume_growth": "Mention volume growth",
    "sustained_growth": "Sustained growth",
    "cross_platform": "Cross-platform spread",
    "sentiment_shift": "Negative sentiment shift",
    "community_spread": "Community spread",
    "engagement": "Engagement above baseline",
}


def total_engagement(post: dict) -> int:
    return (post.get("likes") or 0) + (post.get("replies") or 0) + (post.get("shares") or 0)


def build_context(hourly: dict[str, list[dict]], posts: list[dict]) -> dict:
    return {
        "hourly": hourly,
        "posts": posts,
        "globalMedianEngagement": median([total_engagement(p) for p in posts]),
    }


def _signed(n: float, digits: int = 0) -> str:
    return f"{'+' if n >= 0 else '−'}{abs(n):.{digits}f}"


def evaluate_signals(ctx: dict, topic_id: str, e: int, bucket_start_ms, bucket_end_ms) -> list[dict]:
    """Evaluate the six signals for `topic_id` at bucket `e` (the "current" hour)."""
    h = ctx["hourly"][topic_id]

    def v(i: int) -> int:
        return bucket_total(h[max(0, i)])

    # 1 — volume growth
    cur = v(e)
    ref = v(e - 6)
    growth = (cur - ref) / max(ref, 1) * 100
    volume_fired = growth >= 150 and cur >= 60
    volume_score = clamp(growth / 400, 0, 1) * min(1, cur / 60)
    volume = {
        "key": "volume_growth",
        "label": SIGNAL_LABELS["volume_growth"],
        "observed": f"{ref} → {cur} mentions/hour ({_signed(growth)}%)",
        "threshold": "≥ +150% vs 6 hours earlier and ≥ 60 mentions/hour",
        "fired": volume_fired,
        "score": round(volume_score, 2),
        "weight": SIGNAL_WEIGHTS["volume_growth"],
        "explanation": (
            f"Mentions per hour rose from {ref} to {cur} over six hours, well above the +150% growth threshold."
            if volume_fired
            else (
                f"Growth of {_signed(growth)}% is large, but {cur} mentions/hour is below the 60/hour volume "
                "floor, so it is treated as a low-volume signal."
                if growth >= 150
                else f"Growth of {_signed(growth)}% versus six hours earlier is below the +150% threshold."
            )
        ),
    }

    # 2 — sustained growth
    streak = 0
    while e - streak - 1 >= 0 and v(e - streak) > v(e - streak - 1):
        streak += 1
    sustained_fired = streak >= 3
    sustained = {
        "key": "sustained_growth",
        "label": SIGNAL_LABELS["sustained_growth"],
        "observed": f"{streak} consecutive hourly increase{'' if streak == 1 else 's'}",
        "threshold": "≥ 3 consecutive hourly increases",
        "fired": sustained_fired,
        "score": round(clamp(streak / 6, 0, 1), 2),
        "weight": SIGNAL_WEIGHTS["sustained_growth"],
        "explanation": (
            f"Volume has climbed for {streak} hours in a row, which separates a real trend from a one-hour spike."
            if sustained_fired
            else f"Only {streak} consecutive hourly increase{'' if streak == 1 else 's'}; growth is not yet sustained."
        ),
    }

    # 3 — cross-platform spread (last 3 hours)
    x_sum = sum(bucket_total(h[i], "x") for i in range(max(0, e - 2), e + 1))
    tg_sum = sum(bucket_total(h[i], "telegram") for i in range(max(0, e - 2), e + 1))
    plat_total = max(1, x_sum + tg_sum)
    x_pct = x_sum / plat_total * 100
    tg_pct = 100 - x_pct
    min_share = min(x_pct, tg_pct) / 100
    cross_fired = min_share >= 0.15
    dominant = "X" if x_pct >= tg_pct else "Telegram"
    lesser = "Telegram" if x_pct >= tg_pct else "X"
    cross = {
        "key": "cross_platform",
        "label": SIGNAL_LABELS["cross_platform"],
        "observed": f"X {round(x_pct)}% · Telegram {round(tg_pct)}% (last 3 hours)",
        "threshold": "each platform ≥ 15% of mentions",
        "fired": cross_fired,
        "score": round(clamp(min_share / 0.4, 0, 1), 2),
        "weight": SIGNAL_WEIGHTS["cross_platform"],
        "explanation": (
            "The topic is active on both platforms, so it is spreading beyond a single audience."
            if cross_fired
            else f"{lesser} accounts for only {round(min(x_pct, tg_pct))}% of mentions; the topic is still confined mainly to {dominant}."
        ),
    }

    # 4 — negative sentiment shift
    def neg_pct_at(i: int) -> float:
        c = bucket_counts(h[max(0, i)])
        t = counts_total(c)
        return 0.0 if t == 0 else c["negative"] / t * 100

    neg_now = neg_pct_at(e)
    neg_before = neg_pct_at(e - 6)
    delta = neg_now - neg_before
    sentiment_fired = delta >= 15
    sentiment = {
        "key": "sentiment_shift",
        "label": SIGNAL_LABELS["sentiment_shift"],
        "observed": f"Negative share {round(neg_before)}% → {round(neg_now)}% ({_signed(delta)} pp)",
        "threshold": "negative share up ≥ 15 percentage points vs 6 hours earlier",
        "fired": sentiment_fired,
        "score": round(clamp(delta / 40, 0, 1), 2),
        "weight": SIGNAL_WEIGHTS["sentiment_shift"],
        "explanation": (
            f"The share of negative posts rose by {round(delta, 1)} percentage points in six hours, so reactions are turning against the situation."
            if sentiment_fired
            else f"Negative share moved by {_signed(delta, 1)} pp, below the 15 pp shift threshold."
        ),
    }

    # 5 — community spread (last 6 hours)
    frm = bucket_start_ms(max(0, e - 5))
    to = bucket_end_ms(e)
    by_community: dict[str, dict] = {}
    for p in ctx["posts"]:
        if p.get("topic_id") != topic_id or not p.get("community_id"):
            continue
        ts = p["timestampMs"]
        if ts < frm or ts >= to:
            continue
        entry = by_community.setdefault(p["community_id"], {"name": p.get("community_name", p["community_id"]), "n": 0})
        entry["n"] += 1
    active = [c for c in by_community.values() if c["n"] >= 3]
    community_fired = len(active) >= 3
    community = {
        "key": "community_spread",
        "label": SIGNAL_LABELS["community_spread"],
        "observed": f"{len(active)} communit{'y' if len(active) == 1 else 'ies'} with ≥ 3 indexed posts (last 6 hours)",
        "threshold": "≥ 3 distinct communities engaged",
        "fired": community_fired,
        "score": round(clamp(len(active) / 4, 0, 1), 2),
        "weight": SIGNAL_WEIGHTS["community_spread"],
        "explanation": (
            "No community has produced enough indexed posts about this topic yet."
            if len(active) == 0
            else (
                f"Active in {', '.join(c['name'] for c in active)}"
                + (", so the topic has crossed community boundaries." if community_fired else "; it has not yet crossed enough community boundaries.")
            )
        ),
    }

    # 6 — engagement above baseline (last 3 hours)
    eng_from = bucket_start_ms(max(0, e - 2))
    recent = [
        total_engagement(p)
        for p in ctx["posts"]
        if p.get("topic_id") == topic_id and eng_from <= p["timestampMs"] < to
    ]
    global_median = ctx["globalMedianEngagement"]
    mult = 0.0 if not recent or global_median == 0 else median(recent) / global_median
    engagement_fired = mult >= 2
    engagement = {
        "key": "engagement",
        "label": SIGNAL_LABELS["engagement"],
        "observed": f"{mult:.2f}× typical post engagement (median, last 3 hours)",
        "threshold": "median engagement ≥ 2× the typical indexed post",
        "fired": engagement_fired,
        "score": round(clamp(mult / 3, 0, 1), 2),
        "weight": SIGNAL_WEIGHTS["engagement"],
        "explanation": (
            f"Posts on this topic are drawing {mult:.2f}× the usual engagement, a sign that people are actively amplifying it."
            if engagement_fired
            else f"Median engagement is {mult:.2f}× the typical post, below the 2× threshold: amplification is not unusual yet."
        ),
    }

    return [volume, sustained, cross, sentiment, community, engagement]


def composite_score(signals: list[dict]) -> float:
    return round(sum(s["weight"] * s["score"] for s in signals), 2)


def compute_confidence(ctx: dict, topic_id: str, e: int, signals: list[dict]) -> float:
    """Data sufficiency + signal agreement + platform coverage, 0-1."""
    h = ctx["hourly"][topic_id]
    cur = bucket_total(h[e])
    x = sum(bucket_total(h[i], "x") for i in range(max(0, e - 2), e + 1))
    tg = sum(bucket_total(h[i], "telegram") for i in range(max(0, e - 2), e + 1))
    total = max(1, x + tg)
    platforms_present = (1 if x / total >= 0.05 else 0) + (1 if tg / total >= 0.05 else 0)
    fired = sum(1 for s in signals if s["fired"])
    return round(clamp(0.45 * min(1, cur / 150) + 0.35 * (fired / 6) + 0.2 * (platforms_present / 2), 0, 1), 2)
