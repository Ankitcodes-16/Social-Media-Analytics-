from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Topic as TopicRow
from app.schemas import Topic
from app.seed.aggregate import bucket_total
from app.seed.scenario import NOW_INDEX, WINDOW_START_INDEX

router = APIRouter(tags=["topics"])


@router.get("/api/topics", response_model=list[Topic])
def get_topics(db: Session = Depends(get_db)):
    rows = db.execute(select(TopicRow)).scalars().all()
    out = []
    for t in rows:
        h = t.hourly
        mentions_24h = sum(bucket_total(h[i]) for i in range(WINDOW_START_INDEX, NOW_INDEX + 1))
        out.append(
            Topic(
                id=t.id, name=t.name, category=t.category, description=t.description,
                keywords=[k["term"] for k in t.keywords], platforms=t.platforms,
                mentions_24h=mentions_24h, mentions_per_hour=bucket_total(h[NOW_INDEX]),
            )
        )
    return out
