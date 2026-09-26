"""
Synthetic post generation.

For each topic, each hour's already-generated (volume, platform-split,
sentiment-split) totals are *sampled* down to a realistic "indexed post"
count — a Data Explorer would never index literally every mention, and
this keeps the dataset a manageable, readable size. Three topics get a
richer sample plus an engagement boost inside a specific hour window
(`ENGAGEMENT_BOOST`): that's deliberate — it's what lets the
community_spread and engagement signals fire and produce a real,
explainable alert, the same way the frontend mock hand-built its scenario.
"""
from __future__ import annotations

import random

from app.seed.aggregate import bucket_total
from app.seed.scenario import BUCKETS, bucket_end, bucket_start, iso

RNG = random.Random("20260920:posts")

# (from_hour, community_id) — a community becomes eligible to post about a
# topic from `from_hour` onward.
TOPIC_COMMUNITY_SCHEDULE: dict[str, list[tuple[int, str]]] = {
    "rail-signal-fault": [(0, "comm-commuters"), (39, "comm-telegram-alerts"), (42, "comm-news-followers"), (45, "comm-general-public")],
    "power-outage-report": [(0, "comm-eastside-locals")],
    "festival-travel-surge": [(0, "comm-festival-crowd"), (20, "comm-general-public")],
    "weekly-derby-chat": [(0, "comm-sports-fans"), (10, "comm-general-public")],
    "council-budget-debate": [(0, "comm-civic-watchers")],
    "new-riverside-eatery": [(0, "comm-general-public")],
    "flood-warning-riverside": [(0, "comm-general-public"), (27, "comm-news-followers"), (29, "comm-civic-watchers")],
    "fare-hike-backlash": [(0, "comm-commuters"), (9, "comm-general-public"), (11, "comm-civic-watchers")],
}

# (start_hour, end_hour, engagement_multiplier) — inclusive hour range where
# this topic's posts get a large engagement boost (the "going viral" phase).
ENGAGEMENT_BOOST: dict[str, tuple[int, int, float]] = {
    "rail-signal-fault": (45, 47, 14.0),
    "flood-warning-riverside": (30, 33, 9.0),
    "fare-hike-backlash": (11, 13, 9.0),
}

# Hours where a topic gets a denser post sample (its "spike window" — needs
# enough indexed posts for the community/engagement signals to see).
DENSE_WINDOW: dict[str, tuple[int, int]] = {
    "rail-signal-fault": (39, 47),
    "flood-warning-riverside": (27, 34),
    "fare-hike-backlash": (8, 14),
}

PHRASES: dict[str, dict[str, list[str]]] = {
    "rail-signal-fault": {
        "negative": [
            "Line 4 has been stuck for over 40 minutes now, no announcement from staff #Line4",
            "Third delay this week on Line 4 and still no refund policy? Ridiculous.",
            "Replacement buses at Meridian Central are packed, this is a mess #signallingfault",
            "Missed my connection because of the Line 4 fault, absolutely fuming right now",
            "Meridian Central is chaos, staff say 'ongoing investigation' with zero timeline",
        ],
        "neutral": [
            "Signalling fault reported near Meridian Central affecting Line 4 services",
            "Transit authority says engineers are on site working on the Line 4 fault",
            "Anyone else seeing delays on Line 4 this evening?",
            "Replacement bus service now running between Meridian Central and Wynn Street",
        ],
        "positive": [
            "Credit to the Line 4 staff handing out water at Meridian Central during the delay",
            "Replacement buses actually showed up quickly, not bad given the circumstances",
        ],
    },
    "power-outage-report": {
        "negative": ["Power's been out on my street in Eastside for an hour, anyone else?"],
        "neutral": ["Short outage reported near the Eastside substation, checking with neighbours."],
        "positive": ["Power's back on Eastside, that was quick."],
    },
    "festival-travel-surge": {
        "positive": [
            "So excited for the Autumn Festival this weekend, booking travel now!",
            "Autumn Festival lineup looks great this year, road trip time",
            "Already planning our route to the Autumn Festival, can't wait",
        ],
        "neutral": [
            "Looking at travel options for the Autumn Festival, any tips?",
            "Rerouting around the Line 4 disruption to get to the Autumn Festival grounds",
        ],
        "negative": ["Autumn Festival travel is going to be a nightmare with Line 4 down"],
    },
    "weekly-derby-chat": {
        "positive": ["Big win for us in the derby today, what a match!"],
        "neutral": ["Derby kicks off in an hour, who's watching?"],
        "negative": ["Rough result in the derby today, defense fell apart in the second half"],
    },
    "council-budget-debate": {
        "neutral": ["City council budget session continuing into the evening"],
        "negative": ["Council budget debate dragging on with no resolution in sight"],
        "positive": ["Glad to see the council prioritising road repairs in this budget"],
    },
    "new-riverside-eatery": {
        "positive": [
            "The new riverside food market is fantastic, so many good stalls",
            "Spent the afternoon at the new food market by the river, loved it",
        ],
        "neutral": ["New food market opened on the riverside promenade today"],
        "negative": ["Food market was fun but way too crowded on opening day"],
    },
    "flood-warning-riverside": {
        "negative": [
            "Riverside path is flooding fast, water's over the walkway near the bridge",
            "Flood warning just escalated for the riverside area, get out now if you're nearby",
            "Basement flooding on the riverside block, this escalated quickly",
        ],
        "neutral": [
            "Flood warning issued for the riverside area after heavy rain",
            "Council monitoring river levels near the promenade this afternoon",
        ],
        "positive": ["River levels dropping now, riverside flood warning downgraded"],
    },
    "fare-hike-backlash": {
        "negative": [
            "Another fare hike announced and service hasn't improved at all",
            "Can't believe they're raising fares again after all these delays",
            "Fare hike backlash growing, petition already has thousands of signatures",
        ],
        "neutral": ["Transit authority announces fare adjustment starting next quarter"],
        "positive": ["At least the fare increase comes with promised service upgrades"],
    },
}

HASHTAG_BY_TOPIC = {
    "rail-signal-fault": ["Line4", "MeridianCentral", "TransitDelay"],
    "power-outage-report": ["Eastside", "PowerOutage"],
    "festival-travel-surge": ["AutumnFestival"],
    "weekly-derby-chat": ["RiversideDerby"],
    "council-budget-debate": ["CityCouncil", "Budget"],
    "new-riverside-eatery": ["Riverside", "FoodMarket"],
    "flood-warning-riverside": ["FloodWarning", "Riverside"],
    "fare-hike-backlash": ["FareHike", "Transit"],
}

FIRST_NAMES = ["Ava", "Noah", "Maya", "Leo", "Zara", "Kian", "Priya", "Owen", "Nia", "Theo",
               "Ines", "Marco", "Yuki", "Sana", "Eli", "Rosa", "Tariq", "Vivian", "Dev", "Alina"]


def _active_communities(schedule: list[tuple[int, str]], hour: int) -> list[str]:
    return [cid for from_hour, cid in schedule if from_hour <= hour] or [schedule[0][1]]


def _sample_count(volume: int, dense: bool) -> int:
    if dense:
        return max(3, min(25, round(volume / 12)))
    return max(1, min(6, round(volume / 15)))


def _pick_phrase(topic_id: str, sentiment: str) -> str:
    bank = PHRASES.get(topic_id, {})
    pool = bank.get(sentiment) or bank.get("neutral") or ["Update on this topic."]
    return RNG.choice(pool)


def _engagement(topic_id: str, hour: int) -> dict:
    base_likes = RNG.randint(2, 45)
    base_replies = RNG.randint(0, 8)
    base_shares = RNG.randint(0, 6)
    boost = ENGAGEMENT_BOOST.get(topic_id)
    mult = 1.0
    if boost and boost[0] <= hour <= boost[1]:
        mult = boost[2] * RNG.uniform(0.7, 1.3)
    likes = round(base_likes * mult)
    replies = round(base_replies * mult)
    shares = round(base_shares * mult)
    views = round((likes + replies + shares) * RNG.uniform(6, 12) + 20)
    return {"likes": likes, "replies": replies, "shares": shares, "views": views}


def generate_posts_for_topic(spec, hourly: list[dict], nodes_by_community: dict[str, list[dict]]) -> list[dict]:
    """Returns post dicts (not yet ORM rows) plus mutates `topicIds` sets on
    author nodes so Node.topic_ids can be persisted alongside them."""
    posts: list[dict] = []
    schedule = TOPIC_COMMUNITY_SCHEDULE.get(spec.id, [(0, "comm-general-public")])
    dense_window = DENSE_WINDOW.get(spec.id)
    post_seq = 0

    for hour in range(BUCKETS):
        bucket = hourly[hour]
        dense = bool(dense_window and dense_window[0] <= hour <= dense_window[1])
        for platform in ("x", "telegram"):
            counts = bucket[platform]
            platform_total = counts["positive"] + counts["neutral"] + counts["negative"]
            if platform_total <= 0:
                continue
            n = min(platform_total, _sample_count(platform_total, dense))
            if n <= 0:
                continue
            # Sentiment mix for the sampled subset, proportional to the bucket's split.
            sentiments = (
                ["positive"] * counts["positive"] + ["neutral"] * counts["neutral"] + ["negative"] * counts["negative"]
            )
            RNG.shuffle(sentiments)
            sample_sentiments = sentiments[:n]

            eligible_communities = [
                cid for cid in _active_communities(schedule, hour)
                if nodes_by_community.get(cid) and any(nd["platform"] == platform for nd in nodes_by_community[cid])
            ] or [c for c in nodes_by_community if any(nd["platform"] == platform for nd in nodes_by_community[c])]

            start = bucket_start(hour)
            end = bucket_end(hour)
            span = (end - start).total_seconds()

            for sentiment in sample_sentiments:
                post_seq += 1
                community_id = RNG.choice(eligible_communities)
                candidates = [nd for nd in nodes_by_community[community_id] if nd["platform"] == platform]
                author = RNG.choice(candidates)
                from datetime import timedelta as _timedelta
                ts = start + _timedelta(seconds=span * RNG.random())
                score = {"positive": RNG.uniform(0.35, 0.9), "neutral": RNG.uniform(-0.15, 0.15), "negative": RNG.uniform(-0.9, -0.35)}[sentiment]
                eng = _engagement(spec.id, hour)
                post = {
                    "id": f"{spec.id}-p{post_seq:05d}",
                    "platform": platform,
                    "author_id": author["id"],
                    "author_name": author["label"],
                    "text": _pick_phrase(spec.id, sentiment),
                    "timestamp": iso(ts),
                    "timestampMs": ts.timestamp() * 1000,
                    "likes": eng["likes"], "replies": eng["replies"], "shares": eng["shares"], "views": eng["views"],
                    "hashtags": HASHTAG_BY_TOPIC.get(spec.id, []),
                    "language": "en",
                    "topic_id": spec.id,
                    "sentiment": sentiment,
                    "sentiment_score": round(score, 2),
                    "community_id": community_id,
                }
                author["topic_ids"].add(spec.id)
                posts.append(post)

    return posts
