/**
 * Consistency checks for the simulated dataset.
 * Run with: npm run verify:mock
 *
 * The point of Phase 1's data layer is that every page tells the SAME story.
 * These assertions make that a testable property instead of a hope.
 */
import { getDataset } from "@/data/mock/dataset";
import {
  queryAlert,
  queryAlerts,
  queryNetwork,
  queryOverview,
  queryPosts,
  querySentiment,
  queryTrend,
  queryTrends,
} from "@/data/mock/queries";
import { bucketTotal } from "@/data/mock/aggregate";
import { BUCKETS, WINDOW_START_INDEX } from "@/data/mock/scenario";

let failures = 0;
let passes = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    passes += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${name}${detail ? `  →  ${detail}` : ""}`);
  }
}
const section = (title: string): void => console.log(`\n${title}`);

const ds = getDataset();
const overview = queryOverview();
const trends = queryTrends();
const railway = queryTrend("tr-railway");
const power = queryTrend("tr-power");

section("Determinism");
{
  const again = queryPosts({ pageSize: 100, sort: "oldest" }).items.map((p) => p.id + p.text).join("|");
  const first = queryPosts({ pageSize: 100, sort: "oldest" }).items.map((p) => p.id + p.text).join("|");
  check("repeated queries return identical data", again === first);
}

section("Hero story — Railway Disruption");
check("trend exists", railway !== null);
if (railway) {
  const h = ds.hourly["t-railway"];
  const v = (i: number) => bucketTotal(h[i]);
  check("120 mentions/hour when first detected", v(42) === 120, `got ${v(42)}`);
  check("250 mentions/hour when the alert was raised", v(44) === 250, `got ${v(44)}`);
  check("530 mentions/hour in the latest hour", v(BUCKETS - 1) === 530, `got ${v(BUCKETS - 1)}`);
  check("status is emerging", railway.status === "emerging", railway.status);
  check("trend score ≥ 85", railway.trendScore >= 85, String(railway.trendScore));
  check("confidence ≥ 0.85", railway.confidence >= 0.85, String(railway.confidence));
  check("first detected at 09:05 UTC", railway.firstDetectedAt?.startsWith("2026-09-20T09:05") === true, String(railway.firstDetectedAt));
  check("negative share rises from ~22% to ≥ 65%", ds.sentiment.changes.find((c) => c.topicId === "t-railway")!.negativePctNow >= 60);
  check("Telegram share of mentions grows from ≤ 12% to ≥ 35%", (() => {
    const first = bucketTotal(h[42], "telegram") / v(42);
    const last = bucketTotal(h[47], "telegram") / v(47);
    return first <= 0.12 && last >= 0.35;
  })());
  check("4 communities engaged", railway.communities.filter((c) => c.postCount >= 3).length === 4, railway.communities.map((c) => `${c.name}:${c.postCount}`).join(", "));
  check("has detected → platform → alert → community → current milestones",
    ["detected", "platform", "alert", "community", "current"].every((k) => railway.milestones.some((m) => m.kind === k)),
    railway.milestones.map((m) => m.kind).join(","));
  check("milestones are chronological", railway.milestones.every((m, i, a) => i === 0 || a[i - 1].ts <= m.ts));
}

section("Alerts");
{
  const alerts = queryAlerts();
  check("3 alerts (2 active, 1 resolved)", alerts.length === 3 && alerts.filter((a) => a.status !== "resolved").length === 2);
  for (const a of alerts) {
    check(`${a.id}: ≥ 3 of 6 signals fired`, a.evidence.filter((s) => s.fired).length >= 3);
    check(`${a.id}: whyBullets match fired signals`, a.whyBullets.length === a.evidence.filter((s) => s.fired).length);
    check(`${a.id}: signal weights sum to 1`, Math.abs(a.evidence.reduce((n, s) => n + s.weight, 0) - 1) < 1e-9);
    check(`${a.id}: linked trend exists`, queryTrend(a.trendId) !== null);
    check(`${a.id}: history starts with system creation`, a.history[0].actor === "system" && a.history[0].status === "new");
    const d = queryAlert(a.id);
    check(`${a.id}: detail has supporting posts`, !!d && d.supportingPosts.length > 0);
    check(`${a.id}: supporting posts are about the alert topic`, !!d && d.supportingPosts.every((p) => p.topic?.id === a.topicId));
  }
  const railAlert = alerts.find((a) => a.topicId === "t-railway");
  check("railway alert raised after first detection", !!railAlert && !!railway?.firstDetectedAt && railAlert.createdAt > railway.firstDetectedAt);
  check("railway alert is High severity", railAlert?.severity === "high", String(railAlert?.severity));
  check("overview alert marker matches railway alert", overview.alertMarkerAt === railAlert?.createdAt);
}

section("Low-confidence contrast — Power Outage Reports");
check("present but not an emerging trend", power !== null && power.status !== "emerging", String(power?.status));
check("low confidence (< 0.5)", (power?.confidence ?? 1) < 0.5, String(power?.confidence));
check("no alert raised", (power?.alertIds.length ?? 1) === 0);
check("Telegram-dominated", (power?.platforms.find((p) => p.platform === "telegram")?.sharePct ?? 0) > 80);

section("Cross-page agreement");
{
  const total24 = ds.trends.reduce((n, t) => n + t.mentions24h, 0);
  check("overview posts analysed = sum of trend mentions", overview.kpis.postsAnalyzed24h === total24, `${overview.kpis.postsAnalyzed24h} vs ${total24}`);
  check("sentiment total = overview total", querySentiment().overall.total === overview.kpis.postsAnalyzed24h);
  check("sentiment timeline has 24 hourly points", querySentiment().timeline.length === 24);
  check("activity timeline has 24 hourly points", overview.activity.length === 24);
  check("platform shares sum to ~100%", Math.abs(overview.platformDistribution.reduce((n, p) => n + p.sharePct, 0) - 100) < 0.2);
  check("emerging KPI matches trend list", overview.kpis.emergingTrends === trends.filter((t) => t.status === "emerging").length);
  check("active alerts KPI matches alert list", overview.kpis.activeAlerts === queryAlerts({ status: "active" }).length);
  check("byTopic totals sum to the overall total", querySentiment().byTopic.reduce((n, t) => n + t.summary.total, 0) === querySentiment().overall.total);
  for (const t of trends) {
    const s = t.sentiment;
    check(`${t.name}: sentiment % sums to 100`, Math.abs(s.positivePct + s.neutralPct + s.negativePct - 100) < 0.11);
    check(`${t.name}: platform shares sum to 100`, Math.abs(t.platforms.reduce((n, p) => n + p.sharePct, 0) - 100) < 0.2);
  }
  check("window is the last 24 buckets", WINDOW_START_INDEX === BUCKETS - 24);
}

section("Posts ↔ topics ↔ network");
{
  const posts = ds.posts;
  const nodeIds = new Set(ds.graph.nodes.map((n) => n.id));
  const topicIds = new Set(ds.topics.map((t) => t.id));
  check(`${posts.length} posts indexed`, posts.length >= 300);
  check("post ids are unique", new Set(posts.map((p) => p.id)).size === posts.length);
  check("every post has an author that exists in the network", posts.every((p) => nodeIds.has(p.authorId)));
  check("every post platform matches its author's platform", posts.every((p) => ds.graph.nodes.find((n) => n.id === p.authorId)?.platform === p.platform));
  check("every post references a known topic", posts.every((p) => p.topic && topicIds.has(p.topic.id)));
  check("every post has sentiment and community", posts.every((p) => p.sentiment && p.community));
  check("posts are inside the 48h dataset", posts.every((p) => Date.parse(p.timestamp) >= Date.parse(ds.hourly["t-railway"][0].ts) && Date.parse(p.timestamp) < Date.parse(overview.windowEnd)));
  check("hashtags extracted from text", posts.every((p) => p.hashtags.every((h) => p.text.includes(`#${h}`))));
  check("all identities are synthetic", ds.graph.nodes.every((n) => /^@anon_|_demo$|^Demo · /.test(n.label)));

  const g = ds.graph;
  check("68 nodes / 7 communities", g.nodes.length === 68 && g.communities.length === 7);
  check("edges reference existing nodes", g.edges.every((e) => nodeIds.has(e.source) && nodeIds.has(e.target)));
  check("edge ids are unique", new Set(g.edges.map((e) => e.id)).size === g.edges.length);
  check("no self loops or duplicate pairs", new Set(g.edges.map((e) => [e.source, e.target].sort().join("|"))).size === g.edges.length && g.edges.every((e) => e.source !== e.target));
  check("community sizes add up to node count", g.communities.reduce((n, c) => n + c.size, 0) === g.nodes.length);
  check("influence within 0–1", g.nodes.every((n) => n.influence >= 0 && n.influence <= 1));
  check("8 hubs identified", g.nodes.filter((n) => n.role === "hub").length === 8);
  check("cross-platform edges use the cross_post type", g.edges.every((e) => {
    const a = g.nodes.find((n) => n.id === e.source)!;
    const b = g.nodes.find((n) => n.id === e.target)!;
    return a.platform === b.platform || e.type === "cross_post";
  }));
  for (const p of g.propagationPaths) {
    check(`${p.id}: hops are chronological`, p.hops.every((h, i, a) => i === 0 || a[i - 1].at <= h.at));
    check(`${p.id}: seed post exists and is about ${p.topicName}`, !!p.seedPostId && posts.find((x) => x.id === p.seedPostId)?.topic?.id === p.topicId);
    check(`${p.id}: seed post is by the origin node`, posts.find((x) => x.id === p.seedPostId)?.authorId === p.hops[0].nodeId);
  }
  const railPath = g.propagationPaths.find((p) => p.id === "path-railway-1");
  check("railway path crosses from X to Telegram", (railPath?.platformsCrossed ?? 0) >= 1);

  const railSub = queryNetwork({ topicId: "t-railway" });
  check("railway subgraph spans 4+ communities", railSub.communities.length >= 4, String(railSub.communities.length));
  check("railway subgraph excludes sports/tech community", !railSub.communities.some((c) => c.id === "c6"));
  check("subgraph edges only join included nodes", railSub.edges.every((e) => railSub.nodes.some((n) => n.id === e.source) && railSub.nodes.some((n) => n.id === e.target)));
  check("railway propagation paths present in subgraph", railSub.propagationPaths.length === 2);
}

section("Explorer queries");
{
  check("filter by topic", queryPosts({ topicId: "t-railway", pageSize: 100 }).items.every((p) => p.topic?.id === "t-railway"));
  check("filter by platform", queryPosts({ platform: "telegram", pageSize: 100 }).items.every((p) => p.platform === "telegram"));
  check("filter by sentiment", queryPosts({ sentiment: "negative", pageSize: 100 }).items.every((p) => p.sentiment === "negative"));
  check("range filter", queryPosts({ rangeHours: 1, pageSize: 100 }).items.every((p) => Date.parse(p.timestamp) >= Date.parse(overview.windowEnd) - 3_600_000));
  check("search matches text", queryPosts({ q: "meridian", pageSize: 100 }).items.length > 0);
  check("search by hashtag", queryPosts({ q: "#Line4Delay", pageSize: 100 }).items.length > 0);
  check("no-result search is empty", queryPosts({ q: "zzzz-no-match" }).total === 0);
  const p1 = queryPosts({ pageSize: 20, page: 1 });
  const p2 = queryPosts({ pageSize: 20, page: 2 });
  check("pagination returns distinct pages", p1.items[0].id !== p2.items[0].id && p1.total === p2.total);
  const top = queryPosts({ sort: "engagement", pageSize: 1 }).items[0];
  check("most engaged post is the viral railway complaint", top.topic?.id === "t-railway" && (top.engagement.likes ?? 0) > 8000);
}

section("Trend list");
{
  const byScore = queryTrends({ sort: "score" });
  check("sorted by score (railway first)", byScore[0].id === "tr-railway");
  check("status filter", queryTrends({ status: "declining" }).every((t) => t.status === "declining"));
  check("at least one declining and one stable trend for contrast", trends.some((t) => t.status === "declining") && trends.some((t) => t.status === "stable"));
  check("sparklines have 12 points", trends.every((t) => t.sparkline.length === 12));
  check("detail timelines have 24 points", ds.trends.every((t) => t.timeline.length === 24 && t.sentimentTimeline.length === 24));
}

console.log(`\n${passes} passed, ${failures} failed`);
if (failures > 0) process.exit(1);
