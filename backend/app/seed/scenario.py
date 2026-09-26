"""
Scenario clock — a fixed 48-hour window of hourly buckets ending at
SCENARIO_NOW. A fixed anchor (rather than "now") keeps every endpoint
consistent with every other endpoint and makes the seed reproducible.

Bucket i covers [bucket_start(i), bucket_start(i) + 1h). Bucket 47 is the
most recent complete hour.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

HOUR = timedelta(hours=1)
MINUTE = timedelta(minutes=1)

SCENARIO_NOW = datetime(2026, 9, 20, 14, 0, 0, tzinfo=timezone.utc)

BUCKETS = 48
WINDOW_HOURS = 24
WINDOW_START_INDEX = BUCKETS - WINDOW_HOURS  # 24
NOW_INDEX = BUCKETS - 1  # 47

DETECTION_SCORE = 0.6
ALERT_SIGNAL_THRESHOLD = 3  # of 6 signals must fire to raise an alert


def bucket_start(i: int) -> datetime:
    return SCENARIO_NOW - (BUCKETS - i) * HOUR


def bucket_end(i: int) -> datetime:
    return bucket_start(i) + HOUR


def bucket_iso(i: int) -> str:
    return iso(bucket_start(i))


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
