from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Alert as AlertRow
from app.models import Post as PostRow
from app.schemas import AlertDetail, AlertOut, AlertSeverity, AlertStatus, AlertStatusUpdate
from app.seed.signals import total_engagement
from app.services.scoring import build_trend_detail, load_context, social_post_dict, trend_summary_fields

router = APIRouter(tags=["alerts"])


def _alert_out_fields(a: AlertRow) -> dict:
    from app.seed.aggregate import bucket_total

    return {
        "id": a.id, "topic_id": a.topic_id, "topic_name": a.topic.name, "trend_id": a.trend_id,
        "severity": a.severity, "status": a.status, "created_at": a.created_at, "updated_at": a.updated_at,
        "confidence": a.confidence, "score": a.score, "platforms": a.platforms,
        "trigger_reason": a.trigger_reason, "why_bullets": a.why_bullets, "evidence": a.evidence,
        "mentions_per_hour_at_alert": a.mentions_per_hour_at_alert,
        "mentions_per_hour_now": bucket_total(a.topic.hourly[-1]),
        "history": a.history,
    }


@router.get("/api/alerts", response_model=list[AlertOut])
def get_alerts(
    db: Session = Depends(get_db),
    status: str | None = Query(None),
    severity: AlertSeverity | None = Query(None),
):
    rows = db.execute(select(AlertRow)).scalars().all()
    if status == "active":
        rows = [a for a in rows if a.status != "resolved"]
    elif status and status != "all":
        rows = [a for a in rows if a.status == status]
    if severity:
        rows = [a for a in rows if a.severity == severity]
    rows = sorted(rows, key=lambda a: a.created_at, reverse=True)
    return [AlertOut(**_alert_out_fields(a)) for a in rows]


@router.get("/api/alerts/{alert_id}", response_model=AlertDetail)
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    row = db.get(AlertRow, alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    ctx = load_context(db)
    detail = build_trend_detail(ctx, row.topic_id, [row])
    trend_summary = trend_summary_fields(detail)

    created_ms = _parse_ms(row.created_at)
    from_ms = created_ms - 6 * 3600 * 1000
    topic_posts = db.execute(select(PostRow).where(PostRow.topic_id == row.topic_id)).scalars().all()
    supporting = [
        p for p in topic_posts
        if from_ms <= _parse_ms(p.timestamp) <= created_ms
    ]
    supporting.sort(key=lambda p: total_engagement({"likes": p.likes, "replies": p.replies, "shares": p.shares}), reverse=True)
    supporting = supporting[:5]

    fields = _alert_out_fields(row)
    fields["trend"] = trend_summary
    fields["timeline"] = detail["timeline"]
    fields["supporting_posts"] = [
        social_post_dict(
            {
                "id": p.id, "platform": p.platform, "author_id": p.author_id, "author_name": p.author_name,
                "text": p.text, "timestamp": p.timestamp, "likes": p.likes, "replies": p.replies, "shares": p.shares,
                "views": p.views, "hashtags": p.hashtags, "language": p.language, "topic_id": p.topic_id,
                "sentiment": p.sentiment, "sentiment_score": p.sentiment_score, "community_id": p.community_id,
            }
        )
        for p in supporting
    ]
    return AlertDetail(**fields)


def _parse_ms(ts: str) -> float:
    return datetime.fromisoformat(ts.replace("Z", "+00:00")).timestamp() * 1000


@router.patch("/api/alerts/{alert_id}", response_model=AlertOut)
def update_alert_status(alert_id: str, update: AlertStatusUpdate, db: Session = Depends(get_db)):
    row = db.get(AlertRow, alert_id)
    if not row:
        raise HTTPException(status_code=404, detail="Alert not found")

    defaults = {"new": "Reopened.", "investigating": "Marked as investigating.", "resolved": "Marked as resolved."}
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    note = (update.note or "").strip() or defaults[update.status]
    event = {"ts": now_iso, "status": update.status, "note": note, "actor": "analyst"}

    row.status = update.status
    row.updated_at = now_iso
    row.history = [*row.history, event]
    db.add(row)
    db.commit()
    db.refresh(row)
    return AlertOut(**_alert_out_fields(row))
