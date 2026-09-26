from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Edge as EdgeRow
from app.models import Node as NodeRow
from app.models import Post as PostRow
from app.models import PropagationPath as PropagationPathRow
from app.schemas import NetworkGraph
from app.seed.aggregate import summarize
from app.seed.network import COMMUNITIES
from app.seed.topics import TOPIC_SPECS_BY_ID

router = APIRouter(tags=["network"])


def _cohesion(member_ids: set[str], edges: list[EdgeRow]) -> float:
    if not member_ids:
        return 0.0
    touching = [e for e in edges if e.source_id in member_ids or e.target_id in member_ids]
    if not touching:
        return 0.0
    internal = sum(1 for e in touching if e.source_id in member_ids and e.target_id in member_ids)
    return round(internal / len(touching), 2)


@router.get("/api/network", response_model=NetworkGraph)
def get_network(db: Session = Depends(get_db), topicId: str | None = Query(None)):
    all_nodes = db.execute(select(NodeRow)).scalars().all()
    all_edges = db.execute(select(EdgeRow)).scalars().all()
    all_paths = db.execute(select(PropagationPathRow)).scalars().all()
    all_posts = db.execute(select(PostRow)).scalars().all()

    post_counts: dict[str, int] = {}
    for p in all_posts:
        post_counts[p.author_id] = post_counts.get(p.author_id, 0) + 1

    nodes = [n for n in all_nodes if not topicId or topicId in (n.topic_ids or [])]
    node_ids = {n.id for n in nodes}
    edges = [e for e in all_edges if e.source_id in node_ids and e.target_id in node_ids]

    node_out = [
        {
            "id": n.id, "label": n.label, "type": n.type, "platform": n.platform,
            "community_id": n.community_id, "role": n.role, "degree": n.in_degree + n.out_degree,
            "in_degree": n.in_degree, "out_degree": n.out_degree, "influence": n.influence,
            "community_reach": n.community_reach, "post_count": post_counts.get(n.id, 0),
            "topic_ids": n.topic_ids,
        }
        for n in nodes
    ]

    posts_by_community: dict[str, list[PostRow]] = {}
    for p in all_posts:
        if topicId and p.topic_id != topicId:
            continue
        if p.community_id:
            posts_by_community.setdefault(p.community_id, []).append(p)

    present_community_ids = {n.community_id for n in nodes}
    communities_out = []
    for c in COMMUNITIES:
        if c["id"] not in present_community_ids:
            continue
        members = [n for n in nodes if n.community_id == c["id"]]
        member_ids = {m.id for m in members}
        member_posts = posts_by_community.get(c["id"], [])

        sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
        for p in member_posts:
            if p.sentiment:
                sentiment_counts[p.sentiment] += 1
        x_count = sum(1 for p in member_posts if p.platform == "x")
        tg_count = sum(1 for p in member_posts if p.platform == "telegram")
        total_posts = max(1, x_count + tg_count)

        top_topics: dict[str, dict] = {}
        for p in member_posts:
            if not p.topic_id:
                continue
            entry = top_topics.setdefault(
                p.topic_id,
                {"topicId": p.topic_id, "name": TOPIC_SPECS_BY_ID[p.topic_id].name if p.topic_id in TOPIC_SPECS_BY_ID else p.topic_id, "posts": 0},
            )
            entry["posts"] += 1

        communities_out.append(
            {
                "id": c["id"], "name": c["name"], "description": c["description"], "color": c["color"],
                "size": len(members),
                "platform_mix": [
                    {"platform": "x", "mentions": x_count, "share_pct": round(x_count / total_posts * 100, 1)},
                    {"platform": "telegram", "mentions": tg_count, "share_pct": round(tg_count / total_posts * 100, 1)},
                ],
                "top_topics": sorted(top_topics.values(), key=lambda t: -t["posts"])[:3],
                "sentiment": summarize(sentiment_counts),
                "cohesion": _cohesion(member_ids, edges),
                "hub_node_ids": [n.id for n in members if n.role == "hub"],
            }
        )

    paths = [p for p in all_paths if not topicId or p.topic_id == topicId]

    n, e = len(node_out), len(edges)
    return NetworkGraph(
        topic_id=topicId,
        nodes=node_out,
        edges=[
            {
                "id": ed.id, "source": ed.source_id, "target": ed.target_id, "type": ed.type,
                "weight": ed.weight, "timestamp": ed.timestamp, "on_propagation_path": ed.on_propagation_path,
            }
            for ed in edges
        ],
        communities=communities_out,
        propagation_paths=[
            {
                "id": p.id, "topic_id": p.topic_id,
                "topic_name": TOPIC_SPECS_BY_ID[p.topic_id].name if p.topic_id in TOPIC_SPECS_BY_ID else p.topic_id,
                "label": p.label, "hops": p.hops, "edge_ids": p.edge_ids, "started_at": p.started_at,
                "duration_minutes": p.duration_minutes, "platforms_crossed": p.platforms_crossed,
                "communities_crossed": p.communities_crossed, "nodes_reached": p.nodes_reached,
                "seed_post_id": p.seed_post_id,
            }
            for p in paths
        ],
        metrics={
            "node_count": n, "edge_count": e, "community_count": len(communities_out),
            "density": round(e / (n * (n - 1)), 2) if n > 1 else 0.0,
            "avg_degree": round(2 * e / n, 1) if n > 0 else 0.0,
        },
    )
