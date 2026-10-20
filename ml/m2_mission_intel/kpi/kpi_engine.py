"""M2 KPI Engine: Reusable financial and social performance indicators.

Provides pure functions to calculate:
- Financial KPIs (PAR30 by balance/count, portfolio outstanding, average loan size, yields)
- Social Performance Indicators (female share, rural share, poverty proxy, low-income, new-to-banking)
- Accounting Ratios (OSS, OER, cost per borrower)

Follows CGAP/MIX Market microfinance reporting standards and agreed project priors.
"""
from __future__ import annotations

import tomllib
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

CONFIG_PATH = Path(__file__).resolve().parents[1] / "config" / "m2_priors.toml"


def load_priors(path: Path = CONFIG_PATH) -> dict[str, Any]:
    """Loads M2 financial, social, and PAR priors from TOML."""
    if not path.exists():
        raise FileNotFoundError(f"M2 priors config not found at: {path}")
    return tomllib.loads(path.read_text(encoding="utf-8"))


def calculate_portfolio_kpis(df: pd.DataFrame, priors: dict[str, Any] | None = None) -> dict[str, Any]:
    """Computes loan book and delinquency KPIs from borrower/loan-level records.

    Requires columns:
      - `balance_capital` (or `balance_total`)
      - `contract_amount`
      - `age` (arrears in installments)
    Optional columns:
      - `tenure`
      - `interest_amount`
      - `product_type`
    """
    cfg = priors or load_priors()
    par_cutoff = cfg.get("par", {}).get("par30_min_installments_late", 4.3)

    total_loans = len(df)
    if total_loans == 0:
        return {
            "total_loans": 0,
            "portfolio_outstanding": 0.0,
            "avg_loan_size": 0.0,
            "par30_balance_ratio": 0.0,
            "par30_count_ratio": 0.0,
            "par30_balance_lkr": 0.0,
            "par30_count": 0,
            "contract_yield_median": 0.0,
        }

    bal_col = "balance_capital" if "balance_capital" in df.columns else "balance_total"
    portfolio_out = float(df[bal_col].sum())
    contract_amt = df["contract_amount"] if "contract_amount" in df.columns else df[bal_col]
    avg_size = float(contract_amt.mean())
    median_size = float(contract_amt.median())

    # PAR calculation using arrears age
    is_par30 = df["age"] > par_cutoff
    par30_count = int(is_par30.sum())
    par30_bal = float(df.loc[is_par30, bal_col].sum())
    par30_bal_ratio = (par30_bal / portfolio_out) if portfolio_out > 0 else 0.0
    par30_cnt_ratio = par30_count / total_loans

    # Contract-implied yield calculation if tenure and interest exist
    yield_median = 0.0
    if "interest_amount" in df.columns and "tenure" in df.columns:
        prod_type = df["product_type"].astype(str).str.lower() if "product_type" in df.columns else pd.Series("weekly", index=df.index)
        tenure_weeks = df["tenure"].where(prod_type.eq("weekly"), df["tenure"] * 4.33)
        tenure_years = (tenure_weeks / 52.0).replace(0, np.nan)
        yield_series = df["interest_amount"] / (df["contract_amount"] * tenure_years)
        yield_median = float(yield_series.dropna().median()) if not yield_series.dropna().empty else 0.0

    return {
        "total_loans": total_loans,
        "portfolio_outstanding": round(portfolio_out, 2),
        "avg_loan_size": round(avg_size, 2),
        "median_loan_size": round(median_size, 2),
        "par30_balance_lkr": round(par30_bal, 2),
        "par30_count": par30_count,
        "par30_balance_ratio": round(par30_bal_ratio, 4),
        "par30_count_ratio": round(par30_cnt_ratio, 4),
        "contract_yield_median": round(yield_median, 4),
    }


def calculate_social_indicators(df: pd.DataFrame, priors: dict[str, Any] | None = None) -> dict[str, Any]:
    """Computes social mission outreach indicators from borrower records.

    Expected columns (synthetic or survey):
      - `gender`
      - `area_type` ('rural', 'urban', 'estate')
      - `below_poverty_line` (binary 0/1) or `monthly_income` + `dependants`
      - `low_income` (binary 0/1)
      - `new_to_banking` or `first_time_borrower` (binary 0/1)
    """
    cfg = priors or load_priors()
    sp = cfg.get("social_priors", {})
    n = len(df)
    if n == 0:
        return {
            "female_borrower_ratio": 0.0,
            "rural_borrower_ratio": 0.0,
            "poverty_proxy_score": 0.0,
            "low_income_client_ratio": 0.0,
            "new_to_banking_ratio": 0.0,
            "monthly_dropout_rate": float(sp.get("monthly_dropout_rate", 0.03)),
        }

    # Gender share
    if "gender" in df.columns:
        female_share = float((df["gender"].astype(str).str.lower() == "female").mean())
    else:
        female_share = float(sp.get("female_share", 0.78))

    # Area type (rural)
    if "area_type" in df.columns:
        rural_share = float((df["area_type"].astype(str).str.lower() == "rural").mean())
    else:
        rural_share = float(sp.get("rural_share", 0.774))

    # Poverty line proxy
    if "below_poverty_line" in df.columns:
        poverty_share = float(df["below_poverty_line"].mean())
    elif "monthly_income" in df.columns and "dependants" in df.columns:
        poverty_line = sp.get("poverty_line_lkr", 17000)
        income_per_capita = df["monthly_income"] / (df["dependants"] + 1)
        poverty_share = float((income_per_capita < poverty_line).mean())
    else:
        poverty_share = 0.483

    # Low income share (below 1.5x poverty line)
    if "low_income" in df.columns:
        low_income_share = float(df["low_income"].mean())
    elif "monthly_income" in df.columns and "dependants" in df.columns:
        poverty_line = sp.get("poverty_line_lkr", 17000)
        multiple = sp.get("low_income_multiple", 1.5)
        income_per_capita = df["monthly_income"] / (df["dependants"] + 1)
        low_income_share = float((income_per_capita < poverty_line * multiple).mean())
    else:
        low_income_share = 0.654

    # New to banking
    if "new_to_banking" in df.columns:
        ntb_share = float(df["new_to_banking"].mean())
    elif "first_time_borrower" in df.columns:
        ntb_share = float(df["first_time_borrower"].mean())
    else:
        ntb_share = 0.20

    dropout = float(sp.get("monthly_dropout_rate", 0.03))

    return {
        "female_borrower_ratio": round(female_share, 4),
        "rural_borrower_ratio": round(rural_share, 4),
        "poverty_proxy_score": round(poverty_share, 4),
        "low_income_client_ratio": round(low_income_share, 4),
        "new_to_banking_ratio": round(ntb_share, 4),
        "monthly_dropout_rate": round(dropout, 4),
    }


def calculate_financial_performance_ratios(
    interest_income: float,
    operating_expenses: float,
    financial_expenses: float,
    loan_loss_provisions: float,
    average_gross_portfolio: float,
    annualization_factor: float = 12.0,
) -> dict[str, Any]:
    """Calculates standardized microfinance financial performance ratios:
    - OSS (Operational Self-Sufficiency): Operating Revenue / (Financial Exp + Loan Loss Exp + Operating Exp)
    - OER (Operating Expense Ratio): Annualized Opex / Average Gross Portfolio
    - Portfolio Yield: Annualized Interest Income / Average Gross Portfolio
    """
    total_costs = operating_expenses + financial_expenses + loan_loss_provisions
    oss = (interest_income / total_costs) if total_costs > 0 else None

    oer = None
    yield_ratio = None
    if average_gross_portfolio > 0:
        oer = (operating_expenses * annualization_factor) / average_gross_portfolio
        yield_ratio = (interest_income * annualization_factor) / average_gross_portfolio

    return {
        "oss": round(oss, 4) if oss is not None else None,
        "oer": round(oer, 4) if oer is not None else None,
        "portfolio_yield": round(yield_ratio, 4) if yield_ratio is not None else None,
        "total_operating_revenue": round(interest_income, 2),
        "total_operating_costs": round(total_costs, 2),
    }
