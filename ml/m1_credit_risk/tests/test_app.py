"""M1 model service checks. Run from ml/:  python m1_credit_risk/tests/test_app.py  (or pytest)

Validation and 503 behaviour need no model file; the score check runs only if one is trained locally.
"""

import sys
from pathlib import Path

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


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("all M1 service tests passed")
