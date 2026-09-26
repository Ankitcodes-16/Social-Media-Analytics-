"""
Synthetic account/channel graph.

Eight communities, a small population of nodes per community, a random
internal edge set per community (retweet/reply/mention on X,
forward/cross_post on Telegram), and one hand-built propagation path
for the rail-signal-fault story crossing platform and community lines
— the concrete evidence the community_spread signal and the Network
page's "propagation path" panel both point at.
"""
from __future__ import annotations

import random

from app.seed.scenario import bucket_end, bucket_start

RNG = random.Random("20260920:network")

COMMUNITIES = [
    {"id": "comm-commuters", "name": "Daily Commuters", "color": "#2563eb",
     "description": "Regular Line 4 riders who post live updates during disruptions.", "platform": "x"},
    {"id": "comm-telegram-alerts", "name": "Metro Telegram Alert Channels", "color": "#0891b2",
     "description": "Telegram channels that forward transit-authority and rider-sourced alerts.", "platform": "telegram"},
    {"id": "comm-news-followers", "name": "Local News Followers", "color": "#7c3aed",
     "description": "Accounts that amplify and discuss local news coverage.", "platform": "x"},
    {"id": "comm-general-public", "name": "General Public", "color": "#64748b",
     "description": "Casual accounts with no strong topical focus.", "platform": "x"},
    {"id": "comm-festival-crowd", "name": "Festival & Events Crowd", "color": "#d97706",
     "description": "Accounts focused on city events, travel and things to do.", "platform": "x"},
    {"id": "comm-sports-fans", "name": "Sports Fans", "color": "#059669",
     "description": "Riverside derby and local sports discussion.", "platform": "x"},
    {"id": "comm-civic-watchers", "name": "Civic & Politics Watchers", "color": "#b91c1c",
     "description": "Accounts following city council and local government.", "platform": "x"},
    {"id": "comm-eastside-locals", "name": "Eastside Locals", "color": "#9333ea",
     "description": "A small Telegram group for Eastside neighbourhood residents.", "platform": "telegram"},
]

NODES_PER_COMMUNITY = {
    "comm-commuters": 14, "comm-telegram-alerts": 6, "comm-news-followers": 10,
    "comm-general-public": 16, "comm-festival-crowd": 9, "comm-sports-fans": 9,
    "comm-civic-watchers": 8, "comm-eastside-locals": 5,
}

FIRST_NAMES = ["Ava", "Noah", "Maya", "Leo", "Zara", "Kian", "Priya", "Owen", "Nia", "Theo",
               "Ines", "Marco", "Yuki", "Sana", "Eli", "Rosa", "Tariq", "Vivian", "Dev", "Alina"]


def _node_label(community_id: str, idx: int, node_type: str) -> str:
    if node_type == "channel":
        base = community_id.replace("comm-", "").replace("-", "_")
        return f"@{base}_updates" if idx == 0 else f"@{base}_ch{idx}"
    name = FIRST_NAMES[(hash((community_id, idx)) % len(FIRST_NAMES))]
    return f"@{name.lower()}{RNG.randint(10, 999)}"


def build_nodes() -> list[dict]:
    nodes = []
    for comm in COMMUNITIES:
        n = NODES_PER_COMMUNITY[comm["id"]]
        for i in range(n):
            is_channel = comm["platform"] == "telegram" and i == 0
            node_id = f"{comm['id']}-n{i}"
            nodes.append(
                {
                    "id": node_id,
                    "label": _node_label(comm["id"], i, "channel" if is_channel else "user"),
                    "type": "channel" if is_channel else "user",
                    "platform": comm["platform"],
                    "community_id": comm["id"],
                    "in_degree": 0,
                    "out_degree": 0,
                    "topic_ids": set(),
                }
            )
    return nodes


def build_edges(nodes: list[dict]) -> tuple[list[dict], dict]:
    """Random intra-community edges plus a hand-built cross-community,
    cross-platform propagation path for the rail-signal-fault topic."""
    by_community: dict[str, list[dict]] = {}
    for n in nodes:
        by_community.setdefault(n["community_id"], []).append(n)

    edges: list[dict] = []
    edge_seq = 0

    def add_edge(source: str, target: str, etype: str, weight: float, ts: str | None, topic_id: str | None, on_path: bool) -> str:
        nonlocal edge_seq
        edge_seq += 1
        eid = f"e{edge_seq:04d}"
        edges.append(
            {
                "id": eid, "source_id": source, "target_id": target, "type": etype,
                "weight": weight, "timestamp": ts, "topic_id": topic_id, "on_propagation_path": on_path,
            }
        )
        for n in nodes:
            if n["id"] == source:
                n["out_degree"] += 1
            if n["id"] == target:
                n["in_degree"] += 1
        return eid

    # Random intra-community chatter
    for comm in COMMUNITIES:
        members = by_community[comm["id"]]
        etype_pool = ["forward", "cross_post"] if comm["platform"] == "telegram" else ["retweet", "reply", "mention"]
        for n in members:
            degree = RNG.randint(2, 5)
            for _ in range(degree):
                target = RNG.choice(members)
                if target["id"] == n["id"]:
                    continue
                add_edge(n["id"], target["id"], RNG.choice(etype_pool), round(RNG.uniform(0.4, 1.0), 2), None, None, False)

    # A couple of cross-community bridge edges for general graph realism
    bridge_pairs = [
        ("comm-news-followers", "comm-civic-watchers"),
        ("comm-festival-crowd", "comm-general-public"),
        ("comm-sports-fans", "comm-general-public"),
    ]
    for a, b in bridge_pairs:
        add_edge(RNG.choice(by_community[a])["id"], RNG.choice(by_community[b])["id"], "mention", 0.5, None, None, False)

    # Hand-built propagation path: rail-signal-fault, X -> Telegram -> X, 4 communities
    hop_nodes = [
        by_community["comm-commuters"][0],
        by_community["comm-telegram-alerts"][0],
        by_community["comm-news-followers"][0],
        by_community["comm-general-public"][0],
    ]
    hop_times = [
        bucket_start(42) + (bucket_end(42) - bucket_start(42)) / 3,
        bucket_start(43) + (bucket_end(43) - bucket_start(43)) / 2,
        bucket_start(44) + (bucket_end(44) - bucket_start(44)) / 2,
        bucket_start(45) + (bucket_end(45) - bucket_start(45)) / 3,
    ]
    hop_types = [None, "forward", "cross_post", "retweet"]
    path_edge_ids = []
    for i in range(1, len(hop_nodes)):
        eid = add_edge(
            hop_nodes[i - 1]["id"], hop_nodes[i]["id"], hop_types[i], 1.0,
            hop_times[i].isoformat().replace("+00:00", "Z"), "rail-signal-fault", True,
        )
        path_edge_ids.append(eid)

    propagation_path = {
        "id": "pp-rail-signal-fault-1",
        "topic_id": "rail-signal-fault",
        "label": "Commuter report reaches four communities across two platforms",
        "hops": [
            {"nodeId": hop_nodes[i]["id"], "at": hop_times[i].isoformat().replace("+00:00", "Z"), "via": hop_types[i]}
            for i in range(len(hop_nodes))
        ],
        "edge_ids": path_edge_ids,
        "started_at": hop_times[0].isoformat().replace("+00:00", "Z"),
        "duration_minutes": int((hop_times[-1] - hop_times[0]).total_seconds() / 60),
        "platforms_crossed": 2,
        "communities_crossed": 4,
        "nodes_reached": len(hop_nodes),
        "seed_post_id": None,  # filled in by build.py once the seed post exists
    }

    return edges, propagation_path


def finalize_roles_and_influence(nodes: list[dict], edges: list[dict]) -> None:
    """Compute degree/role/influence/community-reach once the edge set is final."""
    reach: dict[str, set[str]] = {n["id"]: set() for n in nodes}
    by_id = {n["id"]: n for n in nodes}
    out_weight: dict[str, float] = {n["id"]: 0.0 for n in nodes}

    for e in edges:
        s, t = by_id.get(e["source_id"]), by_id.get(e["target_id"])
        if s and t:
            out_weight[e["source_id"]] += e["weight"]
            if t["community_id"] != s["community_id"]:
                reach[s["id"]].add(t["community_id"])
                reach[t["id"]].add(s["community_id"])

    max_out = max(out_weight.values()) or 1.0
    max_degree = max((n["in_degree"] + n["out_degree"]) for n in nodes) or 1

    for n in nodes:
        n["community_reach"] = len(reach[n["id"]])
        degree = n["in_degree"] + n["out_degree"]
        n["influence"] = round(0.7 * (out_weight[n["id"]] / max_out) + 0.3 * (degree / max_degree), 3)
        n["topic_ids"] = sorted(n["topic_ids"])

    # Roles: top decile of degree = hub, community_reach >= 2 = bridge, else member
    ranked = sorted(nodes, key=lambda n: n["in_degree"] + n["out_degree"], reverse=True)
    hub_cutoff = max(1, len(ranked) // 10)
    hub_ids = {n["id"] for n in ranked[:hub_cutoff]}
    for n in nodes:
        if n["id"] in hub_ids:
            n["role"] = "hub"
        elif n["community_reach"] >= 2:
            n["role"] = "bridge"
        else:
            n["role"] = "member"
