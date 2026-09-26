"""
Seed (or reseed) the database with the Trend Sphere scenario.

    python -m scripts.seed_db

Safe to re-run: it drops and recreates every table before reseeding, so
alert status changes made through the API are lost on reseed — that's
intentional for this phase (see README), and is why RESEED_ON_STARTUP
defaults to true only until you want the alert workflow to persist.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, SessionLocal, engine
from app.models import Alert, Community, Edge, Meta, Node, Post, PropagationPath, Topic
from app.seed.build import build_dataset
from app.seed.scenario import SCENARIO_NOW


def run() -> None:
    print("[seed] building scenario dataset...")
    ds = build_dataset()

    print("[seed] (re)creating schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        print(f"[seed] {len(ds['communities'])} communities, {len(ds['nodes'])} nodes, {len(ds['edges'])} edges")
        for c in ds["communities"]:
            db.add(Community(id=c["id"], name=c["name"], description=c["description"], color=c["color"]))
        db.flush()

        for n in ds["nodes"]:
            db.add(
                Node(
                    id=n["id"], label=n["label"], type=n["type"], platform=n["platform"],
                    community_id=n["community_id"], role=n["role"], in_degree=n["in_degree"],
                    out_degree=n["out_degree"], influence=n["influence"], community_reach=n["community_reach"],
                    topic_ids=list(n["topic_ids"]),
                )
            )
        db.flush()

        for spec_id, spec in ds["topics"].items():
            db.add(
                Topic(
                    id=spec.id, name=spec.name, category=spec.category, description=spec.description,
                    keywords=spec.keywords, platforms=spec.platforms, hourly=ds["hourly"][spec_id],
                )
            )
        db.flush()

        print(f"[seed] {len(ds['posts'])} posts")
        for p in ds["posts"]:
            db.add(
                Post(
                    id=p["id"], platform=p["platform"], author_id=p["author_id"], author_name=p["author_name"],
                    text=p["text"], timestamp=p["timestamp"], likes=p["likes"], replies=p["replies"],
                    shares=p["shares"], views=p["views"], hashtags=p["hashtags"], language=p["language"],
                    topic_id=p["topic_id"], sentiment=p["sentiment"], sentiment_score=p["sentiment_score"],
                    community_id=p["community_id"],
                )
            )

        for e in ds["edges"]:
            db.add(
                Edge(
                    id=e["id"], source_id=e["source_id"], target_id=e["target_id"], type=e["type"],
                    weight=e["weight"], timestamp=e["timestamp"], topic_id=e["topic_id"],
                    on_propagation_path=e["on_propagation_path"],
                )
            )

        for pp in ds["propagation_paths"]:
            db.add(
                PropagationPath(
                    id=pp["id"], topic_id=pp["topic_id"], label=pp["label"], hops=pp["hops"],
                    edge_ids=pp["edge_ids"], started_at=pp["started_at"], duration_minutes=pp["duration_minutes"],
                    platforms_crossed=pp["platforms_crossed"], communities_crossed=pp["communities_crossed"],
                    nodes_reached=pp["nodes_reached"], seed_post_id=pp["seed_post_id"],
                )
            )

        print(f"[seed] {len(ds['alerts'])} alerts")
        for a in ds["alerts"]:
            db.add(
                Alert(
                    id=a["id"], topic_id=a["topic_id"], trend_id=a["trend_id"], severity=a["severity"],
                    status=a["status"], created_at=a["created_at"], updated_at=a["updated_at"],
                    confidence=a["confidence"], score=a["score"], platforms=a["platforms"],
                    trigger_reason=a["trigger_reason"], why_bullets=a["why_bullets"], evidence=a["evidence"],
                    mentions_per_hour_at_alert=a["mentions_per_hour_at_alert"], bucket_index=a["bucket_index"],
                    history=a["history"],
                )
            )

        db.add(Meta(key="scenario_now", value=SCENARIO_NOW.isoformat()))
        db.commit()
        print("[seed] done.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run()
