"""M2 synthetic data generator.

Reads M1's train_v3_expert.csv (real PAR loans + labelled expert-prior borrower fields) and
config/m2_priors.toml, then writes to data/processed/:

  borrowers_m2.csv       one row per real loan + gender, area_type, poverty flags
  kpi_monthly.csv        12 months: portfolio, par30, avg loan size, contract yield
  social_monthly.csv     12 months: female, rural, low_income, new_to_banking, dropout, poverty
  journals_monthly.csv   12 months of balanced monthly journal entries

July 2026 = real PAR values. Aug 2025 .. Jun 2026 = synthetic, walked backwards from July.
May..Jul 2026 drift on purpose ("synthetic demo scenario", NOT a finding).

Run:  python features/make_m2_synthetic.py
"""
from __future__ import annotations

import tomllib
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
CFG = tomllib.loads((ROOT / "config" / "m2_priors.toml").read_text(encoding="utf-8"))
SRC = ROOT / "data" / "processed" / "train_v3_expert.csv"
OUT = ROOT / "data" / "processed"

# Chart of accounts used by journals (backend seeds the same codes)
ACC = {
    "cash": "1000",
    "loan_portfolio": "1100",
    "loan_loss_allowance": "1190",
    "borrowings": "2000",
    "equity": "3000",
    "interest_income": "4000",
    "salary_expense": "5000",
    "operating_expense": "5100",
    "interest_expense": "5200",
    "provision_expense": "5300",
}


def months_list() -> list[pd.Period]:
    end = pd.Period(CFG["anchor_month"], freq="M")
    return [end - i for i in range(CFG["history_months"] - 1, -1, -1)]


def cents(x: float) -> int:
    return int(round(x * 100))


def build_borrowers(df: pd.DataFrame, rng: np.random.Generator) -> pd.DataFrame:
    sp, h = CFG["social_priors"], CFG["history"]
    n = len(df)
    # July snapshot already carries the demo-scenario drift, so July is consistent with the alert.
    p_female = sp["female_share"] + h["drift_female_delta"]
    p_rural = sp["rural_share"] + h["drift_rural_delta"]
    p_urban = sp["urban_share"] - h["drift_rural_delta"] * 0.9
    p_estate = 1 - p_rural - p_urban
    out = df.copy()
    out["gender"] = np.where(rng.random(n) < p_female, "female", "male")
    out["area_type"] = rng.choice(["rural", "urban", "estate"], size=n, p=[p_rural, p_urban, p_estate])
    out["income_per_person"] = out["monthly_income"] / (out["dependants"] + 1)
    line = sp["poverty_line_lkr"]
    out["below_poverty_line"] = (out["income_per_person"] < line).astype(int)
    out["low_income"] = (out["income_per_person"] < line * sp["low_income_multiple"]).astype(int)
    out["new_to_banking"] = out["first_time_borrower"].astype(int)  # proxy
    out["par30_flag"] = (out["age"] > CFG["par"]["par30_min_installments_late"]).astype(int)
    out["data_source"] = "par+synthetic"
    keep = ["branch", "center", "product_type", "contract_amount", "balance_capital", "age", "par30_flag",
            "gender", "area_type", "monthly_income", "dependants", "income_per_person",
            "below_poverty_line", "low_income", "new_to_banking", "first_time_borrower", "data_source"]
    return out[keep]


def july_values(df: pd.DataFrame, b: pd.DataFrame) -> dict:
    portfolio = float(df["balance_capital"].sum())
    par30_bal = float(df.loc[df["age"] > CFG["par"]["par30_min_installments_late"], "balance_capital"].sum())
    tenure_years = df["tenure"].where(df["product_type"].str.lower().eq("weekly"), df["tenure"]) / 52.0
    # contract-implied flat yield per year (interest / contract / years); informational only
    yld = float((df["interest_amount"] / df["contract_amount"] / tenure_years.replace(0, np.nan)).median())
    return {
        "portfolio": portfolio,
        "par30": par30_bal / portfolio,
        "avg_loan_size": float(df["contract_amount"].mean()),
        "yield_contract": yld,
        "female": float((b["gender"] == "female").mean()),
        "rural": float((b["area_type"] == "rural").mean()),
        "low_income": float(b["low_income"].mean()),
        "new_to_banking": float(b["new_to_banking"].mean()),
        "poverty": float(b["below_poverty_line"].mean()),
        "dropout": CFG["social_priors"]["monthly_dropout_rate"],
        "n_loans": len(df),
        "par30_count_share": float((df["age"] > CFG["par"]["par30_min_installments_late"]).mean()),
    }


def build_history(j: dict, rng: np.random.Generator):
    h = CFG["history"]
    ms = months_list()
    drift_start = pd.Period(h["drift_start"], freq="M")
    last = len(ms) - 1
    noise = h["noise_pct"]
    # stable levels = July value with the drift removed
    stable = {
        "female": j["female"] - h["drift_female_delta"],
        "rural": j["rural"] - h["drift_rural_delta"],
        "poverty": j["poverty"] / (1 + h["drift_poverty_delta"]),
        "avg_loan_size": j["avg_loan_size"] / (1 + h["drift_avg_loan_delta"]),
        "low_income": j["low_income"],
        "new_to_banking": j["new_to_banking"],
        "dropout": j["dropout"],
        "par30": j["par30"],
        "yield_contract": j["yield_contract"],
    }
    n_drift = (ms[-1] - drift_start).n + 1  # May, Jun, Jul = 3
    kpi, soc = [], []
    for i, m in enumerate(ms):
        is_july = i == last
        frac = 0.0 if m < drift_start else ((m - drift_start).n + 1) / n_drift

        def val(key: str, drift_key: str | None = None) -> float:
            if is_july:
                return j[key]
            v = stable[key]
            if drift_key and frac > 0:
                v = v + (j[key] - v) * frac
            return v * (1 + rng.normal(0, noise))

        months_back = last - i
        portfolio = j["portfolio"] if is_july else j["portfolio"] / (1.02 ** months_back) * (1 + rng.normal(0, noise))
        src_kpi = "par" if is_july else "synthetic"
        src_soc = "par+synthetic" if is_july else "synthetic"
        kpi.append({
            "month": str(m), "portfolio": round(portfolio, 2),
            "par30": round(max(val("par30"), 0), 5),
            "avg_loan_size": round(val("avg_loan_size", "x"), 2),
            "yield_contract": round(val("yield_contract"), 4),
            "data_source": src_kpi,
        })
        soc.append({
            "month": str(m),
            "female": round(val("female", "x"), 4), "rural": round(val("rural", "x"), 4),
            "low_income": round(val("low_income"), 4), "new_to_banking": round(val("new_to_banking"), 4),
            "dropout": round(val("dropout"), 4), "poverty": round(val("poverty", "x"), 4),
            "data_source": src_soc,
        })
    return pd.DataFrame(kpi), pd.DataFrame(soc)


def build_journals(kpi: pd.DataFrame) -> pd.DataFrame:
    f = CFG["finance_priors"]
    rows: list[dict] = []
    # opening balance: portfolio funded by borrowings + equity, plus a cash buffer
    p_prev = kpi.loc[0, "portfolio"] / 1.02
    first_month = kpi.loc[0, "month"]

    def entry(month, ref, etype, lines, desc):
        d = sum(l[1] for l in lines)
        c = sum(l[2] for l in lines)
        assert d == c, f"unbalanced {ref}: debit {d} != credit {c}"
        for acc, dr, cr in lines:
            rows.append({"month": month, "entry_ref": ref, "entry_type": etype, "account_code": acc,
                         "debit": dr / 100, "credit": cr / 100, "description": desc, "data_source": "synthetic"})

    cash0 = cents(p_prev * 0.40)
    port0 = cents(p_prev)
    borrow0 = cents(p_prev * f["borrowings_share"])
    equity0 = cash0 + port0 - borrow0
    entry(first_month, f"{first_month}-OPEN", "opening",
          [(ACC["cash"], cash0, 0), (ACC["loan_portfolio"], port0, 0),
           (ACC["borrowings"], 0, borrow0), (ACC["equity"], 0, equity0)], "Opening balances (synthetic)")

    for _, r in kpi.iterrows():
        m = r["month"]
        p_end = r["portfolio"]
        avg = (p_prev + p_end) / 2
        principal = cents(p_prev * f["principal_repay_rate"])
        disb = max(cents(p_end - p_prev) + principal, 0)
        interest = cents(avg * f["interest_yield_annual"] / 12)
        opex = avg * f["oer_annual"] / 12
        salary, other = cents(opex * f["salary_share_of_opex"]), cents(opex * (1 - f["salary_share_of_opex"]))
        funding = cents(avg * f["borrowings_share"] * f["funding_rate_annual"] / 12)
        provision = cents(p_end * r["par30"] * f["provision_rate_of_par30"])

        entry(m, f"{m}-DISB", "disbursement", [(ACC["loan_portfolio"], disb, 0), (ACC["cash"], 0, disb)],
              "Monthly loan disbursements")
        entry(m, f"{m}-REPAY", "repayment",
              [(ACC["cash"], principal + interest, 0), (ACC["loan_portfolio"], 0, principal),
               (ACC["interest_income"], 0, interest)], "Monthly repayments (principal + interest)")
        entry(m, f"{m}-SAL", "salaries", [(ACC["salary_expense"], salary, 0), (ACC["cash"], 0, salary)], "Salaries")
        entry(m, f"{m}-OPEX", "opex", [(ACC["operating_expense"], other, 0), (ACC["cash"], 0, other)], "Other opex")
        entry(m, f"{m}-FUND", "funding_cost", [(ACC["interest_expense"], funding, 0), (ACC["cash"], 0, funding)],
              "Interest on borrowings")
        entry(m, f"{m}-PROV", "provision",
              [(ACC["provision_expense"], provision, 0), (ACC["loan_loss_allowance"], 0, provision)],
              "Loan-loss provision")
        p_prev = p_end
    return pd.DataFrame(rows)


def main() -> None:
    rng = np.random.default_rng(CFG["seed"])
    df = pd.read_csv(SRC)
    borrowers = build_borrowers(df, rng)
    j = july_values(df, borrowers)
    kpi, soc = build_history(j, rng)
    jr = build_journals(kpi)

    OUT.mkdir(parents=True, exist_ok=True)
    borrowers.to_csv(OUT / "borrowers_m2.csv", index=False)
    kpi.to_csv(OUT / "kpi_monthly.csv", index=False)
    soc.to_csv(OUT / "social_monthly.csv", index=False)
    jr.to_csv(OUT / "journals_monthly.csv", index=False)

    # ledger sanity: global balance + OSS/OER preview
    assert abs(jr["debit"].sum() - jr["credit"].sum()) < 0.01
    inc = jr.loc[jr.account_code == ACC["interest_income"], "credit"].sum()
    exp = jr.loc[jr.account_code.isin([ACC[k] for k in
              ("salary_expense", "operating_expense", "interest_expense", "provision_expense")]), "debit"].sum()
    opx = jr.loc[jr.account_code.isin([ACC["salary_expense"], ACC["operating_expense"]]), "debit"].sum()
    cash = jr[jr.account_code == ACC["cash"]]
    cash_bal = (cash["debit"] - cash["credit"]).cumsum().min()
    print(f"loans={j['n_loans']}  portfolio=LKR {j['portfolio']:,.0f}  PAR30={j['par30']:.2%} "
          f"(by count {j['par30_count_share']:.2%})  contract yield median={j['yield_contract']:.1%}")
    print(f"July social: female={j['female']:.1%} rural={j['rural']:.1%} poverty={j['poverty']:.1%} "
          f"low_income={j['low_income']:.1%} new_to_banking={j['new_to_banking']:.1%}")
    print(f"12m OSS={inc / exp:.2f}  OER(annualised)={opx / kpi['portfolio'].mean():.1%}  min cash balance={cash_bal:,.0f}")
    print("journal entries:", jr["entry_ref"].nunique(), " lines:", len(jr), " (all balanced)")
    print(soc.to_string(index=False))


if __name__ == "__main__":
    main()
