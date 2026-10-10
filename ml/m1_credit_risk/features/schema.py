"""PAR-aligned column names and risk label helpers for M1."""

from __future__ import annotations

import numpy as np
import pandas as pd

# Canonical training columns (snake_case after clean)
NUMERIC_FEATURES = [
    "contract_amount",
    "interest_amount",
    "installment",
    "tenure",
    "balance_capital",
    "balance_interest",
    "balance_total",
    "bal_penalty",
    "bal_charges",
    "arr_cap",
    "arr_int",
    "paid_capital",
    "paid_interest",
    "paid_total",
    "paid_pct",
    "total_paid",
    "over_payment",
    "arrears_total",
    "arrears_ratio",
    "utilization",
]

CATEGORICAL_FEATURES = [
    "branch",
    "center",
    "product_category",
    "product_type",
    "product",
    "gender",
    "area_type",
    "income_band",
]

BOOL_FEATURES = ["is_group_loan"]

FEATURE_COLUMNS = NUMERIC_FEATURES + CATEGORICAL_FEATURES + BOOL_FEATURES
TARGET = "risk_pct"

# Partner export header → canonical name
PAR_RENAME = {
    "BRANCH NAME": "branch",
    "CENTER": "center",
    "PRODUCT CATEGORY": "product_category",
    "PRODUCT TYPE": "product_type",
    "PRODUCT": "product",
    "CONTRACT AMOUNT": "contract_amount",
    "INTEREST": "interest_amount",
    "INSTALLMENT": "installment",
    "TENURE": "tenure",
    "BALANCE CAPITAL": "balance_capital",
    "BALANCE INTEREST": "balance_interest",
    "BALANCE (CAPITAL + INTEREST)": "balance_total",
    "BAL. PENALTY": "bal_penalty",
    "BAL. CHARGES": "bal_charges",
    "ARR. CAP.": "arr_cap",
    "ARR. INT.": "arr_int",
    "PAID CAPITAL": "paid_capital",
    "PAID INTEREST": "paid_interest",
    "PAID (CAP. + INT.)": "paid_total",
    "PAID %": "paid_pct",
    "TOTAL PAID": "total_paid",
    "OVER PAYMENT": "over_payment",
}

PII_DROP = [
    "CUSTOMER NAME",
    "CUSTOMER NIC",
    "CONTACT NO.",
    "CUSTOMER CODE",
    "CONTRACT NUMBER",
    "OFFICER",
]


def add_derived(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["arrears_total"] = out["arr_cap"].fillna(0) + out["arr_int"].fillna(0)
    bal = out["balance_total"].fillna(0).clip(lower=1)
    amt = out["contract_amount"].fillna(0).clip(lower=1)
    out["arrears_ratio"] = out["arrears_total"] / bal
    out["utilization"] = out["balance_total"].fillna(0) / amt
    return out


def compute_risk_pct(df: pd.DataFrame) -> pd.Series:
    arr = df["arrears_ratio"].fillna(0).clip(0, 2)
    paid = (df["paid_pct"].fillna(0) / 100.0).clip(0, 1)
    amt = df["contract_amount"].fillna(0).clip(lower=1)
    pen = (df["bal_penalty"].fillna(0) / amt).clip(0, 1)
    chg = (df["bal_charges"].fillna(0) / amt).clip(0, 1)
    score = 40 * arr + 25 * (1 - paid) + 20 * pen + 15 * chg
    return score.clip(0, 100).astype(float)


def risk_band(risk_pct: float | pd.Series):
    if isinstance(risk_pct, pd.Series):
        return pd.cut(
            risk_pct,
            bins=[-0.1, 35, 65, 100],
            labels=["low", "medium", "high"],
        )
    if risk_pct < 35:
        return "low"
    if risk_pct <= 65:
        return "medium"
    return "high"


def prepare_xy(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    x = df[FEATURE_COLUMNS].copy()
    for c in CATEGORICAL_FEATURES:
        x[c] = x[c].astype("category")
    for c in BOOL_FEATURES:
        x[c] = x[c].astype(int)
    y = df[TARGET].astype(float)
    return x, y
