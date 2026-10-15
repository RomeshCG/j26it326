# M1 Risk API

Express (auth, tenancy, RBAC) -> internal FastAPI model service (`ml/m1_credit_risk/serve/app.py`).

```text
authenticate -> resolveTenantContext -> requireRole(...)  ->  POST {M1_MODEL_URL}/score
```

Base path: `/api/risk`

## Run locally

```powershell
# 1) model service (from ml/, after training: python m1_credit_risk/train/train_xgb.py)
pip install -r m1_credit_risk/requirements-serve.txt
uvicorn app:app --app-dir m1_credit_risk/serve --port 8001

# 2) backend (M1_MODEL_URL defaults to http://127.0.0.1:8001)
cd ../backend; npm run dev
```

If the model service is down, `/api/risk/assess` returns **503**. Keep the service bound to localhost; it has no auth of its own.

## Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| GET | `/api/risk/health` | any authenticated | Router up check (does not call the model service) |
| POST | `/api/risk/assess` | `loan_officer`, `branch_manager`, `executive`, `admin` | Score (+ optional persist) |

## Assess body

Origination-time loan terms only. Arrears / paid fields are NOT inputs (they define the label).

```json
{
  "persist": false,
  "loanApplicationId": "optional-uuid-required-if-persist",
  "features": {
    "contract_amount": 50000,
    "interest_amount": 20000,
    "installment": 1950,
    "tenure": 36,
    "branch": "Kandy",
    "product_category": "Micro Loan",
    "product_type": "Weekly",
    "product": "SASIRI LOAN 01 (sl01)"
  }
}
```

## Response

```json
{
  "ok": true,
  "overdue_prob": 0.7293,
  "risk_pct": 72.93,
  "risk_band": "high",
  "recommendation": "reject",
  "model_version": "m1-overdue-xgb-v2",
  "explanation": {
    "top_factors": [
      { "feature": "branch", "value": "Kandy", "shap_logodds": 1.1361, "direction": "increases_risk" }
    ],
    "unseen_categories": []
  },
  "assessmentId": null,
  "scoredBy": { "userId": "...", "role": "loan_officer", "institutionId": "..." }
}
```

- `overdue_prob` = P(arrears age > 1 period) as seen in the partner PAR snapshot. `risk_pct` is the same value x 100 (kept so existing UI code keeps working).
- Bands (provisional): `<0.33` low, `<0.66` medium, else high. `recommendation` is a hint: low=approve, medium=review, high=reject.
- `shap_logodds` is in log-odds. One factor per input field (branch, product, installment, ...) with the value that was scored; one-hot columns are summed back to their field.
- `unseen_categories` lists branch/product values the model never saw; they have no effect on the score. Treat the score as weaker when this is non-empty.
- With `persist=true`, `risk_score` is stored as 0-100 and `shap_explanations.contribution` holds the log-odds value.

## Limits (state these in reports)

- Trained on one PAR snapshot of currently ongoing loans; shows which loan profiles are overdue now, not a forecast. Two more snapshots are planned, which will allow a true future-default test.
- `age` is arrears age (time a payment is overdue); confirmed by the team.
- Honest grouped-CV AUC ~0.81 (see `ml/m1_credit_risk/artifacts/metrics.json` after training).

## Bruno

1. Login: `01 Auth / 01 Login Success`
2. `10 M1 Risk / 01 Risk Health`
3. `10 M1 Risk / 02 Assess Risk` (needs the model service running)
