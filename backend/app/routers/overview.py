from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert as AlertRow
from app.schemas import OverviewSummary
from app.services.scoring import build_overview, build_trend_detail, load_context, trend_summary_fields
from app.seed.topics import TOPIC_SPECS_BY_ID

router = APIRouter(tags=["overview"])


@router.get("/api/overview", response_model=OverviewSummary)
def get_overview(db: Session = Depends(get_db)):
    ctx = load_context(db)
    alerts = db.execute(select(AlertRow)).scalars().all()
    alerts_by_topic: dict[str, list[AlertRow]] = {}
    for a in alerts:
        alerts_by_topic.setdefault(a.topic_id, []).append(a)
    trends = [trend_summary_fields(build_trend_detail(ctx, tid, alerts_by_topic.get(tid, []))) for tid in TOPIC_SPECS_BY_ID]
    data = build_overview(ctx, trends, alerts)
    return OverviewSummary(**data)
