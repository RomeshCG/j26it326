"""Mission Drift Index (MDI): reusable, pure functions (no file or DB access).

Used by run_mdi.py (batch) and, later, by an M2 model service / the XGBoost drift-risk features.
"""
from __future__ import annotations

import tomllib
from pathlib import Path

import pandas as pd

SETTINGS_PATH = Path(__file__).resolve().parents[1] / "config" / "mdi_settings.toml"


def load_settings(path: Path = SETTINGS_PATH) -> dict:
    s = tomllib.loads(path.read_text(encoding="utf-8"))
    total = sum(i["weight"] for i in s["indicators"].values())
    assert abs(total - 1.0) < 1e-9, f"MDI weights must sum to 1, got {total}"
    return s


def compute_mdi(history: pd.DataFrame, settings: dict | None = None) -> dict:
    """history: rows ordered oldest -> newest, one column per indicator (monthly values).

    Baseline = first `baseline_months` rows; current = last `window_months` rows.
    Returns {score, state, contributingTrends:[...]} (higher score = more drift).
    """
    s = settings or load_settings()
    nb, nw = s["baseline_months"], s["window_months"]
    if len(history) < nb + nw:
        raise ValueError(f"need at least {nb + nw} months, got {len(history)}")
    base_df, cur_df = history.iloc[:nb], history.iloc[-nw:]

    score, trends = 0.0, []
    for key, ind in s["indicators"].items():
        base, cur = float(base_df[key].mean()), float(cur_df[key].mean())
        drift = ind["direction"] * (cur - base) / base if base else 0.0
        norm = max(-1.0, min(1.0, drift / s["full_scale"]))
        contribution = 100.0 * ind["weight"] * norm
        score += contribution
        trends.append({
            "indicator": key, "label": ind["label"], "weight": ind["weight"],
            "baseline": round(base, 5), "current": round(cur, 5),
            "relativeChange": round((cur - base) / base, 5) if base else 0.0,
            "contribution": round(contribution, 3),
        })
    trends.sort(key=lambda t: t["contribution"], reverse=True)
    state = "alert" if score > s["alert_threshold"] else "normal"
    return {"score": round(score, 3), "state": state, "contributingTrends": trends}
