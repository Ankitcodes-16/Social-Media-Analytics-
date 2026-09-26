"""
Seed orchestrator. Builds the whole coherent scenario in memory (nodes,
edges, propagation path, hourly series per topic, sampled posts, and the
alerts that the six signals justify) and returns it ready for
`scripts/seed_db.py` to insert. Nothing here talks to the database
directly, so it's easy to unit-test or reuse from a notebook.
"""
from __future__ import annotations

from app.seed.network import COMMUNITIES, build_edges, build_nodes, finalize_roles_and_influence
from app.seed.posts import generate_posts_for_topic
from app.seed.scenario import MINUTE, bucket_end
from app.seed.signals import build_context, composite_score, compute_confidence, evaluate_signals
from app.seed.topics import TOPIC_SPECS, trend_id_of

# (topic_id, bucket, status, history[])  — the bucket a >=3-of-6 evaluation
# is taken at, and the status/history the alert should carry in this demo.
ALERT_DEFS = [
    {
        "id": "ALR-2026-0161",
        "topic_id": "rail-signal-fault",
        "bucket": 47,
        "status": "new",
        "history": [],
    },
    {
        "id": "ALR-2026-0157",
        "topic_id": "flood-warning-riverside",
        "bucket": 33,
        "status": "investigating",
        "history": [
            {
                "status": "investigating",
                "note": "Picked up for review; cross-checking against council flood-gauge data.",
                "actor": "analyst",
                "offset_minutes": 55,
            }
        ],
    },
    {
        "id": "ALR-2026-0149",
        "topic_id": "fare-hike-backlash",
        "bucket": 13,
        "status": "resolved",
        "history": [
            {
                "status": "investigating",
                "note": "Reviewing backlash volume against the fare announcement timeline.",
                "actor": "analyst",
                "offset_minutes": 40,
            },
            {
                "status": "resolved",
                "note": "Volume and negative share are back near baseline; no further action needed.",
                "actor": "analyst",
                "offset_minutes": 60 * 20,
            },
        ],
    },
]


def _bucket_ms(i: int) -> float:
    from app.seed.scenario import bucket_start

    return bucket_start(i).timestamp() * 1000


def _bucket_end_ms(i: int) -> float:
    return bucket_end(i).timestamp() * 1000


def severity_for(score: float, mentions_per_hour: int) -> str:
    if score >= 0.85 and mentions_per_hour >= 500:
        return "critical"
    if score >= 0.8:
        return "high"
    if score >= 0.4:
        return "medium"
    return "low"


def _list_join(items: list[str]) -> str:
    if len(items) <= 1:
        return items[0] if items else ""
    return f"{', '.join(items[:-1])} and {items[-1]}"


def build_dataset() -> dict:
    # 1) Static graph scaffolding
    nodes = build_nodes()
    nodes_by_community: dict[str, list[dict]] = {}
    for n in nodes:
        nodes_by_community.setdefault(n["community_id"], []).append(n)

    # 2) Hourly series per topic
    hourly = {spec.id: spec.build_hourly() for spec in TOPIC_SPECS}

    # 3) Posts (mutates node['topic_ids'] in place)
    all_posts: list[dict] = []
    for spec in TOPIC_SPECS:
        all_posts.extend(generate_posts_for_topic(spec, hourly[spec.id], nodes_by_community))

    # 4) Edges + propagation path, then finalize node roles/influence/degree
    edges, propagation_path = build_edges(nodes)
    finalize_roles_and_influence(nodes, edges)

    # Attach a representative seed post id to the propagation path
    seed_candidates = [p for p in all_posts if p["topic_id"] == "rail-signal-fault" and p["community_id"] == "comm-commuters"]
    if seed_candidates:
        propagation_path["seed_post_id"] = sorted(seed_candidates, key=lambda p: p["timestamp"])[0]["id"]

    # 5) Evaluation context (signals need every topic's hourly series + every post)
    ctx = build_context(hourly, all_posts)

    # 6) Alerts — evaluate the same six signals at each definition's bucket
    alerts = []
    for d in ALERT_DEFS:
        topic_id = d["topic_id"]
        bucket = d["bucket"]
        evidence = evaluate_signals(ctx, topic_id, bucket, _bucket_ms, _bucket_end_ms)
        fired = [s for s in evidence if s["fired"]]
        score = composite_score(evidence)
        confidence = compute_confidence(ctx, topic_id, bucket, evidence)
        h = hourly[topic_id]
        from app.seed.aggregate import bucket_total

        at_alert = bucket_total(h[bucket])
        now_mph = bucket_total(h[-1])
        created_at_dt = bucket_end(bucket) + 5 * MINUTE

        x = sum(bucket_total(h[i], "x") for i in range(max(0, bucket - 2), bucket + 1))
        tg = sum(bucket_total(h[i], "telegram") for i in range(max(0, bucket - 2), bucket + 1))
        platforms = []
        if x / max(1, x + tg) >= 0.05:
            platforms.append("x")
        if tg / max(1, x + tg) >= 0.05:
            platforms.append("telegram")

        history = [
            {
                "ts": created_at_dt.isoformat().replace("+00:00", "Z"),
                "status": "new",
                "note": f"Alert generated automatically: {len(fired)} of {len(evidence)} signals fired.",
                "actor": "system",
            }
        ]
        for h_event in d["history"]:
            ts = created_at_dt + h_event["offset_minutes"] * MINUTE
            history.append({"ts": ts.isoformat().replace("+00:00", "Z"), "status": h_event["status"], "note": h_event["note"], "actor": h_event["actor"]})

        if len(fired) < 3:
            print(f"[seed] WARNING: alert {d['id']} on {topic_id} only fired {len(fired)}/6 signals (expected >=3)")

        alerts.append(
            {
                "id": d["id"], "topic_id": topic_id, "trend_id": trend_id_of(topic_id),
                "severity": severity_for(score, at_alert), "status": d["status"],
                "created_at": history[0]["ts"], "updated_at": history[-1]["ts"],
                "confidence": confidence, "score": score, "platforms": platforms,
                "trigger_reason": f"{len(fired)} of {len(evidence)} signals fired: {_list_join([s['label'].lower() for s in fired])}.",
                "why_bullets": [s["explanation"] for s in fired],
                "evidence": evidence, "mentions_per_hour_at_alert": at_alert,
                "bucket_index": bucket, "history": history,
                "mentions_per_hour_now": now_mph,  # convenience, not persisted as its own column
            }
        )
    alerts.sort(key=lambda a: a["created_at"], reverse=True)

    return {
        "communities": COMMUNITIES,
        "nodes": nodes,
        "edges": edges,
        "propagation_paths": [propagation_path],
        "topics": {spec.id: spec for spec in TOPIC_SPECS},
        "hourly": hourly,
        "posts": all_posts,
        "alerts": alerts,
    }
