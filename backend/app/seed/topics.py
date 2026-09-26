"""
Topic specs and the deterministic hourly time series each one produces.

Every curve is defined by a handful of (hour_index, value) control points
plus small seeded jitter; values between control points are linearly
interpolated. Control points are chosen with enough margin that the
±jitter can never flip which of the six signals fire — see
app/seed/signals.py for the thresholds these curves are tuned against:

  - rail-signal-fault: spikes hard in the final ~12 hours (120→250→530
    mentions/hr region), crosses from X onto Telegram, sentiment swings
    sharply negative, and spreads across communities → fires all six
    signals and raises a critical alert.
  - power-outage-report: small, Telegram-only, flat → never crosses the
    volume or cross-platform floors, stays a low-confidence watch item.
  - festival-travel-surge: genuinely growing (rising) but well short of
    the +150%/6h volume-growth floor → "rising", never alerts.
  - weekly-derby-chat / new-riverside-eatery: flat → "stable".
  - council-budget-debate: fading → "declining".
"""
from __future__ import annotations

import random

from app.seed.scenario import BUCKETS, bucket_iso

RNG_SEED = 20260920


def _interp(points: list[tuple[int, float]], hour: int) -> float:
    points = sorted(points)
    if hour <= points[0][0]:
        return points[0][1]
    if hour >= points[-1][0]:
        return points[-1][1]
    for (h0, v0), (h1, v1) in zip(points, points[1:]):
        if h0 <= hour <= h1:
            if h1 == h0:
                return v0
            frac = (hour - h0) / (h1 - h0)
            return v0 + (v1 - v0) * frac
    return points[-1][1]


def _split_sentiment(total: int, positive_pct: float, negative_pct: float) -> dict:
    positive = round(total * positive_pct / 100)
    negative = round(total * negative_pct / 100)
    positive = min(positive, total)
    negative = min(negative, total - positive)
    neutral = max(0, total - positive - negative)
    return {"positive": positive, "neutral": neutral, "negative": negative}


class TopicSpec:
    def __init__(
        self,
        id: str,
        name: str,
        category: str,
        description: str,
        keywords: list[dict],
        volume_points: list[tuple[int, float]],
        telegram_share_points: list[tuple[int, float]],
        negative_pct_points: list[tuple[int, float]],
        positive_pct_points: list[tuple[int, float]],
        jitter: float = 0.06,
    ):
        self.id = id
        self.name = name
        self.category = category
        self.description = description
        self.keywords = keywords
        self.volume_points = volume_points
        self.telegram_share_points = telegram_share_points
        self.negative_pct_points = negative_pct_points
        self.positive_pct_points = positive_pct_points
        self.jitter = jitter

    @property
    def platforms(self) -> list[str]:
        max_tg_share = max(v for _, v in self.telegram_share_points)
        min_tg_share = min(v for _, v in self.telegram_share_points)
        platforms = []
        if min_tg_share < 1.0:
            platforms.append("x")
        if max_tg_share > 0.0:
            platforms.append("telegram")
        return platforms or ["x"]

    def build_hourly(self) -> list[dict]:
        rng = random.Random(f"{RNG_SEED}:{self.id}")
        buckets = []
        for i in range(BUCKETS):
            base_volume = _interp(self.volume_points, i)
            jittered = max(0, base_volume * (1 + rng.uniform(-self.jitter, self.jitter)))
            total = max(0, round(jittered))
            tg_share = min(1.0, max(0.0, _interp(self.telegram_share_points, i)))
            tg_total = round(total * tg_share)
            x_total = total - tg_total
            neg_pct = _interp(self.negative_pct_points, i)
            pos_pct = _interp(self.positive_pct_points, i)
            buckets.append(
                {
                    "ts": bucket_iso(i),
                    "x": _split_sentiment(x_total, pos_pct, neg_pct),
                    "telegram": _split_sentiment(tg_total, pos_pct, neg_pct),
                }
            )
        return buckets


TOPIC_SPECS: list[TopicSpec] = [
    TopicSpec(
        id="rail-signal-fault",
        name="Line 4 signalling fault near Meridian Central",
        category="Transit & Infrastructure",
        description=(
            "A signalling fault on Line 4 near Meridian Central has caused cascading delays "
            "since the evening peak. Commuter reports began on X and spread to Telegram transit "
            "channels as the disruption dragged on, with sentiment turning sharply negative as "
            "replacement bus queues grew."
        ),
        keywords=[
            {"term": "Line 4", "weight": 1.0, "firstSeenBucket": 36},
            {"term": "signalling fault", "weight": 0.9, "firstSeenBucket": 38},
            {"term": "Meridian Central", "weight": 0.75, "firstSeenBucket": 36},
            {"term": "replacement bus", "weight": 0.6, "firstSeenBucket": 43},
            {"term": "delays", "weight": 0.5, "firstSeenBucket": 36},
            {"term": "refund", "weight": 0.35, "firstSeenBucket": 45},
        ],
        volume_points=[
            (0, 18), (12, 17), (24, 19), (30, 21), (35, 23), (36, 24), (37, 27),
            (38, 32), (39, 42), (40, 55), (41, 80), (42, 120), (43, 170),
            (44, 250), (45, 330), (46, 420), (47, 530),
        ],
        telegram_share_points=[
            (0, 0.04), (35, 0.05), (39, 0.06), (40, 0.10), (42, 0.18), (44, 0.25), (47, 0.32),
        ],
        negative_pct_points=[
            (0, 20), (35, 22), (39, 30), (41, 40), (43, 55), (45, 65), (47, 72),
        ],
        positive_pct_points=[
            (0, 15), (35, 15), (41, 10), (47, 5),
        ],
    ),
    TopicSpec(
        id="power-outage-report",
        name="Rolling power outage reports, Eastside",
        category="Utilities",
        description=(
            "Scattered Telegram reports of short power outages in Eastside neighbourhoods. "
            "Volume is small and confined to a single Telegram community — the kind of "
            "low-confidence signal the system deliberately does not escalate on its own."
        ),
        keywords=[
            {"term": "power outage", "weight": 1.0},
            {"term": "Eastside", "weight": 0.7},
            {"term": "substation", "weight": 0.4},
        ],
        volume_points=[(0, 3), (12, 4), (24, 3), (36, 5), (40, 6), (44, 7), (47, 8)],
        telegram_share_points=[(0, 1.0), (47, 1.0)],
        negative_pct_points=[(0, 30), (47, 38)],
        positive_pct_points=[(0, 10), (47, 8)],
        jitter=0.15,
    ),
    TopicSpec(
        id="festival-travel-surge",
        name="Autumn Festival travel surge",
        category="Events & Travel",
        description=(
            "Steadily rising chatter about travel into the city for the Autumn Festival, "
            "amplified by commuters rerouting around the Line 4 disruption. Genuinely "
            "growing, but well short of the volume-growth floor that would flag it as an alert."
        ),
        keywords=[
            {"term": "Autumn Festival", "weight": 1.0, "firstSeenBucket": 10},
            {"term": "travel", "weight": 0.6},
            {"term": "rerouting", "weight": 0.4, "firstSeenBucket": 40},
        ],
        volume_points=[(0, 28), (12, 30), (24, 32), (30, 35), (36, 38), (40, 45), (41, 50), (44, 75), (47, 95)],
        telegram_share_points=[(0, 0.35), (47, 0.35)],
        negative_pct_points=[(0, 12), (36, 14), (41, 18), (47, 22)],
        positive_pct_points=[(0, 55), (47, 50)],
    ),
    TopicSpec(
        id="weekly-derby-chat",
        name="Riverside derby match discussion",
        category="Sports",
        description="Ordinary matchday chatter around the weekly Riverside derby. Flat volume, mixed sentiment.",
        keywords=[{"term": "Riverside derby", "weight": 1.0}, {"term": "matchday", "weight": 0.5}],
        volume_points=[(0, 38), (12, 42), (24, 40), (36, 41), (41, 39), (47, 40)],
        telegram_share_points=[(0, 0.15), (47, 0.15)],
        negative_pct_points=[(0, 25), (47, 25)],
        positive_pct_points=[(0, 35), (47, 35)],
    ),
    TopicSpec(
        id="council-budget-debate",
        name="City council budget debate",
        category="Politics & Local Government",
        description="Discussion of the city council's annual budget debate, fading as the news cycle moves on.",
        keywords=[{"term": "council budget", "weight": 1.0}, {"term": "city council", "weight": 0.6}],
        volume_points=[(0, 75), (12, 68), (24, 62), (36, 58), (41, 55), (44, 48), (47, 35)],
        telegram_share_points=[(0, 0.10), (47, 0.10)],
        negative_pct_points=[(0, 30), (47, 30)],
        positive_pct_points=[(0, 20), (47, 20)],
    ),
    TopicSpec(
        id="new-riverside-eatery",
        name="New riverside food market opening",
        category="Lifestyle",
        description="Positive, low-key buzz about a new food market opening on the riverside promenade.",
        keywords=[{"term": "food market", "weight": 1.0}, {"term": "riverside", "weight": 0.5}],
        volume_points=[(0, 20), (12, 24), (24, 26), (36, 25), (41, 26), (47, 27)],
        telegram_share_points=[(0, 0.20), (47, 0.20)],
        negative_pct_points=[(0, 8), (47, 8)],
        positive_pct_points=[(0, 65), (47, 65)],
    ),
    TopicSpec(
        id="flood-warning-riverside",
        name="Flash flood warning, riverside promenade",
        category="Public Safety",
        description=(
            "A flash flood warning for the riverside promenade spiked sharply after heavy "
            "afternoon rain, drew in news and civic-watch communities within hours, and has "
            "since receded as river levels dropped. Currently under analyst review."
        ),
        keywords=[
            {"term": "flood warning", "weight": 1.0, "firstSeenBucket": 27},
            {"term": "riverside promenade", "weight": 0.7, "firstSeenBucket": 28},
            {"term": "river levels", "weight": 0.5, "firstSeenBucket": 30},
        ],
        volume_points=[
            (0, 15), (12, 16), (24, 18), (25, 30), (27, 50), (28, 70), (29, 110),
            (30, 160), (31, 220), (32, 260), (33, 280), (34, 200), (36, 140),
            (38, 90), (40, 60), (44, 35), (47, 30),
        ],
        telegram_share_points=[(0, 0.10), (28, 0.15), (31, 0.30), (33, 0.30), (38, 0.15), (47, 0.10)],
        negative_pct_points=[(0, 20), (28, 30), (31, 55), (33, 60), (38, 40), (47, 28)],
        positive_pct_points=[(0, 20), (31, 8), (47, 20)],
    ),
    TopicSpec(
        id="fare-hike-backlash",
        name="Transit fare hike backlash",
        category="Transit & Infrastructure",
        description=(
            "Backlash following an announced transit fare increase spiked hard a day and a "
            "half ago and has since fully settled back to ordinary background volume. Kept as "
            "a resolved reference case for how a past alert played out."
        ),
        keywords=[
            {"term": "fare hike", "weight": 1.0, "firstSeenBucket": 7},
            {"term": "transit fares", "weight": 0.6},
            {"term": "petition", "weight": 0.4, "firstSeenBucket": 11},
        ],
        volume_points=[
            (0, 20), (6, 22), (7, 26), (8, 35), (9, 55), (10, 90), (11, 140), (12, 190),
            (13, 230), (14, 200), (16, 140), (18, 90), (20, 60), (24, 40), (30, 30),
            (36, 28), (41, 27), (47, 26),
        ],
        telegram_share_points=[(0, 0.08), (9, 0.10), (11, 0.22), (13, 0.25), (18, 0.12), (47, 0.08)],
        negative_pct_points=[(0, 22), (9, 30), (11, 48), (13, 58), (18, 35), (47, 25)],
        positive_pct_points=[(0, 18), (13, 6), (47, 18)],
    ),
]

TOPIC_SPECS_BY_ID = {s.id: s for s in TOPIC_SPECS}


def trend_id_of(topic_id: str) -> str:
    return f"tr-{topic_id}"


def topic_id_of_trend(trend_id: str) -> str:
    return trend_id[len("tr-"):] if trend_id.startswith("tr-") else trend_id
