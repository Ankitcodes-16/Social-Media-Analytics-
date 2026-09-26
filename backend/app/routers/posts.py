from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Post as PostRow
from app.schemas import Paginated, Platform, Sentiment, SocialPost
from app.seed.scenario import HOUR, SCENARIO_NOW
from app.seed.signals import total_engagement
from app.services.scoring import social_post_dict

router = APIRouter(tags=["posts"])


def _row_to_dict(p: PostRow) -> dict:
    return {
        "id": p.id, "platform": p.platform, "author_id": p.author_id, "author_name": p.author_name,
        "text": p.text, "timestamp": p.timestamp, "likes": p.likes, "replies": p.replies,
        "shares": p.shares, "views": p.views, "hashtags": p.hashtags, "language": p.language,
        "topic_id": p.topic_id, "sentiment": p.sentiment, "sentiment_score": p.sentiment_score,
        "community_id": p.community_id,
    }


@router.get("/api/posts", response_model=Paginated[SocialPost])
def get_posts(
    db: Session = Depends(get_db),
    q: str | None = None,
    platform: Platform | None = Query(None),
    topicId: str | None = Query(None),
    sentiment: Sentiment | None = Query(None),
    rangeHours: int | None = Query(None),
    sort: str = Query("newest"),
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=100),
):
    rows = db.execute(select(PostRow)).scalars().all()
    items = [_row_to_dict(p) for p in rows]

    if platform:
        items = [p for p in items if p["platform"] == platform]
    if topicId:
        items = [p for p in items if p["topic_id"] == topicId]
    if sentiment:
        items = [p for p in items if p["sentiment"] == sentiment]
    if rangeHours is not None:
        cutoff = (SCENARIO_NOW - rangeHours * HOUR).isoformat().replace("+00:00", "Z")
        items = [p for p in items if p["timestamp"] >= cutoff]
    term = q.strip().lower().lstrip("#") if q else None
    if term:
        items = [
            p for p in items
            if term in f"{p['text']} {p['author_name']} {' '.join(p['hashtags'])}".lower()
        ]

    if sort == "oldest":
        items.sort(key=lambda p: p["timestamp"])
    elif sort == "engagement":
        items.sort(key=lambda p: total_engagement(p), reverse=True)
    elif sort == "views":
        items.sort(key=lambda p: p["views"] or 0, reverse=True)
    else:
        items.sort(key=lambda p: p["timestamp"], reverse=True)

    total = len(items)
    pages = max(1, -(-total // pageSize))
    page = min(pages, max(1, page))
    page_items = items[(page - 1) * pageSize: page * pageSize]

    return Paginated[SocialPost](
        items=[SocialPost(**social_post_dict(p)) for p in page_items],
        total=total, page=page, page_size=pageSize,
    )


@router.get("/api/posts/{post_id}", response_model=SocialPost)
def get_post(post_id: str, db: Session = Depends(get_db)):
    row = db.get(PostRow, post_id)
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return SocialPost(**social_post_dict(_row_to_dict(row)))
