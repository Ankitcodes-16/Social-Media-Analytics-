"""Trend Sphere API — FastAPI entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.routers import alerts, network, overview, posts, sentiment, topics, trends


@asynccontextmanager
async def lifespan(app: FastAPI):
    inspector = inspect(engine)
    has_tables = inspector.has_table("topics")
    if settings.reseed_on_startup or not has_tables:
        # Imported lazily: scripts/seed_db.py also works as a standalone CLI.
        from scripts.seed_db import run as seed

        seed()
    yield


app = FastAPI(
    title="Trend Sphere API",
    description=(
        "Phase 2 backend for Trend Sphere: serves the same coherent, explainable "
        "trend/sentiment/network/alert scenario the Phase 1 frontend mocked, now "
        "from PostgreSQL through a real six-signal detector. Real X/Telegram "
        "ingestion (Phase 3) and trained ML models (Phase 4) are future work — "
        "everything here is clearly a simulated dataset."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(overview.router)
app.include_router(topics.router)
app.include_router(posts.router)
app.include_router(sentiment.router)
app.include_router(trends.router)
app.include_router(alerts.router)
app.include_router(network.router)


@app.get("/api/health", tags=["health"])
def health(db: Session = Depends(get_db)):
    """Report healthy only when the API can reach its configured database."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Database unavailable") from exc
    return {"status": "ok", "database": "connected"}
