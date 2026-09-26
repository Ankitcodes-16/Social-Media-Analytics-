# Trend Sphere — Phase 2 backend

A FastAPI + PostgreSQL backend implementing every endpoint the Phase 1
frontend's service layer (`src/services/*.ts`) already expects, so the app
can be pointed at real infrastructure with **no frontend code changes** —
just environment variables.

## What this is (and isn't)

This is Phase 2: a real API, a real database, and a real implementation of
the six-signal detector described in the frontend's `signals.ts` — ported
here field-for-field (same weights, same thresholds, same explanations).
It is **not** Phase 3 (real X/Telegram ingestion) or Phase 4 (trained ML
models). The data this API serves is the same kind of coherent, hand-tuned
simulated scenario the frontend mocked — a Line 4 signalling-fault
disruption that spikes, spreads across platforms and communities, and
trips a real, explainable alert — except it's now generated once into
Postgres by `scripts/seed_db.py` and served by real queries instead of an
in-memory JS singleton. Every endpoint response is computed from what's
actually in the database, including the alert-status workflow, which now
genuinely persists.

Two topics beyond the frontend's original scenario were added
(`flood-warning-riverside`, `fare-hike-backlash`) so the Alerts page has
more than one status to look at — a currently-`new` critical alert, a
past-peak alert still `investigating`, and a fully `resolved` one.

## Quickstart

```bash
cp .env.example .env
docker compose up --build
```

That starts Postgres, waits for it to be healthy, then starts the API,
which seeds the database on first boot (`RESEED_ON_STARTUP=true` by
default — see below). The API is then live at `http://localhost:8000`,
with interactive docs at `http://localhost:8000/docs`.

Point the frontend at it — in the `trend-sphere` repo:

```bash
# trend-sphere/.env.local
NEXT_PUBLIC_API_SERVICES=all
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

(Or list specific services, e.g. `NEXT_PUBLIC_API_SERVICES=posts,topics`,
to cut over one page at a time.)

## Without Docker

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# point DATABASE_URL in .env at your own Postgres instance
python -m scripts.seed_db
uvicorn app.main:app --reload
```

## Endpoints

| Method | Path | Notes |
|---|---|---|
| GET | `/api/overview` | KPIs, 24h activity series, platform mix, source status |
| GET | `/api/topics` | All topics with current volume |
| GET | `/api/posts` | `q, platform, topicId, sentiment, rangeHours, sort, page, pageSize` |
| GET | `/api/posts/{id}` | 404 if not found |
| GET | `/api/sentiment` | Overall/by-platform/by-topic breakdown + recent shifts |
| GET | `/api/trends` | `status, platform, sort` |
| GET | `/api/trends/{id}` | Full detail: timeline, signals, communities, milestones |
| GET | `/api/alerts` | `status, severity` |
| GET | `/api/alerts/{id}` | Detail: trend summary, timeline, supporting posts |
| PATCH | `/api/alerts/{id}` | `{status, note?}` — **persists**, unlike the frontend mock |
| GET | `/api/network` | `topicId` — nodes, edges, communities, propagation paths |
| GET | `/api/health` | API liveness and database connectivity check |

## Architecture

```
app/
  config.py, database.py, models.py, schemas.py, main.py
  seed/            deterministic scenario generator (see below)
  services/scoring.py   builds TrendDetail/SentimentReport/OverviewSummary
                        from what's in Postgres, on every request
  routers/         one file per resource, thin — they query the DB and
                    hand off to services/scoring.py
scripts/seed_db.py  drops, recreates, and repopulates every table
```

**Why trends/sentiment/overview are computed per-request instead of
stored:** they're derived views over `Topic.hourly` + `Post` rows, the
same way the frontend mock derived them from its in-memory dataset. At
this dataset's size (a few thousand rows) that's fast and keeps a single
source of truth; a real Phase 4 would cache or materialise it.

**Why alerts *are* stored:** their `evidence` is a frozen snapshot of the
six signals at the moment the alert fired (an alert shouldn't retroactively
change), and their `status`/`history` are genuinely mutable — that's what
the PATCH endpoint updates.

**Why `Topic.hourly` is one JSONB column instead of a row-per-hour
table:** it's the pre-aggregated feed a real ingestion + aggregation
pipeline (Phase 3/4) would hand this service; nothing downstream needs to
change when that table gets a real producer.

## Verification

The Docker Compose stack was started locally. Both PostgreSQL and the API
reported healthy, and the health, overview, topics, posts, sentiment,
trends, alerts, and network endpoints returned successfully. Trend, alert,
post, and topic-filtered network detail routes and the frontend CORS
preflight were also checked. The dataset remains simulated; external X and
Telegram ingestion has not been implemented.

## Extending it

- More alert scenarios: add a `TopicSpec` in `app/seed/topics.py` with a
  volume/sentiment curve tuned to cross the thresholds in
  `app/seed/signals.py`, add community/engagement-boost config in
  `app/seed/posts.py`, and a definition in `ALERT_DEFS` in
  `app/seed/build.py`.
- Alembic migrations: not set up — `seed_db.py` uses
  `Base.metadata.create_all`. Worth adding once the schema needs to
  evolve without a full reseed.
- Real ingestion (Phase 3): would replace `app/seed/` as the producer of
  `Topic.hourly` and `Post` rows; `app/services/scoring.py` and every
  router are already written against the database, not the generator, so
  they wouldn't need to change.
