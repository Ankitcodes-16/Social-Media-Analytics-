import type {
  Community,
  EdgeType,
  NetworkEdge,
  NetworkGraph,
  NetworkNode,
  Platform,
  PlatformShare,
  PropagationPath,
  SocialPost,
} from "@/types";
import { at } from "./scenario";
import { mulberry32, pick, round1, round2, type Rng } from "./random";
import { addCounts, emptyCounts, summarize } from "./aggregate";

/**
 * Simulated interaction network. All identities are synthetic:
 * "@anon_*" are anonymised users, "*_demo" are fictional institutional accounts,
 * "Demo · *" are fictional Telegram channels.
 *
 * Edge direction is the direction information flows (source → target).
 */

interface MemberSpec {
  key: string;
  label: string;
  platform: Platform;
}

export interface CommunitySpec {
  id: string;
  name: string;
  description: string;
  color: string;
  members: MemberSpec[];
}

const u = (key: string, handle: string): MemberSpec => ({ key, label: `@${handle}`, platform: "x" });
const c = (key: string, name: string): MemberSpec => ({ key, label: `Demo · ${name}`, platform: "telegram" });

export const COMMUNITY_SPECS: CommunitySpec[] = [
  {
    id: "c1",
    name: "Daily Commuters",
    description: "X accounts that post first-hand commuting reports and react to transit updates.",
    color: "#38bdf8",
    members: [
      u("falcon", "anon_falcon_21"),
      u("otter", "anon_otter_07"),
      u("lynx", "anon_lynx_33"),
      u("heron", "anon_heron_12"),
      u("maple", "anon_maple_48"),
      u("comet", "anon_comet_05"),
      u("ridge", "anon_ridge_29"),
      u("ember", "anon_ember_16"),
      u("tundra", "anon_tundra_44"),
      u("willow", "anon_willow_09"),
      u("raven", "anon_raven_37"),
      u("sable", "anon_sable_23"),
      u("quill", "anon_quill_51"),
      u("delta", "anon_delta_18"),
    ],
  },
  {
    id: "c2",
    name: "Transit Watch & News",
    description: "Fictional news and transit-watch accounts that amplify service updates.",
    color: "#a78bfa",
    members: [
      u("tdesk", "transit_desk_demo"),
      u("newswire", "city_newswire_demo"),
      u("ralerts", "rail_alerts_demo"),
      u("mpulse", "metro_pulse_demo"),
      u("brief", "daily_brief_demo"),
      u("reporter", "cityline_reporter_demo"),
      u("cnow", "commute_now_demo"),
      u("lens", "civic_lens_demo"),
      u("analyst", "rail_analyst_demo"),
    ],
  },
  {
    id: "c3",
    name: "City Telegram Channels",
    description: "Telegram channels that forward and discuss city and transit alerts.",
    color: "#fbbf24",
    members: [
      c("tgcomm", "City Commuters Chat"),
      c("tgrail", "Rail Updates Feed"),
      c("tglocal", "Local Alerts Hub"),
      c("tgwatch", "Neighborhood Watch"),
      c("tgstation", "Station Info Board"),
      c("tgdigest", "Daily City Digest"),
      c("tghelp", "Commuter Help Desk"),
      c("tgbreak", "Breaking City Desk"),
      c("tgtalk", "Metro & Rail Talk"),
      c("tgward", "Ward 5 Community"),
    ],
  },
  {
    id: "c4",
    name: "Festival & Travel Planners",
    description: "Travel-planning accounts and channels focused on festival trips.",
    color: "#34d399",
    members: [
      u("planner", "trip_planner_demo"),
      u("fguide", "festival_guide_demo"),
      c("tgfamily", "Family Trip Planning"),
      c("tgdeals", "Festival Travel Deals"),
      u("kite", "anon_kite_14"),
      u("pearl", "anon_pearl_26"),
      u("cedar", "anon_cedar_31"),
      c("tgticket", "Ticket Exchange Board"),
      u("tdesk2", "travel_desk_demo"),
    ],
  },
  {
    id: "c5",
    name: "Weather & Civic Alerts",
    description: "Weather, drainage and utility alert sources across both platforms.",
    color: "#f472b6",
    members: [
      u("wwatch", "weather_watch_demo"),
      c("tgrain", "Rain Alerts"),
      u("calerts", "civic_alerts_demo"),
      c("tgpower", "Power & Water Updates"),
      u("drain", "drain_report_demo"),
      c("tgsector", "Sector 12 Residents"),
      u("cloud", "anon_cloud_19"),
      u("river", "anon_river_42"),
    ],
  },
  {
    id: "c6",
    name: "Sports & Tech Fans",
    description: "Cricket and consumer-tech accounts, largely separate from civic topics.",
    color: "#fb923c",
    members: [
      u("cricket", "cricket_daily_demo"),
      u("gadget", "gadget_lab_demo"),
      u("boundary", "boundary_talk_demo"),
      u("phone", "phone_review_demo"),
      u("bat", "anon_bat_08"),
      u("stump", "anon_stump_35"),
      u("spin", "anon_spin_22"),
      u("pixel", "anon_pixel_13"),
      u("chip", "anon_chip_40"),
      u("lens2", "anon_lens_27"),
      u("byte", "anon_byte_46"),
      u("scroll", "anon_scroll_11"),
    ],
  },
  {
    id: "c7",
    name: "Student Channels",
    description: "Telegram channels for exam results, admissions and study groups.",
    color: "#a3e635",
    members: [
      c("tgexam", "Exam Results Alerts"),
      c("tgstudy", "Study Group Hub"),
      c("tgadmit", "Admission Updates"),
      c("tgcampus", "Campus Announcements"),
      c("tgcareer", "Career Notes"),
      c("tgcoach", "Coaching Circle"),
    ],
  },
];

/* ───────────────────────── Explicit edges (story + bridges) ───────────────────────── */

interface ExplicitEdge {
  a: string;
  b: string;
  w: number;
  type?: EdgeType;
  ts?: string;
  path?: string;
}

const EXPLICIT: ExplicitEdge[] = [
  // Railway path 1: X commuter → transit desk → newswire → Telegram → travel planners
  { a: "falcon", b: "tdesk", w: 6, type: "mention", ts: at(8, 31), path: "path-railway-1" },
  { a: "tdesk", b: "newswire", w: 8, type: "retweet", ts: at(8, 52), path: "path-railway-1" },
  { a: "newswire", b: "tgrail", w: 7, ts: at(9, 12), path: "path-railway-1" },
  { a: "tgrail", b: "tgcomm", w: 9, ts: at(9, 35), path: "path-railway-1" },
  { a: "tgcomm", b: "tgfamily", w: 5, ts: at(11, 40), path: "path-railway-1" },
  // Railway path 2: confirmation thread → station board → neighbourhood → festival traveller
  { a: "otter", b: "ralerts", w: 4, type: "mention", ts: at(8, 58), path: "path-railway-2" },
  { a: "ralerts", b: "tgstation", w: 5, ts: at(9, 20), path: "path-railway-2" },
  { a: "tgstation", b: "tgwatch", w: 4, ts: at(9, 58), path: "path-railway-2" },
  { a: "tgwatch", b: "pearl", w: 3, ts: at(11, 15), path: "path-railway-2" },
  // Monsoon path: weather desk → Telegram alerts → local hub → civic news
  { a: "wwatch", b: "tgrain", w: 6, ts: at(9, 40), path: "path-monsoon-1" },
  { a: "tgrain", b: "tglocal", w: 5, ts: at(10, 25), path: "path-monsoon-1" },
  { a: "tglocal", b: "lens", w: 4, ts: at(11, 50), path: "path-monsoon-1" },

  // Bridges between communities
  { a: "lynx", b: "newswire", w: 3, type: "mention" },
  { a: "comet", b: "mpulse", w: 2, type: "reply" },
  { a: "ridge", b: "cnow", w: 2, type: "mention" },
  { a: "heron", b: "brief", w: 2, type: "mention" },
  { a: "fguide", b: "maple", w: 3, type: "reply" },
  { a: "tdesk", b: "tgrail", w: 4 },
  { a: "ralerts", b: "tgcomm", w: 5 },
  { a: "mpulse", b: "tgtalk", w: 3 },
  { a: "reporter", b: "tgbreak", w: 4 },
  { a: "tgbreak", b: "tgdigest", w: 4 },
  { a: "tgtalk", b: "tgcomm", w: 4 },
  { a: "tghelp", b: "tgcomm", w: 3 },
  { a: "tgrail", b: "tgdeals", w: 4 },
  { a: "tgwatch", b: "tgsector", w: 3 },
  { a: "tglocal", b: "tgpower", w: 3 },
  { a: "calerts", b: "newswire", w: 3, type: "mention" },
  { a: "river", b: "brief", w: 2, type: "mention" },
  { a: "planner", b: "tdesk", w: 2, type: "mention" },
  { a: "tdesk2", b: "ralerts", w: 2, type: "mention" },
  { a: "cricket", b: "ember", w: 2, type: "retweet" },
  { a: "gadget", b: "delta", w: 2, type: "mention" },
  { a: "boundary", b: "kite", w: 1, type: "mention" },
  { a: "tgexam", b: "tgdigest", w: 3 },
  { a: "tgcampus", b: "tgward", w: 2 },
  { a: "tgcareer", b: "gadget", w: 1 },
];

/* ───────────────────────── Propagation path definitions ───────────────────────── */

interface PathDef {
  id: string;
  topicId: string;
  label: string;
  nodes: string[];
  originAt: string;
  seedKey: string;
}

const PATH_DEFS: PathDef[] = [
  {
    id: "path-railway-1",
    topicId: "t-railway",
    label: "First Line 4 report → cross-platform spread",
    nodes: ["falcon", "tdesk", "newswire", "tgrail", "tgcomm", "tgfamily"],
    originAt: at(8, 4),
    seedKey: "first_report",
  },
  {
    id: "path-railway-2",
    topicId: "t-railway",
    label: "Confirmation thread → station board → travel planners",
    nodes: ["otter", "ralerts", "tgstation", "tgwatch", "pearl"],
    originAt: at(8, 44),
    seedKey: "otter_confirm",
  },
  {
    id: "path-monsoon-1",
    topicId: "t-monsoon",
    label: "Weather advisory → Telegram alerts → civic news",
    nodes: ["wwatch", "tgrain", "tglocal", "lens"],
    originAt: at(9, 15),
    seedKey: "rain_advisory",
  },
];

/* ───────────────────────── Builder ───────────────────────── */

export interface GraphBase {
  communitySpecs: CommunitySpec[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  nodeByKey: Record<string, NetworkNode>;
  nodeById: Record<string, NetworkNode>;
  pathDefs: PathDef[];
}

export const nodeIdOf = (key: string): string => `n_${key}`;

function defaultEdgeType(rng: Rng, from: Platform, to: Platform): EdgeType {
  if (from === "telegram" && to === "telegram") return "forward";
  if (from !== to) return "cross_post";
  const r = rng();
  return r < 0.45 ? "retweet" : r < 0.75 ? "mention" : "reply";
}

export function buildGraphBase(): GraphBase {
  const rng = mulberry32(4242);
  const platformOf: Record<string, Platform> = {};
  const communityOf: Record<string, string> = {};
  for (const cs of COMMUNITY_SPECS) {
    for (const m of cs.members) {
      platformOf[m.key] = m.platform;
      communityOf[m.key] = cs.id;
    }
  }

  const edges: NetworkEdge[] = [];
  const pairs = new Set<string>();
  const addEdge = (a: string, b: string, w: number, type?: EdgeType, ts?: string, path?: string): void => {
    if (a === b) return;
    const pairKey = [a, b].sort().join("|");
    if (pairs.has(pairKey)) return;
    pairs.add(pairKey);
    edges.push({
      id: "",
      source: nodeIdOf(a),
      target: nodeIdOf(b),
      type: type ?? defaultEdgeType(rng, platformOf[a], platformOf[b]),
      weight: w,
      timestamp: ts,
      onPropagationPath: path !== undefined ? true : undefined,
    });
  };

  // 1) explicit story edges and bridges first (they win over generated duplicates)
  for (const e of EXPLICIT) addEdge(e.a, e.b, e.w, e.type, e.ts, e.path);

  // 2) dense intra-community structure: hubs first, then random reinforcing links
  for (const cs of COMMUNITY_SPECS) {
    const keys = cs.members.map((m) => m.key);
    keys.forEach((key, k) => {
      if (k === 0) return;
      const parent = keys[Math.floor(rng() * Math.min(k, 3))];
      addEdge(parent, key, 1 + Math.floor(rng() * 4));
    });
    keys.forEach((key, k) => {
      if (rng() < 0.78) {
        const other = pick(rng, keys);
        if (rng() < 0.5) addEdge(key, other, 1 + Math.floor(rng() * 3));
        else addEdge(other, key, 1 + Math.floor(rng() * 3));
      }
      if (k < 3) {
        for (let n = 0; n < 2; n++) addEdge(key, pick(rng, keys), 2 + Math.floor(rng() * 4));
      }
    });
  }

  edges.forEach((e, idx) => {
    e.id = `e${String(idx + 1).padStart(3, "0")}`;
  });

  // Metrics
  const outStrength: Record<string, number> = {};
  const degree: Record<string, number> = {};
  const inDeg: Record<string, number> = {};
  const outDeg: Record<string, number> = {};
  const neighbours: Record<string, Set<string>> = {};
  for (const cs of COMMUNITY_SPECS) {
    for (const m of cs.members) {
      const id = nodeIdOf(m.key);
      outStrength[id] = 0;
      degree[id] = 0;
      inDeg[id] = 0;
      outDeg[id] = 0;
      neighbours[id] = new Set();
    }
  }
  for (const e of edges) {
    outStrength[e.source] += e.weight;
    degree[e.source] += 1;
    degree[e.target] += 1;
    outDeg[e.source] += 1;
    inDeg[e.target] += 1;
    neighbours[e.source].add(e.target);
    neighbours[e.target].add(e.source);
  }
  const maxOut = Math.max(...Object.values(outStrength));
  const maxDeg = Math.max(...Object.values(degree));

  const nodes: NetworkNode[] = [];
  for (const cs of COMMUNITY_SPECS) {
    for (const m of cs.members) {
      const id = nodeIdOf(m.key);
      const reachSet = new Set<string>();
      for (const nb of neighbours[id]) {
        const nbKey = nb.slice(2);
        if (communityOf[nbKey] !== cs.id) reachSet.add(communityOf[nbKey]);
      }
      nodes.push({
        id,
        label: m.label,
        type: m.platform === "telegram" ? "channel" : "user",
        platform: m.platform,
        communityId: cs.id,
        role: "member",
        degree: degree[id],
        inDegree: inDeg[id],
        outDegree: outDeg[id],
        influence: round2(0.7 * (outStrength[id] / maxOut) + 0.3 * (degree[id] / maxDeg)),
        communityReach: reachSet.size,
        postCount: 0,
        topicIds: [],
      });
    }
  }

  const byInfluence = [...nodes].sort((a, b) => b.influence - a.influence);
  const hubIds = new Set(byInfluence.slice(0, 8).map((n) => n.id));
  for (const n of nodes) {
    n.role = hubIds.has(n.id) ? "hub" : n.communityReach >= 2 ? "bridge" : "member";
  }

  const nodeByKey: Record<string, NetworkNode> = {};
  const nodeById: Record<string, NetworkNode> = {};
  for (const n of nodes) {
    nodeByKey[n.id.slice(2)] = n;
    nodeById[n.id] = n;
  }

  return { communitySpecs: COMMUNITY_SPECS, nodes, edges, nodeByKey, nodeById, pathDefs: PATH_DEFS };
}

/* ───────────────────────── Finalise with post-derived facts ───────────────────────── */

export function finalizeGraph(
  base: GraphBase,
  posts: SocialPost[],
  topics: { id: string; name: string }[],
  seedIdByKey: Record<string, string>,
): NetworkGraph {
  const topicName = Object.fromEntries(topics.map((t) => [t.id, t.name])) as Record<string, string>;

  // Node facts derived from the Data Explorer sample
  const topicsByNode: Record<string, Set<string>> = {};
  const countByNode: Record<string, number> = {};
  for (const p of posts) {
    countByNode[p.authorId] = (countByNode[p.authorId] ?? 0) + 1;
    if (p.topic) {
      (topicsByNode[p.authorId] ??= new Set()).add(p.topic.id);
    }
  }
  const nodes: NetworkNode[] = base.nodes.map((n) => ({
    ...n,
    postCount: countByNode[n.id] ?? 0,
    topicIds: [...(topicsByNode[n.id] ?? [])].sort(),
  }));
  const nodeById: Record<string, NetworkNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));

  // Communities
  const communities: Community[] = base.communitySpecs.map((cs) => {
    const memberIds = cs.members.map((m) => nodeIdOf(m.key));
    const memberSet = new Set(memberIds);
    const platformCount: Record<Platform, number> = { x: 0, telegram: 0 };
    for (const m of cs.members) platformCount[m.platform] += 1;
    const platformMix: PlatformShare[] = (["x", "telegram"] as Platform[])
      .filter((p) => platformCount[p] > 0)
      .map((p) => ({
        platform: p,
        mentions: platformCount[p],
        sharePct: round1((platformCount[p] / cs.members.length) * 100),
      }));

    let counts = emptyCounts();
    const topicPosts: Record<string, number> = {};
    for (const p of posts) {
      if (!memberSet.has(p.authorId)) continue;
      if (p.sentiment) counts = addCounts(counts, { positive: 0, neutral: 0, negative: 0, [p.sentiment]: 1 });
      if (p.topic) topicPosts[p.topic.id] = (topicPosts[p.topic.id] ?? 0) + 1;
    }
    const topTopics = Object.entries(topicPosts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([topicId, n]) => ({ topicId, name: topicName[topicId] ?? topicId, posts: n }));

    let internal = 0;
    let external = 0;
    for (const e of base.edges) {
      const s = memberSet.has(e.source);
      const t = memberSet.has(e.target);
      if (s && t) internal += 1;
      else if (s || t) external += 1;
    }

    const hubNodeIds = memberIds
      .map((id) => nodeById[id])
      .sort((a, b) => b.influence - a.influence)
      .slice(0, 3)
      .map((n) => n.id);

    return {
      id: cs.id,
      name: cs.name,
      description: cs.description,
      color: cs.color,
      size: cs.members.length,
      platformMix,
      topTopics,
      sentiment: summarize(counts),
      cohesion: internal + external === 0 ? 0 : round2(internal / (internal + external)),
      hubNodeIds,
    };
  });

  // Propagation paths
  const edgeByPair: Record<string, NetworkEdge> = {};
  for (const e of base.edges) edgeByPair[`${e.source}>${e.target}`] = e;
  const adjacency: Record<string, Set<string>> = {};
  for (const e of base.edges) {
    (adjacency[e.source] ??= new Set()).add(e.target);
    (adjacency[e.target] ??= new Set()).add(e.source);
  }

  const propagationPaths: PropagationPath[] = base.pathDefs.map((def) => {
    const ids = def.nodes.map(nodeIdOf);
    const edgeIds: string[] = [];
    const hops: PropagationPath["hops"] = [{ nodeId: ids[0], at: def.originAt }];
    let platformJumps = 0;
    let communityJumps = 0;
    for (let k = 1; k < ids.length; k++) {
      const edge = edgeByPair[`${ids[k - 1]}>${ids[k]}`];
      if (!edge) throw new Error(`Propagation edge missing: ${ids[k - 1]} → ${ids[k]}`);
      edgeIds.push(edge.id);
      hops.push({ nodeId: ids[k], at: edge.timestamp ?? def.originAt, via: edge.type });
      if (nodeById[ids[k - 1]].platform !== nodeById[ids[k]].platform) platformJumps += 1;
      if (nodeById[ids[k - 1]].communityId !== nodeById[ids[k]].communityId) communityJumps += 1;
    }
    const reached = new Set<string>();
    for (const id of ids) for (const nb of adjacency[id] ?? []) if (!ids.includes(nb)) reached.add(nb);
    const started = Date.parse(hops[0].at);
    const ended = Date.parse(hops[hops.length - 1].at);
    return {
      id: def.id,
      topicId: def.topicId,
      topicName: topicName[def.topicId] ?? def.topicId,
      label: def.label,
      hops,
      edgeIds,
      startedAt: hops[0].at,
      durationMinutes: Math.round((ended - started) / 60000),
      platformsCrossed: platformJumps,
      communitiesCrossed: communityJumps,
      nodesReached: reached.size,
      seedPostId: seedIdByKey[def.seedKey],
    };
  });

  const n = nodes.length;
  const m = base.edges.length;
  return {
    nodes,
    edges: base.edges,
    communities,
    propagationPaths,
    metrics: {
      nodeCount: n,
      edgeCount: m,
      communityCount: communities.length,
      density: round2(m / (n * (n - 1))),
      avgDegree: round1((2 * m) / n),
    },
  };
}
