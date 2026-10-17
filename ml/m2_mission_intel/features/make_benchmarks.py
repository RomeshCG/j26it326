"""Extract Sri Lanka benchmarks from public datasets and check them against m2_priors.toml.

Inputs  (data/private/, git-ignored):
  MFIsdata_mixmarket.xlsx        MIX Market MFI financials 2005-2015 (Sri Lanka subset)
  GlobalFindexDatabase2025.csv   World Bank Global Findex (Sri Lanka, by gender / income / urbanicity)
Output: data/processed/benchmarks.csv  (long format: source, metric, group, year, value)

Run:  python features/make_benchmarks.py
"""
from __future__ import annotations

import tomllib
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
PRIV = ROOT / "data" / "private"
OUT = ROOT / "data" / "processed" / "benchmarks.csv"
CFG = tomllib.loads((ROOT / "config" / "m2_priors.toml").read_text(encoding="utf-8"))


def mix_benchmarks() -> list[dict]:
    d = pd.read_excel(PRIV / "MFIsdata_mixmarket.xlsx")
    sl = d[d["Country"].astype(str).str.contains("Sri Lanka", case=False)]
    metrics = {
        "female_borrowers_pct": "Percentoffemaleborrowers",
        "par30_pct": "Portfolioatriskmgt30days",
        "yield_pct": "nominalyield",
        "oer_pct": "Operatingexpenseloanportfoli",
    }
    rows = []
    for name, col in metrics.items():
        s = sl[col].dropna()
        rows.append({"source": "MIX Market", "metric": name, "group": f"SL median 2005-2014 (n={len(s)} MFI-years)",
                     "year": "2005-2014", "value": round(float(s.median()), 3)})
        for y, g in sl.groupby("year"):
            v = g[col].dropna()
            if len(v) >= 3:
                rows.append({"source": "MIX Market", "metric": name, "group": f"SL median (n={len(v)})",
                             "year": int(y), "value": round(float(v.median()), 3)})
    return rows


def findex_benchmarks() -> list[dict]:
    cols = ["countrynewwb", "year", "group", "group2", "account_t_d", "borrow_any_t_d"]
    g = pd.read_csv(PRIV / "GlobalFindexDatabase2025.csv", usecols=cols, low_memory=False)
    sl = g[g["countrynewwb"].astype(str).str.contains("Sri Lanka")]
    rows = []
    for _, r in sl.iterrows():
        if r["group"] not in ("all", "gender", "income", "urbanicity"):
            continue
        for metric in ("account_t_d", "borrow_any_t_d"):
            if pd.notna(r[metric]):
                rows.append({"source": "Global Findex", "metric": metric, "group": f"{r['group']}:{r['group2']}",
                             "year": int(r["year"]), "value": round(float(r[metric]), 4)})
    return rows


def main() -> None:
    b = pd.DataFrame(mix_benchmarks() + findex_benchmarks())
    b.to_csv(OUT, index=False)

    def mix(metric: str) -> float:
        return float(b[(b.metric == metric) & (b.year == "2005-2014")]["value"].iloc[0])

    sp, fp = CFG["social_priors"], CFG["finance_priors"]
    checks = [
        ("female share", sp["female_share"] * 100, mix("female_borrowers_pct")),
        ("OER", fp["oer_annual"] * 100, mix("oer_pct")),
    ]
    print("MIX Market Sri Lanka medians 2005-2014:",
          {k: mix(k) for k in ("female_borrowers_pct", "par30_pct", "yield_pct", "oer_pct")})
    for name, prior, bench in checks:
        ok = abs(prior - bench) <= 1.0
        print(f"  prior {name} = {prior:.2f} vs benchmark {bench:.2f}  {'OK' if ok else 'CHECK'}")
        assert ok, f"{name} prior is more than 1 pt away from the MIX Sri Lanka median"

    f = b[(b.source == "Global Findex") & (b.metric == "borrow_any_t_d") & (b.year == 2024)]
    print("\nFindex Sri Lanka 2024, borrowed any money:")
    print(f[["group", "value"]].to_string(index=False))
    a = b[(b.source == "Global Findex") & (b.metric == "account_t_d") & (b.year == 2024)]
    print("\nFindex Sri Lanka 2024, account ownership:")
    print(a[["group", "value"]].to_string(index=False))
    print("\nrows written:", len(b), "->", OUT)


if __name__ == "__main__":
    main()
