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
uvicorn app:app --app-dir m1_credit_risk/serve --port 8002

# 2) backend (M1_MODEL_URL defaults to http://127.0.0.1:8002)
cd ../backend; npm run dev
```

If the model service is down, `/api/risk/assess` returns **503**. Keep the service bound to localhost; it has no auth of its own.

## Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| POST | `/api/risk/decisions` | same as assess | Save officer accept / override (see below) |
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
  "reliability": "normal",
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
- **Any branch / product value is accepted** (new tenants have their own branch names). The model service first matches spelling loosely (case, spaces) and by product code, so `"kandy "` and `"Sasiri loan (SL01)"` count as known.
- A value that still does not match is listed in `unseen_categories`. The model has no learned effect for it, so its effect is **averaged over the values in the training data, weighted by how often they occur** (in log-odds, so the SHAP factors still add up to the score). Such factors carry `"averaged": true`. With every field unknown the score comes out near the portfolio base rate (~0.35).
- `reliability` is `"reduced"` when `unseen_categories` is non-empty, and the `recommendation` is then always `review`: the system never auto-approves or rejects on averaged evidence. Send `"unknown"` for a field the application does not have rather than guessing a value.
- The averaging needs `artifacts/category_freq.json` (written by `train_xgb.py`, or `train_xgb.py --freq-only` without retraining). Without it, unseen values fall back to an all-zero one-hot, which is out of distribution, so the flag and the `review` recommendation still apply.
- With `persist=true`, `risk_score` is stored as 0-100 and `shap_explanations.contribution` holds the log-odds value.

## Decisions

`POST /api/risk/decisions` body: `{ "assessmentId": "<uuid from a persisted assess>", "decision": "accept" | "override", "reasoning": "required for override", "explanationMode": "optional" }` -> `201 { ok, decisionId, createdAt }`. The officer id comes from the JWT; the AI recommendation is read from the stored assessment. Override also bumps `reliance_profiles.override_count`. `404` if the assessment is not in the tenant DB, `400` on a bad body.

## Borrower fields (optional)

`features` also accepts: `borrower_age`, `dependants`, `monthly_income`, `living_expenses`, `other_debt_payment`, `business_age_years`, `first_time_borrower` (0/1), `occupation`, `income_pattern`, `assets`, `civil_status`. The live v2 model does **not** use them yet (the PAR data has no borrower fields); the response lists what was sent but ignored in `borrower_fields_ignored`, so the UI must not imply they moved the score. They start to count when the v3 model (trained on labelled expert-prior data) is switched on.

Errors: `400` invalid body, `503` model service down/unreachable, `500` generic (details only in server logs).

## Demo runbook

1. Start Postgres, the model service (`cd ml && uvicorn app:app --app-dir m1_credit_risk/serve --port 8002`), then the backend (`cd backend && npm run dev`).
2. Check `GET http://127.0.0.1:8002/health` returns `"ok": true`, then Bruno `01 Login Success` -> `10 M1 Risk / 02 Assess Risk`.
3. Use real PAR values in the demo: branches such as Kandy, Kegalle, Hatton, Anuradhapura; product categories `Micro Loan`, `Business Loan`, `Personal Loan`; product types Daily / Weekly / Monthly. An unknown branch/product (e.g. `Colombo Head Office`) still scores, averaged, with `reliability: "reduced"` and `recommendation: "review"`.
4. **If the model service is down:** the API returns 503. Say so, restart it (step 1), or show the saved `ml/m1_credit_risk/artifacts/sample_explanation.json` and the Bruno response from a previous run. Never show a made-up score.
5. Backend route tests: `cd backend && npm test`. Model service tests: `cd ml && python m1_credit_risk/tests/test_app.py`.

## Limits (state these in reports)

- Trained on one PAR snapshot of currently ongoing loans; shows which loan profiles are overdue now, not a forecast. Two more snapshots are planned, which will allow a true future-default test.
- `age` is arrears age (time a payment is overdue); confirmed by the team.
- Honest grouped-CV AUC ~0.81 (see `ml/m1_credit_risk/artifacts/metrics.json` after training).

## Bruno

1. Login: `01 Auth / 01 Login Success`
2. `10 M1 Risk / 01 Risk Health`
3. `10 M1 Risk / 02 Assess Risk` (needs the model service running)
