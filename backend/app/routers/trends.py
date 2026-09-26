from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert as AlertRow
from app.schemas import Platform, TrendDetail, TrendStatus, TrendSummary
from app.seed.topics import TOPIC_SPECS_BY_ID, topic_id_of_trend
from app.services.scoring import build_trend_detail, load_context, trend_summary_fields

router = APIRouter(tags=["trends"])


def _alerts_by_topic(db: Session) -> dict:
    alerts = db.execute(select(AlertRow)).scalars().all()
    out: dict[str, list[AlertRow]] = {}
    for a in alerts:
        out.setdefault(a.topic_id, []).append(a)
    return out


@router.get("/api/trends", response_model=list[TrendSummary])
def get_trends(
    db: Session = Depends(get_db),
    status: TrendStatus | None = Query(None),
    platform: Platform | None = Query(None),
    sort: str = Query("score"),
):
    ctx = load_context(db)
    alerts_by_topic = _alerts_by_topic(db)
    items = [trend_summary_fields(build_trend_detail(ctx, tid, alerts_by_topic.get(tid, []))) for tid in TOPIC_SPECS_BY_ID]

    if status:
        items = [t for t in items if t["status"] == status]
    if platform:
        items = [t for t in items if next((p["sharePct"] for p in t["platforms"] if p["platform"] == platform), 0) >= 10]

    if sort == "growth":
        items.sort(key=lambda t: -t["growth_rate"])
    elif sort == "volume":
        items.sort(key=lambda t: -t["mentions_24h"])
    elif sort == "recent":
        items.sort(key=lambda t: (-(_ts(t["first_detected_at"])), -t["trend_score"]))
    else:
        items.sort(key=lambda t: -t["trend_score"])

    return [TrendSummary(**t) for t in items]


def _ts(iso_str: str | None) -> float:
    if not iso_str:
        return 0.0
    from datetime import datetime

    return datetime.fromisoformat(iso_str.replace("Z", "+00:00")).timestamp()


@router.get("/api/trends/{trend_id}", response_model=TrendDetail)
def get_trend(trend_id: str, db: Session = Depends(get_db)):
    topic_id = topic_id_of_trend(trend_id)
    if topic_id not in TOPIC_SPECS_BY_ID:
        raise HTTPException(status_code=404, detail="Trend not found")
    ctx = load_context(db)
    alerts_by_topic = _alerts_by_topic(db)
    detail = build_trend_detail(ctx, topic_id, alerts_by_topic.get(topic_id, []))
    return TrendDetail(**detail)
