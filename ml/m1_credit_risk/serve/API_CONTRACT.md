# M1 → backend: assess-risk contract (draft for M3/M4)

Suggested endpoint (Express later):

```http
POST /api/risk/assess
Content-Type: application/json
```

## Request body

Feature object matching `features/schema.py` (`FEATURE_COLUMNS`).

```json
{
  "contract_amount": 100000,
  "interest_amount": 15000,
  "installment": 4800,
  "tenure": 24,
  "balance_capital": 40000,
  "balance_interest": 5000,
  "balance_total": 45000,
  "bal_penalty": 500,
  "bal_charges": 200,
  "arr_cap": 3000,
  "arr_int": 400,
  "paid_capital": 60000,
  "paid_interest": 10000,
  "paid_total": 70000,
  "paid_pct": 60,
  "total_paid": 70000,
  "over_payment": 0,
  "arrears_total": 3400,
  "arrears_ratio": 0.075,
  "utilization": 0.45,
  "branch": "Colombo",
  "center": "C001",
  "product_category": "Micro",
  "product_type": "Group",
  "product": "Group Enterprise",
  "gender": "female",
  "area_type": "rural",
  "income_band": "low",
  "is_group_loan": true
}
```

## Response

```json
{
  "ok": true,
  "risk_pct": 42.5,
  "risk_band": "medium",
  "explanation": {
    "top_factors": [
      { "feature": "arrears_ratio", "shap": 8.2, "direction": "increases" }
    ]
  }
}
```

Until the HTTP route exists, use:

```powershell
cd ml
.\.venv\Scripts\Activate.ps1
python m1_credit_risk/serve/demo_predict.py
python m1_credit_risk/explain/shap_local.py
```
