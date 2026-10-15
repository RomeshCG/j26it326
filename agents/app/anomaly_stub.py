"""
Agent 3 (Anomaly) stub scorer.

No Isolation Forest / sklearn inference in S0c — returns a deterministic stub
score for wiring Python → Node → Graduated Trust. Replace with real IF later.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


STUB_MODEL_VERSION = "a3-iforest-stub-v0"


@dataclass(frozen=True)
class AnomalyStubResult:
    score: float
    confidence: float
    model_version: str
    is_anomaly: bool
    feature_summary: dict[str, Any]


def score_volume_spike_stub(
    features: dict[str, Any] | None = None,
) -> AnomalyStubResult:
    """
    Produce a stub anomaly score in [0, 1].

    If features contain numeric ``spike_ratio`` >= 1.5, mark as anomaly with
    elevated confidence; otherwise return a low non-anomaly stub score.
    """
    feats = dict(features or {})
    spike_ratio = feats.get("spike_ratio")
    try:
        ratio = float(spike_ratio) if spike_ratio is not None else 1.0
    except (TypeError, ValueError):
        ratio = 1.0

    if ratio >= 1.5:
        score = min(0.99, 0.55 + (ratio - 1.5) * 0.2)
        is_anomaly = True
    else:
        score = 0.12
        is_anomaly = False

    confidence = round(score * 100, 2)  # Node accepts 0–100
    return AnomalyStubResult(
        score=round(score, 4),
        confidence=confidence,
        model_version=STUB_MODEL_VERSION,
        is_anomaly=is_anomaly,
        feature_summary={
            "spike_ratio": ratio,
            "stub": True,
            **{k: v for k, v in feats.items() if k != "spike_ratio"},
        },
    )
