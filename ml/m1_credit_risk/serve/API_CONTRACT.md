# M1 → backend: assess-risk contract (draft for M3/M4)

Suggested endpoint (Express later):

```http
POST /api/risk/assess
Content-Type: application/json
```

## Request body

Origination-time loan terms only (arrears / payment columns are NOT inputs; they define the label).

```json
{
  "contract_amount": 50000,
  "interest_amount": 20000,
  "installment": 1950,
  "tenure": 36,
  "branch": "Kandy",
  "product_category": "Micro Loan",
  "product_type": "Weekly",
  "product": "SASIRI LOAN 01 (sl01)"
}
```

## Response

`overdue_prob` = P(arrears age > 1 period). `shap_logodds` is in log-odds. Bands are provisional (<0.33 low, <0.66 medium, else high).

```json
{
  "ok": true,
  "overdue_prob": 0.7293,
  "risk_band": "high",
  "explanation": {
    "top_factors": [
      { "feature": "cat__branch_Kandy", "shap_logodds": -0.1028, "direction": "decreases" }
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
