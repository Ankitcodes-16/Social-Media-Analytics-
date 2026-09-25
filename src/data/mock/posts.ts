import type { Engagement, Platform, Sentiment, SocialPost } from "@/types";
import { nodeIdOf, type GraphBase } from "./graph";
import { TOPIC_SPECS, type HourBucket } from "./topics";
import { MINUTE_MS, at, bucketStartMs } from "./scenario";
import { bucketCounts, bucketTotal } from "./aggregate";
import { mulberry32, pick, weightedPick, type Rng } from "./random";

/**
 * Simulated Data Explorer sample. Posts are placed according to the same hourly
 * volume / platform / sentiment series that drives every chart, and authored by
 * the same nodes that appear in the network graph — so all pages agree.
 */

type Tpl = string | { text: string; lang?: string; minBucket?: number };
type Pool = Partial<Record<Sentiment, Tpl[]>>;
interface TopicTemplates {
  x?: Pool;
  telegram?: Pool;
  any: Pool;
}

const STATIONS = ["Meridian Central", "North Gate", "Harbor Junction", "Eastfield", "Riverside Halt", "Old Market"];
const LINES = ["Line 4", "Line 4", "Line 4", "Line 2", "Northern Corridor"];
const MINS = [25, 35, 40, 55, 70, 90, 120];

const TEMPLATES: Record<string, TopicTemplates> = {
  "t-railway": {
    any: {
      negative: [
        "{line} has been stuck outside {station} for {mins} minutes. Zero announcements. #RailwayDisruption",
        "Signal failure again? Whole platform at {station} is packed and nobody knows what is going on. #Line4Delay #RailwayDisruption",
        "Stranded at {station} since morning. Trains cancelled, no refund info anywhere. #StrandedPassengers",
        "How is there no backup plan for a signal fault? People waiting {mins}+ minutes at {station}. #RailwayDisruption",
        "Shuttle buses from {station} are already full and the queue goes round the block. #RailwayDisruption",
        "Third time this week {line} is late, and today it is completely down. Enough. #Line4Delay",
        "Platform crowding at {station} is getting unsafe. Please stagger entry. #PlatformSafety #RailwayDisruption",
        "Missed my connection because of the {line} shutdown. The refund process is a maze. #RailwayRefund",
        "Update from the ground: {station} concourse packed, staff have no information, {mins} minute wait and counting. #RailwayDisruption",
        "Anyone know alternate routes from {station}? {line} is not moving at all. #Commute #RailwayDisruption",
        { text: "{station} स्टेशन पर {mins} मिनट से ट्रेन का इंतज़ार, कोई घोषणा नहीं। #RailwayDisruption", lang: "hi" },
        { text: "सिग्नल खराबी की वजह से पूरी लाइन ठप है, यात्री परेशान। #Line4Delay", lang: "hi" },
      ],
      neutral: [
        "Transit authority says a signalling fault on {line} near {station} is under investigation. Updates to follow. #RailwayDisruption",
        "Reports of delays on {line}. Some services diverted via Harbor Junction. #Line4Delay",
        "Reminder: refunds for cancelled services can be requested through the ticketing desk. #RailwayRefund",
        "Shuttle bus service now running between {station} and Old Market. #RailwayDisruption",
      ],
      positive: [
        "Big thanks to the station staff at {station} handing out water and guiding people. #RailwayDisruption",
        "Shuttle buses are moving smoothly from {station} now, good response. #Commute",
        "Volunteers helping older passengers at {station}. Good to see. #RailwayDisruption",
      ],
    },
    telegram: {
      negative: [
        "⚠️ Forwarded: {line} services suspended near {station} due to signal failure. Passengers report {mins}+ minute waits and overcrowded platforms. Share with anyone travelling. #RailwayDisruption",
        "Commuters stuck at {station}: no announcements, no refund guidance. Admins, please share alternate routes. #RailwayDisruption",
        "Platform at {station} is dangerously crowded. Avoid the area if you can. #PlatformSafety",
        "Family stuck on {line} for {mins} minutes. Anyone with updates from the control room? #StrandedPassengers",
      ],
      neutral: [
        "Update: authority confirms a signalling fault on {line}. Engineers on site. No restoration time given. #RailwayDisruption",
        "Alternate route thread: buses from {station} to Old Market every 15 minutes. Reply with your experience. #Commute",
        "Digest: {line} disruption, shuttle buses, refund window — everything in one post. #RailwayDisruption",
      ],
      positive: ["Volunteers organising water and seating at {station}. Thanks to everyone helping out. #RailwayDisruption"],
    },
  },
  "t-monsoon": {
    any: {
      neutral: [
        "Heavy rain advisory issued for the next 24 hours. Stay indoors if possible. #MonsoonAlert",
        "Rainfall total crossed 80mm since morning. #MonsoonAlert",
        "Traffic police advise avoiding low-lying roads until the rain eases. #Waterlogging",
      ],
      negative: [
        "Underpass on Ring Road is flooded, avoid. #Waterlogging",
        "Third flooding this month and still no drainage upgrade. #Waterlogging",
        "Water entering ground-floor shops again near the market. #MonsoonAlert #Waterlogging",
      ],
      positive: [
        "Drainage crews out in force, water receding in Sector 9. #Waterlogging",
        "Thanks to the volunteers pumping out the lane. #MonsoonAlert",
      ],
    },
    telegram: {
      neutral: ["Rain alerts thread: report waterlogged roads here with the location. #MonsoonAlert"],
      negative: ["Sector 9 lane under knee-deep water, please share to warn others. #Waterlogging"],
    },
  },
  "t-festival": {
    any: {
      neutral: [
        "Booked early for the festival week, prices already climbing. #FestivalTravel",
        "Which day is best to travel for the long weekend? #FestivalTravel",
        "Ticket exchange thread for festival week is open. #FestivalTravel",
      ],
      positive: [
        "Excited for the long weekend trip! Bags packed. #FestivalTravel",
        "Found a great early-booking deal for the festival. #FestivalTravel",
      ],
      negative: [
        "Festival ticket prices are ridiculous this year. #FestivalTravel",
        { text: "Festival crowds plus the rail chaos — leaving a day early. #FestivalTravel #RailwayDisruption", minBucket: 43 },
        { text: "Our festival trip plan is a mess with Line 4 down. Any alternatives? #FestivalTravel #RailwayDisruption", minBucket: 44 },
      ],
    },
  },
  "t-power": {
    any: {
      negative: [
        "Power cut in Sector 12 for {mins} minutes now, anyone else? #PowerOutage",
        "Third outage this week in Sector 12. #PowerOutage",
        "Generators running at the market, but shops are closing early. #PowerOutage",
        "No power, no water pump, Sector 12 block C waiting. #PowerOutage",
      ],
      neutral: ["Utility desk says transformer fault in Sector 12, restoration expected in about 2 hours. #PowerOutage"],
      positive: ["Power is back in block C, thanks to the repair crew. #PowerOutage"],
    },
  },
  "t-cricket": {
    any: {
      positive: [
        "What an innings! That final over had the whole stadium on its feet. #CricketFinal",
        "Captain leading from the front, best chase of the season. #CricketFinal",
        "Bowling attack was unplayable today. Take a bow. #CricketFinal",
        "Series decider lives up to the hype! #CricketFinal",
      ],
      neutral: [
        "Toss won, opting to bat first. Pitch looks dry. #CricketFinal",
        "Match delayed 20 minutes due to light drizzle. #CricketFinal",
        "Stats: three centuries in the series so far. #CricketFinal",
      ],
      negative: [
        "That review call was a disaster. Umpiring needs to improve. #CricketFinal",
        "Ticket queue was a nightmare, half the stand still empty at the start. #CricketFinal",
      ],
    },
    telegram: { neutral: ["Live thread: over-by-over discussion for the final. Join in. #CricketFinal"] },
  },
  "t-phone": {
    any: {
      positive: [
        "Just unboxed the new model, the camera upgrade is real. #PhoneLaunch",
        "Display is gorgeous, best in class. #PhoneLaunch",
      ],
      neutral: [
        "Battery life claims look optimistic, waiting for independent tests. #PhoneLaunch",
        "Launch event recap: three features worth knowing. #PhoneLaunch",
      ],
      negative: [
        "Pricing at this level is hard to justify for minor upgrades. #PhoneLaunch",
        "No charger in the box again? Come on. #PhoneLaunch",
      ],
    },
  },
  "t-exam": {
    any: {
      neutral: [
        "Exam results will be published at 5 PM on the official portal. Keep roll numbers ready. #ExamResults",
        "Re-evaluation form opens Monday, steps below. #ExamResults",
      ],
      negative: [
        "Portal is crashing again, can't check my result. #ExamResults",
        "Server keeps timing out. Third attempt now. #ExamResults",
      ],
      positive: [
        "Cleared with distinction! Thanks to everyone in the study group. #ExamResults",
        "Result is out and I passed, so relieved. #ExamResults",
      ],
    },
  },
  "t-fuel": {
    any: {
      negative: [
        "Fuel prices up again this week. Commuting costs are adding up. #FuelPrice",
        "Price hike will hit small businesses hardest. #FuelPrice",
        "Diesel up again, delivery costs will follow. #FuelPrice",
      ],
      neutral: [
        "Petrol pumps report normal supply, prices revised at midnight. #FuelPrice",
        "Fuel price table for this week attached. #FuelPrice",
      ],
      positive: ["Carpool group saved us a lot this month, worth trying. #FuelPrice"],
    },
  },
  "t-metro": {
    any: {
      neutral: [
        "Fare revision announced: new slabs from next month. #MetroFare",
        "Metro fare slab chart explained in one thread. #MetroFare",
      ],
      negative: [
        "A fare hike with no service improvement? Hard pass. #MetroFare",
        "Daily commute cost just went up by about 15%. #MetroFare",
        "Fare revision hits daily riders the hardest. #MetroFare",
      ],
      positive: ["Student concessions retained, at least that is good. #MetroFare"],
    },
  },
};

/* ───────────────────────── Hand-authored story posts ───────────────────────── */

interface SeedPost {
  key: string;
  nodeKey: string;
  at: string;
  topicId: string;
  sentiment: Sentiment;
  text: string;
  engagement: Engagement;
}

const SEEDS: SeedPost[] = [
  {
    key: "first_report",
    nodeKey: "falcon",
    at: at(8, 4),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Line 4 has stopped outside Meridian Central and there is a signal failure notice on the board. Everyone is stuck. #RailwayDisruption #Line4Delay",
    engagement: { likes: 142, replies: 37, shares: 64, views: 9800 },
  },
  {
    key: "tdesk_ack",
    nodeKey: "tdesk",
    at: at(8, 31),
    topicId: "t-railway",
    sentiment: "neutral",
    text: "We are aware of a signalling fault affecting Line 4 near Meridian Central. Engineers are on site. Updates to follow. #RailwayDisruption",
    engagement: { likes: 410, replies: 88, shares: 305, views: 41000 },
  },
  {
    key: "otter_confirm",
    nodeKey: "otter",
    at: at(8, 44),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Confirmed: all of Line 4 is down, trains not moving from North Gate either. #Line4Delay",
    engagement: { likes: 96, replies: 21, shares: 44, views: 6400 },
  },
  {
    key: "newswire_break",
    nodeKey: "newswire",
    at: at(8, 52),
    topicId: "t-railway",
    sentiment: "neutral",
    text: "BREAKING: Line 4 services suspended after a signalling fault; commuters advised to expect long delays. #RailwayDisruption",
    engagement: { likes: 880, replies: 142, shares: 610, views: 72000 },
  },
  {
    key: "tgrail_fwd",
    nodeKey: "tgrail",
    at: at(9, 12),
    topicId: "t-railway",
    sentiment: "neutral",
    text: "🚨 Rail Updates: Line 4 suspended after a signalling fault near Meridian Central. Forwarded from X. Alternate routes in thread. #RailwayDisruption",
    engagement: { likes: 320, replies: 45, shares: 410, views: 18500 },
  },
  {
    key: "ralerts_shuttle",
    nodeKey: "ralerts",
    at: at(9, 20),
    topicId: "t-railway",
    sentiment: "neutral",
    text: "Line 4 disruption: shuttle buses expected within the hour according to the control room. #RailwayDisruption",
    engagement: { likes: 260, replies: 54, shares: 190, views: 28000 },
  },
  {
    key: "tgcomm_stuck",
    nodeKey: "tgcomm",
    at: at(9, 35),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Passengers stuck at Meridian Central for over an hour with no announcements. Please share. #StrandedPassengers",
    engagement: { likes: 210, replies: 64, shares: 280, views: 12400 },
  },
  {
    key: "tgstation_refund",
    nodeKey: "tgstation",
    at: at(9, 50),
    topicId: "t-railway",
    sentiment: "neutral",
    text: "Station Info: refund window and alternate route list for Line 4 passengers posted below. #RailwayRefund",
    engagement: { likes: 150, replies: 22, shares: 175, views: 9600 },
  },
  {
    key: "tgwatch_crowd",
    nodeKey: "tgwatch",
    at: at(9, 58),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Overcrowding on platform 3 at Meridian Central, please avoid. #PlatformSafety #RailwayDisruption",
    engagement: { likes: 118, replies: 31, shares: 140, views: 7200 },
  },
  {
    key: "pearl_festival",
    nodeKey: "pearl",
    at: at(11, 15),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Festival trip in jeopardy: the trains we booked are cancelled thanks to the Line 4 shutdown. #FestivalTravel #RailwayDisruption",
    engagement: { likes: 74, replies: 19, shares: 22, views: 4900 },
  },
  {
    key: "tgfamily_leave",
    nodeKey: "tgfamily",
    at: at(11, 40),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Planning to leave a day early for the festival because of the Line 4 chaos. Suggest alternate travel dates. #FestivalTravel #RailwayDisruption",
    engagement: { likes: 88, replies: 27, shares: 54, views: 5100 },
  },
  {
    key: "viral_complaint",
    nodeKey: "lynx",
    at: at(12, 20),
    topicId: "t-railway",
    sentiment: "negative",
    text: "Two hours at Meridian Central. No refund info, no staff, no plan. This is unacceptable. #RailwayDisruption",
    engagement: { likes: 8412, replies: 1204, shares: 3920, views: 310000 },
  },
  {
    key: "rain_advisory",
    nodeKey: "wwatch",
    at: at(9, 15),
    topicId: "t-monsoon",
    sentiment: "neutral",
    text: "Heavy rain advisory for the next 24 hours. Waterlogging likely in Ring Road underpasses. #MonsoonAlert #Waterlogging",
    engagement: { likes: 540, replies: 61, shares: 310, views: 38000 },
  },
  {
    key: "tgrain_fwd",
    nodeKey: "tgrain",
    at: at(9, 40),
    topicId: "t-monsoon",
    sentiment: "neutral",
    text: "Rain Alerts: advisory forwarded. Report flooded roads in this thread with the location. #MonsoonAlert",
    engagement: { likes: 230, replies: 40, shares: 260, views: 11000 },
  },
  {
    key: "tglocal_underpass",
    nodeKey: "tglocal",
    at: at(10, 25),
    topicId: "t-monsoon",
    sentiment: "negative",
    text: "Ring Road underpass already under water. Avoid. #Waterlogging",
    engagement: { likes: 190, replies: 33, shares: 210, views: 9200 },
  },
  {
    key: "lens_drainage",
    nodeKey: "lens",
    at: at(11, 50),
    topicId: "t-monsoon",
    sentiment: "neutral",
    text: "Civic desk: drainage crews dispatched to Ring Road and Sector 9. #Waterlogging",
    engagement: { likes: 310, replies: 47, shares: 180, views: 21000 },
  },
];

/* ───────────────────────── Community weights per topic ───────────────────────── */

type CommunityWeights = Record<string, number>;

function communityWeights(topicId: string, platform: Platform, bucket: number): CommunityWeights {
  const x = platform === "x";
  switch (topicId) {
    case "t-railway":
      return x ? { c1: 0.6, c2: 0.3, c4: bucket >= 45 ? 0.1 : 0 } : { c3: 0.85, c4: bucket >= 45 ? 0.15 : 0 };
    case "t-monsoon":
      return x ? { c5: 0.5, c2: 0.3, c1: 0.2 } : { c5: 0.4, c3: 0.6 };
    case "t-festival":
      return x ? { c4: 0.6, c1: 0.4 } : { c4: 1 };
    case "t-power":
      return x ? { c5: 0.6, c1: 0.4 } : { c5: 0.7, c3: 0.3 };
    case "t-cricket":
    case "t-phone":
      return x ? { c6: 1 } : { c3: 1 };
    case "t-exam":
      return x ? { c1: 0.5, c2: 0.5 } : { c7: 0.85, c3: 0.15 };
    default:
      return x ? { c1: 0.5, c2: 0.5 } : { c3: 1 };
  }
}

/* ───────────────────────── Generation helpers ───────────────────────── */

const normalize = (t: Tpl): { text: string; lang: string; minBucket: number } =>
  typeof t === "string"
    ? { text: t, lang: "en", minBucket: 0 }
    : { text: t.text, lang: t.lang ?? "en", minBucket: t.minBucket ?? 0 };

function fill(rng: Rng, text: string): string {
  return text
    .replace(/\{station\}/g, () => pick(rng, STATIONS))
    .replace(/\{line\}/g, () => pick(rng, LINES))
    .replace(/\{mins\}/g, () => String(pick(rng, MINS)));
}

function candidateTemplates(topicId: string, platform: Platform, sentiment: Sentiment, bucket: number) {
  const t = TEMPLATES[topicId];
  const list = [...(t[platform]?.[sentiment] ?? []), ...(t.any[sentiment] ?? [])].map(normalize);
  const eligible = list.filter((x) => x.minBucket <= bucket);
  if (eligible.length > 0) return eligible;
  return (t.any.neutral ?? t.any.negative ?? t.any.positive ?? []).map(normalize);
}

function engagementFor(rng: Rng, platform: Platform, influence: number, boost: number): Engagement {
  const base = Math.exp(rng() * 3.4) * (0.6 + influence * 3.2) * boost;
  if (platform === "x") {
    const likes = Math.max(1, Math.round(base * 4));
    return {
      likes,
      replies: Math.round(likes * (0.08 + rng() * 0.1)),
      shares: Math.round(likes * (0.15 + rng() * 0.2)),
      views: Math.round(likes * (22 + rng() * 30)),
    };
  }
  const likes = Math.max(1, Math.round(base * 3));
  return {
    likes,
    replies: Math.round(likes * (0.05 + rng() * 0.08)),
    shares: Math.round(likes * (0.3 + rng() * 0.4)),
    views: Math.round(likes * (35 + rng() * 40)),
  };
}

function scoreFor(rng: Rng, sentiment: Sentiment): number {
  const raw =
    sentiment === "negative" ? -(0.55 + rng() * 0.4) : sentiment === "positive" ? 0.5 + rng() * 0.45 : (rng() - 0.5) * 0.3;
  return Math.round(raw * 100) / 100;
}

const extractHashtags = (text: string): string[] => (text.match(/#[A-Za-z0-9_]+/g) ?? []).map((h) => h.slice(1));

/* ───────────────────────── Public builder ───────────────────────── */

export function buildPosts(
  base: GraphBase,
  hourly: Record<string, HourBucket[]>,
): { posts: SocialPost[]; seedIdByKey: Record<string, string> } {
  const specById = Object.fromEntries(TOPIC_SPECS.map((s) => [s.id, s]));
  const communityById = Object.fromEntries(base.communitySpecs.map((c) => [c.id, c]));
  const nodesByPlatformCommunity: Record<string, typeof base.nodes> = {};
  for (const n of base.nodes) {
    (nodesByPlatformCommunity[`${n.platform}:${n.communityId}`] ??= []).push(n);
  }

  type Draft = Omit<SocialPost, "id"> & { seedKey?: string; order: number };
  const drafts: Draft[] = [];
  let order = 0;

  const makeDraft = (
    topicId: string,
    node: (typeof base.nodes)[number],
    tsMs: number,
    sentiment: Sentiment,
    text: string,
    lang: string,
    engagement: Engagement,
    rng: Rng,
    seedKey?: string,
  ): Draft => {
    const comm = communityById[node.communityId];
    return {
      platform: node.platform,
      authorId: node.id,
      authorName: node.label,
      text,
      timestamp: new Date(tsMs).toISOString(),
      engagement,
      hashtags: extractHashtags(text),
      language: lang,
      topic: { id: topicId, name: specById[topicId].name },
      sentiment,
      sentimentScore: scoreFor(rng, sentiment),
      community: { id: comm.id, name: comm.name, color: comm.color },
      seedKey,
      order: order++,
    };
  };

  // 1) Story posts (fixed authors, times, engagement)
  const seedRng = mulberry32(7001);
  for (const s of SEEDS) {
    const node = base.nodeById[nodeIdOf(s.nodeKey)];
    drafts.push(makeDraft(s.topicId, node, Date.parse(s.at), s.sentiment, s.text, "en", s.engagement, seedRng, s.key));
  }

  // 2) Sampled posts following each topic's hourly series
  for (const spec of TOPIC_SPECS) {
    const rng = mulberry32(spec.seed * 7 + 13);
    const buckets = hourly[spec.id];
    const bucketWeights = buckets.map((b) => bucketTotal(b));
    const used = new Set<string>();
    const boost = 1;

    for (let n = 0; n < spec.sampleSize; n++) {
      const bucket = weightedPick(rng, buckets.map((_, i) => i), bucketWeights);
      const hb = buckets[bucket];
      const xTotal = bucketTotal(hb, "x");
      const tgTotal = bucketTotal(hb, "telegram");
      const platform: Platform = xTotal + tgTotal === 0 ? "x" : weightedPick(rng, ["x", "telegram"] as Platform[], [xTotal, tgTotal]);
      const c = bucketCounts(hb, platform);
      const sentiment: Sentiment =
        c.positive + c.neutral + c.negative === 0
          ? "neutral"
          : weightedPick(rng, ["positive", "neutral", "negative"] as Sentiment[], [c.positive, c.neutral, c.negative]);

      // author
      const weights = communityWeights(spec.id, platform, bucket);
      let pool: typeof base.nodes = [];
      const commIds = Object.keys(weights).filter((id) => weights[id] > 0);
      const chosenCommunity = commIds.length > 0 ? weightedPick(rng, commIds, commIds.map((id) => weights[id])) : undefined;
      if (chosenCommunity) pool = nodesByPlatformCommunity[`${platform}:${chosenCommunity}`] ?? [];
      if (pool.length === 0) pool = base.nodes.filter((nd) => nd.platform === platform);
      const author = weightedPick(rng, pool, pool.map((nd) => 0.2 + nd.influence));

      // text (retry a few times to avoid duplicates within a topic)
      let tpl = pick(rng, candidateTemplates(spec.id, platform, sentiment, bucket));
      let text = fill(rng, tpl.text);
      for (let attempt = 0; attempt < 6 && used.has(text); attempt++) {
        tpl = pick(rng, candidateTemplates(spec.id, platform, sentiment, bucket));
        text = fill(rng, tpl.text);
      }
      used.add(text);

      const tsMs = bucketStartMs(bucket) + Math.floor(rng() * 60) * MINUTE_MS + Math.floor(rng() * 60) * 1000;
      drafts.push(
        makeDraft(spec.id, author, tsMs, sentiment, text, tpl.lang, engagementFor(rng, platform, author.influence, boost), rng),
      );
    }
  }

  // 3) Sort by time, assign stable ids
  drafts.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.order - b.order);
  const seedIdByKey: Record<string, string> = {};
  const posts: SocialPost[] = drafts.map((d, idx) => {
    const { seedKey, order: _order, ...rest } = d;
    void _order;
    const id = `p_${String(idx + 1).padStart(4, "0")}`;
    if (seedKey) seedIdByKey[seedKey] = id;
    return { id, ...rest };
  });

  return { posts, seedIdByKey };
}

