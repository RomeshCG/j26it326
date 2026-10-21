"""M1 model service checks. Run from ml/:  python m1_credit_risk/tests/test_app.py  (or pytest)

Validation and 503 behaviour need no model file; the score check runs only if one is trained locally.
"""

import sys
from pathlib import Path

import numpy as np
from fastapi.testclient import TestClient

SERVE = Path(__file__).resolve().parents[1] / "serve"
sys.path.insert(0, str(SERVE))

import app as app_module  # noqa: E402
import scoring  # noqa: E402

client = TestClient(app_module.app)
OK = {"contract_amount": 50000, "interest_amount": 20000, "installment": 1950, "tenure": 36,
      "branch": "Kandy", "product_category": "Micro Loan", "product_type": "Weekly", "product": "X"}


def test_rejects_bad_input():
    assert client.post("/score", json={**OK, "contract_amount": -1}).status_code == 422
    assert client.post("/score", json={k: v for k, v in OK.items() if k != "branch"}).status_code == 422


def test_borrower_fields_accepted_and_validated():
    ok = {**OK, "monthly_income": 60000, "borrower_age": 35, "occupation": "Trader"}
    if scoring.model_ready():
        assert client.post("/score", json=ok).status_code == 200
    assert client.post("/score", json={**OK, "borrower_age": 5}).status_code == 422
    assert client.post("/score", json={**OK, "monthly_income": 0}).status_code == 422


def test_503_when_model_missing(monkeypatch=None):
    orig = app_module.model_ready
    app_module.model_ready = lambda: False
    try:
        assert client.post("/score", json=OK).status_code == 503
        assert client.get("/health").json()["ok"] is False
    finally:
        app_module.model_ready = orig


def test_score_shape_if_model_present():
    if not scoring.model_ready():
        return
    r = client.post("/score", json=OK).json()
    assert 0 <= r["overdue_prob"] <= 1 and r["risk_band"] in {"low", "medium", "high"}
    assert r["top_factors"] and r["unseen_categories"] == ["product"]  # "X" was never seen
    assert r["reliability"] == "reduced"


KNOWN = {**OK, "product": "SASIRI LOAN 01 (sl01)"}


def test_known_values_score_as_before():
    if not scoring.model_ready():
        return
    pipe = scoring._load()[0]
    row = scoring.add_v2_features(scoring.pd.DataFrame([KNOWN]))[scoring.V2_FEATURES]
    r = scoring.score(KNOWN)
    assert abs(r["overdue_prob"] - pipe.predict_proba(row)[0, 1]) < 1e-4
    assert r["unseen_categories"] == [] and r["reliability"] == "normal"


def test_spelling_and_product_code_are_normalised():
    if not scoring.model_ready():
        return
    messy = {**KNOWN, "branch": "  kandy ", "product_type": "WEEKLY", "product": "Sasiri loan (SL01)"}
    assert scoring.score(messy) == scoring.score(KNOWN)


def test_unseen_branch_is_averaged_and_additive():
    if not (scoring.model_ready() and scoring.FREQ_PATH.exists()):
        return
    r = scoring.score({**KNOWN, "branch": "Colombo Head Office"}, top_n=99)
    assert r["unseen_categories"] == ["branch"] and r["reliability"] == "reduced"
    branch = next(f for f in r["top_factors"] if f["feature"] == "branch")
    assert branch["averaged"] and branch["value"] == "Colombo Head Office"
    # Expected risk lies between the safest and riskiest known branch.
    probs = [scoring.score({**KNOWN, "branch": b})["overdue_prob"]
             for b in scoring._lookup()["branch"].values()]
    assert min(probs) <= r["overdue_prob"] <= max(probs)
    # SHAP still adds up: base value + all factors = log-odds of the score.
    base = float(np.ravel(scoring._load()[3].expected_value)[0])
    total = base + sum(f["shap_logodds"] for f in r["top_factors"])
    assert abs(total - np.log(r["overdue_prob"] / (1 - r["overdue_prob"]))) < 0.01


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("all M1 service tests passed")
