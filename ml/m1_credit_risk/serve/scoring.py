"""Shared scoring + SHAP explanation for the overdue model (used by the API and the CLI demo)."""

from __future__ import annotations

import json
import re
import sys
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import shap

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from features.schema import V2_CATEGORICAL, V2_FEATURES, V2_NUMERIC, add_v2_features, overdue_band  # noqa: E402

MODEL_PATH = ROOT / "artifacts" / "overdue_xgb.joblib"
FREQ_PATH = ROOT / "artifacts" / "category_freq.json"  # written by train_xgb.py (--freq-only)
MODEL_VERSION = "m1-overdue-xgb-v2"
RAW_INPUTS = ["contract_amount", "interest_amount", "installment", "tenure",
              "branch", "product_category", "product_type", "product"]


@lru_cache(maxsize=1)
def _load(path: str = str(MODEL_PATH)):
    pipe = joblib.load(path)
    pre, model = pipe.named_steps["pre"], pipe.named_steps["model"]
    return pipe, pre, model, shap.TreeExplainer(model), pre.get_feature_names_out().tolist()


@lru_cache(maxsize=1)
def _freq() -> pd.DataFrame | None:
    if not FREQ_PATH.exists():
        return None
    d = json.loads(FREQ_PATH.read_text(encoding="utf-8"))
    return pd.DataFrame(d["rows"], columns=[*d["columns"], "n"])


def model_ready() -> bool:
    return MODEL_PATH.exists()


def _norm(s) -> str:
    return " ".join(str(s).split()).casefold()


def _code(s) -> str | None:
    m = re.search(r"\(([^()]+)\)\s*$", str(s))  # PAR product names end in a code, e.g. "(sl01)"
    return m.group(1).strip().casefold() if m else None


@lru_cache(maxsize=1)
def _lookup() -> dict[str, dict[str, str]]:
    """Per field: normalised spelling or product code -> the exact category the model saw."""
    cats = _load()[1].named_transformers_["cat"].categories_
    out = {}
    for field, known in zip(V2_CATEGORICAL, cats):
        m = {_norm(c): c for c in known}
        codes = [_code(c) for c in known]
        for c, code in zip(known, codes):
            if code and codes.count(code) == 1:
                m.setdefault("code:" + code, c)
        out[field] = m
    return out


def canonical(field: str, value) -> str | None:
    """Map a raw value to a training category (case/space-insensitive, or by product code); None if unseen."""
    m = _lookup()[field]
    if _norm(value) in m:
        return m[_norm(value)]
    code = _code(value)
    return m.get("code:" + code) if code else None


def score(features: dict, top_n: int = 8) -> dict:
    missing = [c for c in RAW_INPUTS if features.get(c) is None]
    if missing:
        raise ValueError(f"Missing feature(s): {missing}")
    _, pre, model, explainer, _names = _load()

    raw = {c: features[c] for c in RAW_INPUTS}
    canon = {c: canonical(c, raw[c]) for c in V2_CATEGORICAL}
    unseen = [c for c in V2_CATEGORICAL if canon[c] is None]
    base = add_v2_features(pd.DataFrame([{**raw, **{c: v for c, v in canon.items() if v}}]))[V2_FEATURES]

    # A value the model never saw has no learned effect (all-zero one-hot is itself out of
    # distribution), so average over the values it did see, weighted by training frequency.
    freq = _freq()
    if unseen and freq is not None:
        combos = freq.groupby(unseen)["n"].sum().reset_index()
        rows = pd.concat([base] * len(combos), ignore_index=True)
        rows[unseen] = combos[unseen].to_numpy()
        weights = combos["n"].to_numpy(dtype=float)
    else:
        rows, weights = base, np.ones(1)
    weights /= weights.sum()

    # Average in log-odds space so the SHAP factors still add up exactly to the score.
    x = pre.transform(rows)
    margin = float(weights @ model.predict(x, output_margin=True))
    prob = float(1 / (1 + np.exp(-margin)))
    values = weights @ np.asarray(explainer.shap_values(x)).reshape(len(rows), -1)

    # SHAP is additive, so one-hot columns can be summed back to their original field
    # (e.g. branch_Kandy + branch_Pussellawa + ... -> "branch").
    cats = pre.named_transformers_["cat"].categories_
    sizes = [1] * len(V2_NUMERIC) + [len(c) for c in cats]
    fields = V2_NUMERIC + V2_CATEGORICAL
    bounds = np.cumsum([0] + sizes)
    per_field = [(f, float(values[bounds[i]:bounds[i + 1]].sum())) for i, f in enumerate(fields)]
    row_vals = base.iloc[0]
    top = sorted(per_field, key=lambda t: abs(t[1]), reverse=True)[:top_n]

    def shown(n):
        v = raw[n] if n in unseen else row_vals[n]
        return v.item() if hasattr(v, "item") else v

    return {
        "overdue_prob": round(prob, 4),
        "risk_band": overdue_band(prob),
        "model_version": MODEL_VERSION,
        "top_factors": [
            {
                "feature": n,
                "value": shown(n),
                "shap_logodds": round(v, 4),
                "direction": "increases_risk" if v > 0 else "reduces_risk",
                **({"averaged": True} if n in unseen and freq is not None else {}),
            }
            for n, v in top
        ],
        "unseen_categories": unseen,
        # "reduced": at least one field was unseen, so the score leans on averages, not this loan.
        "reliability": "reduced" if unseen else "normal",
    }
