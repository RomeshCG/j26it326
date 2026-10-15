"""Shared scoring + SHAP explanation for the overdue model (used by the API and the CLI demo)."""

from __future__ import annotations

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
MODEL_VERSION = "m1-overdue-xgb-v2"
RAW_INPUTS = ["contract_amount", "interest_amount", "installment", "tenure",
              "branch", "product_category", "product_type", "product"]


@lru_cache(maxsize=1)
def _load(path: str = str(MODEL_PATH)):
    pipe = joblib.load(path)
    pre, model = pipe.named_steps["pre"], pipe.named_steps["model"]
    return pipe, pre, model, shap.TreeExplainer(model), pre.get_feature_names_out().tolist()


def model_ready() -> bool:
    return MODEL_PATH.exists()


def score(features: dict, top_n: int = 8) -> dict:
    missing = [c for c in RAW_INPUTS if features.get(c) is None]
    if missing:
        raise ValueError(f"Missing feature(s): {missing}")
    pipe, pre, _, explainer, _names = _load()
    row = add_v2_features(pd.DataFrame([{c: features[c] for c in RAW_INPUTS}]))[V2_FEATURES]
    prob = float(pipe.predict_proba(row)[0, 1])
    values = np.asarray(explainer.shap_values(pre.transform(row))).reshape(-1)

    # SHAP is additive, so one-hot columns can be summed back to their original field
    # (e.g. branch_Kandy + branch_Pussellawa + ... -> "branch").
    cats = pre.named_transformers_["cat"].categories_
    sizes = [1] * len(V2_NUMERIC) + [len(c) for c in cats]
    fields = V2_NUMERIC + V2_CATEGORICAL
    bounds = np.cumsum([0] + sizes)
    per_field = [(f, float(values[bounds[i]:bounds[i + 1]].sum())) for i, f in enumerate(fields)]
    row_vals = row.iloc[0]
    top = sorted(per_field, key=lambda t: abs(t[1]), reverse=True)[:top_n]

    # Categories the model never saw contribute nothing; tell the caller instead of hiding it.
    known = {c: set(cs) for c, cs in zip(V2_CATEGORICAL, cats)}
    unseen = [c for c in V2_CATEGORICAL if features[c] not in known[c]]

    return {
        "overdue_prob": round(prob, 4),
        "risk_band": overdue_band(prob),
        "model_version": MODEL_VERSION,
        "top_factors": [
            {
                "feature": n,
                "value": row_vals[n].item() if hasattr(row_vals[n], "item") else row_vals[n],
                "shap_logodds": round(v, 4),
                "direction": "increases_risk" if v > 0 else "reduces_risk",
            }
            for n, v in top
        ],
        "unseen_categories": unseen,
    }
