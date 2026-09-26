from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import SentimentReport
from app.services.scoring import build_sentiment_report, load_context

router = APIRouter(tags=["sentiment"])


@router.get("/api/sentiment", response_model=SentimentReport)
def get_sentiment(db: Session = Depends(get_db)):
    ctx = load_context(db)
    return SentimentReport(**build_sentiment_report(ctx))
