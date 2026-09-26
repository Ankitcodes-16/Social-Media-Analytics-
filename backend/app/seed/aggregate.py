"""Small helpers for summing/summarising the hourly bucket sentiment counts."""
from __future__ import annotations


def empty_counts() -> dict:
    return {"positive": 0, "neutral": 0, "negative": 0}


def add_counts(a: dict, b: dict) -> dict:
    return {k: a[k] + b[k] for k in ("positive", "neutral", "negative")}


def counts_total(c: dict) -> int:
    return c["positive"] + c["neutral"] + c["negative"]


def bucket_counts(bucket: dict, platform: str | None = None) -> dict:
    if platform == "x":
        return bucket["x"]
    if platform == "telegram":
        return bucket["telegram"]
    return add_counts(bucket["x"], bucket["telegram"])


def bucket_total(bucket: dict, platform: str | None = None) -> int:
    return counts_total(bucket_counts(bucket, platform))


def sum_range(buckets: list[dict], frm: int, to: int, platform: str | None = None) -> dict:
    acc = empty_counts()
    for i in range(max(0, frm), min(len(buckets) - 1, to) + 1):
        acc = add_counts(acc, bucket_counts(buckets[i], platform))
    return acc


def summarize(counts: dict) -> dict:
    total = counts_total(counts)
    if total == 0:
        return {"counts": counts, "total": 0, "positivePct": 0.0, "neutralPct": 0.0, "negativePct": 0.0, "netScore": 0.0}
    positive_pct = round(counts["positive"] / total * 100, 1)
    negative_pct = round(counts["negative"] / total * 100, 1)
    neutral_pct = round(100 - positive_pct - negative_pct, 1)
    return {
        "counts": counts,
        "total": total,
        "positivePct": positive_pct,
        "neutralPct": neutral_pct,
        "negativePct": negative_pct,
        "netScore": round(positive_pct - negative_pct, 1),
    }


def median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2


def mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))
