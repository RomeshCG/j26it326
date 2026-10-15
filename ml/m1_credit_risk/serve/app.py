"""Internal M1 model service (FastAPI). Only the Express backend should call this.

Run from ml/:
  uvicorn app:app --app-dir m1_credit_risk/serve --port 8001
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


@app.get("/health")
def health() -> dict:
    return {"ok": model_ready(), "model_version": MODEL_VERSION}


@app.post("/score")
def score_loan(terms: LoanTerms) -> dict:
    if not model_ready():
        raise HTTPException(503, "Model artifact missing; run train/train_xgb.py")
    return score(terms.model_dump())
