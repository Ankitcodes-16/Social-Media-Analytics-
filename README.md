# Trend Sphere

AI-powered multi-platform social media intelligence and analytics, with a Next.js
dashboard, FastAPI backend, and PostgreSQL database.

Trend Sphere watches X and Telegram for topics that are taking off, explains *why* each
one is trending, maps how it spreads through the network, and raises explainable alerts
when several signals agree. The API and database serve a seeded, simulated scenario.
Real X and Telegram ingestion and trained ML models are future work; see
[Implementation status](#implementation-status).

## Quick start

```bash
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_API_SERVICES=all in .env.local to use the backend.
```

Start the API and PostgreSQL in another terminal:

```bash
cd backend
cp .env.example .env
docker compose up --build
```

Then start the frontend:

```bash
npm run dev
```

Open http://localhost:3000 for the dashboard and http://localhost:8000/docs for the API.
The API health endpoint at http://localhost:8000/api/health checks its database connection.
To run the frontend against mock data instead, leave `NEXT_PUBLIC_API_SERVICES` empty.

Other scripts:

```bash
npm run typecheck    # tsc --noEmit
npm run verify:mock  # 115 consistency checks against the simulated dataset
npm run build        # production build
```

## What's here

- **Overview** — KPIs, an activity timeline with the emerging topic and alert marked,
  top trends, sentiment summary, platform distribution, trend velocity, recent alerts,
  and a build-status card.
- **Trends** — every monitored topic, filterable by status/platform, sortable by score,
  growth, volume, or recency.
- **Trend detail** — mention volume and sentiment timelines, platform comparison, related
  keywords, a milestone timeline of how the trend developed, communities involved, related
  posts, and a full **"why is this trending?"** breakdown of all six detection signals.
- **Sentiment** — overall and by-platform/by-topic distributions, a share/volume timeline
  toggle, and a table of recent sentiment swings.
- **Network** — an interactive Cytoscape graph of accounts and channels, colored by
  community, sized by influence, with a side panel for the selected node or community and
  the traced propagation paths for how each topic actually spread.
- **Alerts** — every raised alert with severity/status, and a detail page with an explicit
  **"why was this alert generated?"** section, the full rule-by-rule evidence (fired *and*
  not fired), and a working status workflow (New → Investigating → Resolved).
- **Data Explorer** — search and filter the indexed post sample by text, platform, topic,
  sentiment, and time range, with a detail panel per post.

Every page has real loading, error, and empty states (append `?mock_error=1` to any URL to
see the error state), and nothing is faked: sections that aren't built yet say so.

## The story in the data

Every number on every page comes from one coherent simulated scenario, not random
per-component values: a signalling fault on **Line 4** near Meridian Central grows from
background chatter to 120 → 250 → 530 mentions/hour over six hours, sentiment sours from
~22% to ~70%+ negative, the conversation spreads from X to Telegram and from one commuter
community out to four, and it trips an explainable alert partway through. Alongside it:
a low-confidence early signal (a small, Telegram-only power-outage report) that correctly
never becomes an alert, a topic that's rising because of the disruption (festival travel),
and several stable/declining topics for contrast. All accounts and channels are synthetic
demo identities (`@anon_*`, `*_demo`).

## Architecture

```
src/
  types/        Shared TypeScript contracts — mirrors the Pydantic schemas (camelCase JSON).
  data/mock/    The simulated dataset: deterministic generators for volume, sentiment,
                posts, the network graph, and the six detection signals, assembled once
                and memoised (data/mock/dataset.ts) plus a query layer (queries.ts) that
                does the filtering/sorting/pagination a real backend would do.
  services/     One module per domain (overview, topics, posts, sentiment, trends,
                alerts, network). Every UI component calls these, never the mock data
                directly.
  components/   UI, chart, and domain-specific (trends/alerts/network/explorer) pieces.
  app/          Next.js App Router pages.
backend/
  app/          FastAPI routes, PostgreSQL models, scoring, and seed data.
  docker-compose.yml  PostgreSQL and API services.
```

### Swapping in the real backend

Each service independently switches from simulated data to the FastAPI backend via
`NEXT_PUBLIC_API_SERVICES` in `.env.local`:

```bash
# Phase 2 integrates one service at a time, in this order:
NEXT_PUBLIC_API_SERVICES=posts,topics,sentiment,trends,alerts,network
# or, once everything is ready:
NEXT_PUBLIC_API_SERVICES=all
```

No UI code changes when a service switches — `src/types/index.ts` is the contract both
sides are written against, and each service module (e.g. `src/services/trends.ts`) already
calls the matching REST path (`GET /api/trends`, `GET /api/trends/{id}`, ...) when that
service is API-backed.

### The six detection signals

Both the trend "why is this trending?" panel and the alert "why was this generated?" panel
are powered by the same evaluation (`src/data/mock/signals.ts`): volume growth, sustained
growth, cross-platform spread, negative sentiment shift, community spread, and engagement
above baseline — each with a plain-language rule, an observed value, and a weight. An
alert fires when at least 3 of 6 signals agree. This is the executable specification
Phase 4 reimplements against real ingested data.

## Implementation status

| Area | Status | Notes |
|---|---|---|
| Dashboard UI (all 6 sections) | **Implemented** | Loading/error/empty states throughout |
| Service / data-access layer | **Implemented** | Per-service simulated ↔ API switch |
| Data & detection scoring | **Simulated** | One coherent synthetic dataset; real signal logic, synthetic input |
| Alert status workflow | **Implemented** | Persists in PostgreSQL when API-backed |
| FastAPI backend + PostgreSQL | **Implemented** | Serves the seeded simulated dataset |
| X & Telegram ingestion | Future (Phase 3) | |
| Sentiment / topic / trend ML | Future (Phase 4) | Transformers, Sentence-Transformers + scikit-learn |
| Network analytics & alert engine on real data | Future (Phase 4) | |

(The same table is rendered live on the Overview page.)

## Data mode

A badge in the top bar always states where the data is coming from: **Simulated data**,
**Live API**, or **API + simulated** (partial cutover) — see `getDataMode()` in
`src/services/config.ts`.

## Tech stack

Next.js · React · TypeScript · Tailwind CSS · Recharts · Cytoscape.js · Lucide React ·
FastAPI · SQLAlchemy · PostgreSQL.
