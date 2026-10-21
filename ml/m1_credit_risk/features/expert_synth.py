"""Expert-prior synthesis of the borrower fields that the PAR extract does not contain.

For every real loan we keep the real label (`overdue`) and the real loan terms, and draw the
missing borrower profile (occupation, income, debts, family, ...) from the expert's typical-borrower
distributions. The profile is chosen so that, across the whole book, each factor's overdue rate
matches the expert's relative-risk numbers (Bayes: P(profile | overdue) ~ P(profile) * P(overdue | profile)).

Everything produced here comes from expert judgement, not measured data. It is tagged in
`data_source` and must be described that way in the report.
"""

from __future__ import annotations

import tomllib
from pathlib import Path

import numpy as np
import pandas as pd

CONFIG_DEFAULT = Path(__file__).resolve().parents[1] / "config" / "expert_priors.toml"

BORROWER_NUMERIC = [
    "borrower_age", "dependants", "monthly_income", "living_expenses", "other_debt_payment",
    "business_age_years", "first_time_borrower",
    "debt_burden", "instalment_load", "expense_ratio", "disposable_ratio",
]
BORROWER_CATEGORICAL = ["occupation", "income_pattern", "assets", "civil_status"]
BORROWER_FEATURES = BORROWER_NUMERIC + BORROWER_CATEGORICAL


def load_config(path: Path = CONFIG_DEFAULT) -> dict:
    with open(path, "rb") as f:
        cfg = tomllib.load(f)
    occ_total = sum(o["share"] for o in cfg["occupation"])
    if abs(occ_total - 1) > 0.05:
        raise ValueError(f"occupation shares sum to {occ_total:.2f}, expected ~1")
    return cfg


def _norm(p) -> np.ndarray:
    p = np.asarray(p, dtype=float)
    return p / p.sum()


def _pick_band(rng, shares, size):
    return rng.choice(len(shares), p=_norm(shares), size=size)


def _draw_profiles(df: pd.DataFrame, cfg: dict, rng, k: int) -> dict:
    """Draw k candidate borrower profiles per loan from the expert prior. Arrays are (n, k)."""
    n = len(df)
    occ = cfg["occupation"]
    o = _pick_band(rng, [x["share"] for x in occ], (n, k))
    col = lambda key: np.array([x[key] for x in occ], dtype=float)[o]  # noqa: E731

    # Income: lognormal whose 10th / 90th percentiles are the expert's low / high
    sigma = np.log(col("income_high") / col("income_low")) / (2 * 1.2816)
    income = col("income_typical") * np.exp(rng.normal(0, 1, (n, k)) * sigma)

    expenses = col("expenses") * (income / col("income_typical")) ** 0.5 * np.exp(rng.normal(0, 0.15, (n, k)))
    expenses = np.minimum(expenses, 0.9 * income)

    has_debt = rng.random((n, k)) < col("p_other_loans")
    debt = has_debt * col("other_debt_typical") * np.exp(rng.normal(0, 0.4, (n, k)))
    debt = np.minimum(debt, 0.9 * income)

    per_month = df["product_type"].map(cfg["monthly_factor"]).fillna(cfg["monthly_factor"]["Weekly"]).to_numpy()
    monthly_installment = (df["installment"].to_numpy() * per_month)[:, None]

    def banded(section, integer=False):
        s = cfg[section]
        b = _pick_band(rng, s["shares"], (n, k))
        lo = np.array([x[0] for x in s["bands"]], dtype=float)[b]
        hi = np.array([x[1] for x in s["bands"]], dtype=float)[b]
        if integer:
            return b, np.floor(lo + rng.random((n, k)) * (hi - lo + 1))
        return b, lo + rng.random((n, k)) * (hi - lo)

    age_b, age = banded("age")
    dep_b, dep = banded("dependants", integer=True)
    biz_b, biz = banded("business_age")
    self_emp = col("self_employed").astype(bool)
    biz = np.where(self_emp, biz, 0.0)
    biz_b = np.where(self_emp, biz_b, -1)  # -1 = not self-employed (no business-age effect)

    first = rng.random((n, k)) < cfg["first_time"]["share"]
    assets = _pick_band(rng, cfg["assets"]["shares"], (n, k))
    civil = _pick_band(rng, cfg["civil_status"]["shares"], (n, k))
    pattern = np.array([x["income_pattern"] for x in occ])[o]

    return {
        "occ": o, "income": income, "expenses": expenses, "debt": debt,
        "debt_burden": debt / income, "instalment_load": monthly_installment / income,
        "age": age, "age_b": age_b, "dep": dep, "dep_b": dep_b, "biz": biz, "biz_b": biz_b,
        "first": first, "assets": assets, "civil": civil, "pattern": pattern,
        "monthly_installment": np.broadcast_to(monthly_installment, (n, k)),
    }


def _relative_risk(p: dict, cfg: dict) -> np.ndarray:
    """Combined relative risk of each candidate profile (factors multiply)."""
    occ_rr = np.array([x["rr"] for x in cfg["occupation"]])[p["occ"]]
    pat_rr = np.vectorize(cfg["income_pattern"].get)(p["pattern"])

    db = cfg["debt_burden"]
    db_band = np.where(p["debt"] <= 0, 0, 1 + np.digitize(p["debt_burden"], db["edges"]))
    il = cfg["instalment_load"]
    il_band = np.digitize(p["instalment_load"], il["edges"])

    biz_rr = np.where(p["biz_b"] >= 0, np.array(cfg["business_age"]["rr"])[np.maximum(p["biz_b"], 0)], 1.0)
    ft = cfg["first_time"]
    first_rr = np.where(p["first"], ft["rr_first"], ft["rr_repeat"])

    return (
        occ_rr * pat_rr
        * np.array(db["rr"])[db_band]
        * np.array(il["rr"])[il_band]
        * np.array(cfg["age"]["rr"])[p["age_b"]]
        * np.array(cfg["dependants"]["rr"])[p["dep_b"]]
        * biz_rr * first_rr
        * np.array(cfg["assets"]["rr"])[p["assets"]]
        * np.array(cfg["civil_status"]["rr"])[p["civil"]]
    )


def synthesize(df: pd.DataFrame, cfg: dict | None = None, label: str = "overdue",
               seed: int = 42, candidates: int = 64) -> pd.DataFrame:
    """Return df plus borrower columns. `df` needs: label, installment, product_type."""
    cfg = cfg or load_config()
    rng = np.random.default_rng(seed)
    n = len(df)
    y = df[label].to_numpy().astype(int)
    base_rate = y.mean()

    prof = _draw_profiles(df, cfg, rng, candidates)
    rr = _relative_risk(prof, cfg)

    # P(overdue | profile) under a multiplicative risk model, anchored to the real base rate
    p_y1 = np.clip(base_rate * rr / rr.mean(), 0.01, 0.95)
    w = np.where(y[:, None] == 1, p_y1, 1 - p_y1)
    w = w / w.sum(axis=1, keepdims=True)
    chosen = (w.cumsum(axis=1) > rng.random((n, 1))).argmax(axis=1)
    rows = np.arange(n)
    pick = lambda a: np.asarray(a)[rows, chosen]  # noqa: E731

    income = pick(prof["income"])
    out = df.copy()
    out["occupation"] = np.array([x["name"] for x in cfg["occupation"]])[pick(prof["occ"])]
    out["income_pattern"] = pick(prof["pattern"])
    out["borrower_age"] = pick(prof["age"]).round().astype(int)
    out["dependants"] = pick(prof["dep"]).astype(int)
    out["monthly_income"] = income.round(0)
    out["living_expenses"] = pick(prof["expenses"]).round(0)
    out["other_debt_payment"] = pick(prof["debt"]).round(0)
    out["business_age_years"] = pick(prof["biz"]).round(1)
    out["first_time_borrower"] = pick(prof["first"]).astype(int)
    out["assets"] = np.array(cfg["assets"]["names"])[pick(prof["assets"])]
    out["civil_status"] = np.array(cfg["civil_status"]["names"])[pick(prof["civil"])]
    out["debt_burden"] = (out["other_debt_payment"] / income).round(4)
    out["instalment_load"] = (pick(prof["monthly_installment"]) / income).round(4)
    out["expense_ratio"] = (out["living_expenses"] / income).round(4)
    out["disposable_ratio"] = ((income - out["living_expenses"] - out["other_debt_payment"]
                                - pick(prof["monthly_installment"])) / income).round(4)
    out["data_source"] = "expert_prior_placeholder" if cfg.get("placeholder") else "expert_prior"
    return out


def _levels(df: pd.DataFrame, cfg: dict):
    """Yield (factor, level label, row mask, config location, current multiplier) for every checked level."""
    for i, o in enumerate(cfg["occupation"]):
        yield "occupation", o["name"], df["occupation"] == o["name"], ("occupation", i), o["rr"]
    for name, rr in cfg["income_pattern"].items():
        yield "income_pattern", name, df["income_pattern"] == name, ("income_pattern", name), rr

    db = cfg["debt_burden"]
    names = ["no other debt", f"<{db['edges'][0]}"] + [f"{a}-{b}" for a, b in zip(db["edges"], db["edges"][1:])] + [f">{db['edges'][-1]}"]
    band = np.where(df["other_debt_payment"] <= 0, 0, 1 + np.digitize(df["debt_burden"], db["edges"]))
    for i, name in enumerate(names):
        yield "debt_burden", name, pd.Series(band == i, index=df.index), ("debt_burden", i), db["rr"][i]

    il = cfg["instalment_load"]
    names = [f"<{il['edges'][0]}"] + [f"{a}-{b}" for a, b in zip(il["edges"], il["edges"][1:])] + [f">{il['edges'][-1]}"]
    band = np.digitize(df["instalment_load"], il["edges"])
    for i, name in enumerate(names):
        yield "instalment_load", name, pd.Series(band == i, index=df.index), ("instalment_load", i), il["rr"][i]

    for i, (lo, hi) in enumerate(cfg["age"]["bands"]):
        yield "age", f"{lo}-{hi}", (df["borrower_age"] >= lo) & (df["borrower_age"] < hi), ("age", i), cfg["age"]["rr"][i]
    for i, (lo, hi) in enumerate(cfg["dependants"]["bands"]):
        yield "dependants", f"{lo}-{hi}", (df["dependants"] >= lo) & (df["dependants"] <= hi), ("dependants", i), cfg["dependants"]["rr"][i]

    self_emp = df["occupation"].isin([o["name"] for o in cfg["occupation"] if o["self_employed"]])
    for i, (lo, hi) in enumerate(cfg["business_age"]["bands"]):
        mask = self_emp & (df["business_age_years"] >= lo) & (df["business_age_years"] < hi)
        yield "business_age", f"{lo}-{hi} yrs", mask, ("business_age", i), cfg["business_age"]["rr"][i]

    for i, name in enumerate(cfg["assets"]["names"]):
        yield "assets", name, df["assets"] == name, ("assets", i), cfg["assets"]["rr"][i]
    ft = cfg["first_time"]
    yield "first_time", "first-time", df["first_time_borrower"] == 1, ("first_time", "rr_first"), ft["rr_first"]
    yield "first_time", "repeat", df["first_time_borrower"] == 0, ("first_time", "rr_repeat"), ft["rr_repeat"]


def check_relative_risk(df: pd.DataFrame, cfg: dict, expert_cfg: dict | None = None, label: str = "overdue") -> pd.DataFrame:
    """Observed overdue rate per level / overall, next to the expert's target multiplier.

    `cfg` supplies the level definitions; `expert_cfg` (default: cfg) supplies the targets.
    """
    overall = df[label].mean()
    targets = {(f, l): rr for f, l, _, _, rr in _levels(df, expert_cfg or cfg)}
    rows = [(f, l, int(m.sum()), round(df.loc[m, label].mean() / overall, 2), targets[(f, l)])
            for f, l, m, _, _ in _levels(df, cfg) if m.sum() >= 30]
    return pd.DataFrame(rows, columns=["factor", "level", "n", "observed_rr", "expert_rr"])


def _set_rr(cfg: dict, loc: tuple, value: float) -> None:
    section, key = loc
    if section == "occupation":
        cfg["occupation"][key]["rr"] = value
    elif section == "first_time" or section == "income_pattern":
        cfg[section][key] = value
    else:
        cfg[section]["rr"][key] = value


def calibrate(df: pd.DataFrame, cfg: dict, iters: int = 10, seed: int = 42, damping: float = 0.7,
              label: str = "overdue") -> tuple[dict, pd.DataFrame]:
    """Adjust the internal multipliers until the *observed* relative risks match the expert's.

    Experts answer "compared with a typical borrower", i.e. marginal risk. Factors are correlated
    (occupation -> income pattern -> instalment load), so the multipliers that go into the
    generator have to differ from the numbers the expert gave. Returns (working config, final check).
    """
    import copy

    work = copy.deepcopy(cfg)
    for it in range(iters):
        out = synthesize(df, work, label=label, seed=seed + it)
        for f, l, m, loc, _ in _levels(out, work):
            if m.sum() < 30:
                continue
            obs = out.loc[m, label].mean() / out[label].mean()
            target = {(a, b): rr for a, b, _, _, rr in _levels(out, cfg)}[(f, l)]
            cur = {(a, b): rr for a, b, _, _, rr in _levels(out, work)}[(f, l)]
            _set_rr(work, loc, float(np.clip(cur * (target / max(obs, 0.05)) ** damping, 0.2, 8.0)))
    final = synthesize(df, work, label=label, seed=seed + iters)
    return work, final
