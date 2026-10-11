# M1 Risk API

Mounted behind M4 auth:

```text
authenticate → resolveTenantContext → requireRole(...)
```

Base path: `/api/risk`

## Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|--------|
| GET | `/api/risk/health` | any authenticated | Router up check |
| POST | `/api/risk/assess` | `loan_officer`, `branch_manager`, `executive`, `admin` | Score (+ optional persist) |

## Assess body

```json
{
  "persist": false,
  "loanApplicationId": "optional-uuid-required-if-persist",
  "features": {
    "contract_amount": 100000,
    "balance_total": 45000,
    "arr_cap": 3000,
    "arr_int": 400,
    "bal_penalty": 500,
    "bal_charges": 200,
    "paid_pct": 60
  }
}
```

## Response

```json
{
  "ok": true,
  "risk_pct": 18.42,
  "risk_band": "low",
  "recommendation": "approve",
  "model_version": "m1-heuristic-v1",
  "explanation": { "top_factors": [] },
  "assessmentId": null,
  "scoredBy": { "userId": "...", "role": "loan_officer", "institutionId": "..." }
}
```

## Model note

v1 uses the same heuristic as the M1 notebook label (`arrears_ratio`, `paid_pct`, penalty, charges).  
XGBoost/SHAP Python serve can replace `services/risk-score.ts` later without changing this route shape.

## Bruno

1. Login: `01 Auth / 01 Login Success`  
2. `10 M1 Risk / 01 Risk Health`  
3. `10 M1 Risk / 02 Assess Risk`
