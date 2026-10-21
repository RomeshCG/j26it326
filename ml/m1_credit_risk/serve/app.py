"""Internal M1 model service (FastAPI). Only the Express backend should call this.

Run from ml/:
  uvicorn app:app --app-dir m1_credit_risk/serve --port 8002
Auth, tenancy and RBAC stay in Express; this service trusts its caller (bind to localhost).
"""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from scoring import MODEL_VERSION, model_ready, score

app = FastAPI(title="IMFS M1 model service", version=MODEL_VERSION)


class LoanTerms(BaseModel):
    contract_amount: float = Field(gt=0)
    interest_amount: float = Field(ge=0)
    installment: float = Field(gt=0)
    tenure: int = Field(gt=0)
    branch: str = Field(min_length=1)
    product_category: str = Field(min_length=1)
    product_type: str = Field(min_length=1)
    product: str = Field(min_length=1)
    # Borrower fields: accepted now, used by the v3 model; the v2 model ignores them.
    borrower_age: int | None = Field(default=None, ge=18, le=100)
    dependants: int | None = Field(default=None, ge=0, le=20)
    monthly_income: float | None = Field(default=None, gt=0)
    living_expenses: float | None = Field(default=None, ge=0)
    other_debt_payment: float | None = Field(default=None, ge=0)
    business_age_years: float | None = Field(default=None, ge=0, le=80)
    first_time_borrower: int | None = Field(default=None, ge=0, le=1)
    occupation: str | None = None
    income_pattern: str | None = None
    assets: str | None = None
    civil_status: str | None = None


@app.get("/health")
def health() -> dict:
    return {"ok": model_ready(), "model_version": MODEL_VERSION}


@app.post("/score")
def score_loan(terms: LoanTerms) -> dict:
    if not model_ready():
        raise HTTPException(503, "Model artifact missing; run train/train_xgb.py")
    return score(terms.model_dump())
