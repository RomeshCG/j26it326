"""
Validation-only threshold / hybrid policy sweep. Never reads vault or test_reserved for tuning.

  python -m ml.threshold_sweep_a4_domain
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts" / "a4_domain"
DATA = ROOT / "ml" / "data" / "a4_domain"
LABELS = DATA / "a4-domain-labels.v1.jsonl"
SPLIT = DATA / "a4-domain-split-improve-v1.json"
JOBLIB = ART / "a4-domain-clf-improve-v1-lr_mindf1.joblib"
OUT = DATA / "THRESHOLD_SWEEP.md"
OUT_JSON = ART / "a4-domain-clf-threshold-sweep.json"

STAGE0_CUE = re.compile(
    r"\b(?:par30|par\s*30|par|npl|epf|etf|roi|oss|amortization|microfinance|mfi|"
    r"graduated\s*trust|microflow|agent\s*[1-4]|tier\s*[1-4]|principal|interest|"
    r"lending|loans?|borrower|banking|accounting|portfolio|delinquenc\w*|"
    r"repayment|collateral|guarantor|credit|financ(?:e|ial)|cbsl|compliance|"
    r"payroll|liquidity|solvency|working\s*capital|self-sufficienc\w*|"
    r"non[-\s]?performing|overdue|disbursement|kyc|provision|write[-\s]?off|"
    r"savings|deposit|branch\s*manager|loan\s*officer)\b"
)


def stage0(text: str) -> bool:
    return bool(STAGE0_CUE.search(text.lower()))


def main() -> int:
    try:
        import joblib
        import numpy as np
    except ImportError as e:
        print(e, file=sys.stderr)
        return 2

    split = json.loads(SPLIT.read_text(encoding="utf-8"))
    val_g = set(split["validation_group_ids"])
    # Explicitly unused for tuning
    _ = split.get("test_reserved_group_ids")

    rows = []
    for line in LABELS.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        r = json.loads(line)
        if (
            r.get("train_eligible")
            and r.get("review", {}).get("status") == "accepted"
            and r["group_id"] in val_g
        ):
            rows.append(r)

    pipe = joblib.load(JOBLIB)
    X = [r["text"] for r in rows]
    y = [r["label"] for r in rows]
    proba = pipe.predict_proba(X)
    pred = pipe.predict(X)
    classes = list(pipe.classes_)
    fi = classes.index("finance")
    oi = classes.index("off_topic")
    p_fin = proba[:, fi]
    p_off = proba[:, oi]
    s0 = [stage0(t) for t in X]

    def eval_policy(name: str, allow: list[bool]) -> dict:
        # Gold: allow knowledge only for finance (educational). mixed/off_topic should refuse.
        fa = fr = ta = tr = 0
        for i, a in enumerate(allow):
            gold_allow = y[i] == "finance"
            if a and not gold_allow:
                fa += 1
            elif (not a) and gold_allow:
                fr += 1
            elif a and gold_allow:
                ta += 1
            else:
                tr += 1
        n_fin = sum(1 for t in y if t == "finance")
        # Stage-0 false refuse that ML rescue would fix
        rescue_candidates = [
            i
            for i in range(len(rows))
            if (not s0[i]) and y[i] == "finance" and allow[i]
        ]
        s0_false_refuse = sum(1 for i in range(len(rows)) if (not s0[i]) and y[i] == "finance")
        return {
            "name": name,
            "FA": fa,
            "FR": fr,
            "TA": ta,
            "TR": tr,
            "finance_recall": round(ta / n_fin, 4) if n_fin else None,
            "s0_false_refuse_finance": s0_false_refuse,
            "rescued_finance": len(rescue_candidates),
            "n": len(rows),
        }

    # Stage-0 only
    pol_s0 = eval_policy("stage0_only", s0)

    # ML finance ∧ τ
    sweeps = []
    for tau in [0.35, 0.40, 0.45, 0.50, 0.55, 0.60]:
        allow = [bool(pred[i] == "finance" and p_fin[i] >= tau) for i in range(len(rows))]
        sweeps.append(eval_policy(f"ml_finance_tau_{tau:.2f}", allow))

    # Hybrid v1: stage0 allow unless ML confident off_topic; else rescue finance∧τ
    hybrids = []
    for tau_r in [0.40, 0.45, 0.50]:
        for tau_v in [0.45, 0.50, 0.55]:
            allow = []
            for i in range(len(rows)):
                if s0[i]:
                    veto = pred[i] == "off_topic" and p_off[i] >= tau_v
                    allow.append(not veto)
                else:
                    allow.append(bool(pred[i] == "finance" and p_fin[i] >= tau_r))
            hybrids.append(
                eval_policy(f"hybrid_rescue{tau_r:.2f}_veto{tau_v:.2f}", allow)
            )

    # Pick hybrid: maximize finance_recall - 0.5*FA/n subject to FA <= 3 if possible
    def score(p: dict) -> tuple:
        return (
            -(p["FA"]),
            p["finance_recall"] or 0,
            p["rescued_finance"],
        )

    best_hybrid = sorted(hybrids, key=score, reverse=True)[0]
    best_ml = sorted(sweeps, key=score, reverse=True)[0]

    report = {
        "n_val": len(rows),
        "stage0_only": pol_s0,
        "ml_tau_sweep": sweeps,
        "hybrid_sweep": hybrids,
        "recommended": {
            "policy": "hybrid_v1",
            "tau_rescue": 0.45,
            "tau_veto": 0.50,
            "rationale": (
                "Stage-0 allow unless ML confident off_topic (stuffing veto); "
                "Stage-0 miss rescued when pred=finance and p_fin>=tau_rescue. "
                "Val-only; test/vault unused."
            ),
            "metrics_at_recommended": next(
                h
                for h in hybrids
                if h["name"] == "hybrid_rescue0.45_veto0.50"
            ),
            "best_hybrid_by_sort": best_hybrid,
            "best_ml_only_by_sort": best_ml,
        },
        "test_vault_used_for_tuning": False,
    }
    OUT_JSON.write_text(json.dumps(report, indent=2), encoding="utf-8")

    lines = [
        "# A4 domain — validation threshold / hybrid sweep",
        "",
        "**Status:** Engineering only. Tuned on improve-v1 **validation** only. Test/vault unused.",
        "",
        f"n_val = **{len(rows)}**",
        "",
        "## Stage-0 only",
        "",
        f"- FA={pol_s0['FA']} FR={pol_s0['FR']} finance_recall={pol_s0['finance_recall']} "
        f"s0_false_refuse_finance={pol_s0['s0_false_refuse_finance']}",
        "",
        "## Recommended hybrid_v1",
        "",
        "- `tau_rescue=0.45`, `tau_veto=0.50`",
        f"- metrics: `{json.dumps(report['recommended']['metrics_at_recommended'])}`",
        "",
        "## ML-only τ sweep (reference)",
        "",
    ]
    for s in sweeps:
        lines.append(
            f"- {s['name']}: FA={s['FA']} FR={s['FR']} fin_rec={s['finance_recall']} rescued={s['rescued_finance']}"
        )
    lines.extend(["", "## Hybrid grid (excerpt)", ""])
    for h in hybrids:
        if "rescue0.45" in h["name"] or "rescue0.40" in h["name"]:
            lines.append(
                f"- {h['name']}: FA={h['FA']} FR={h['FR']} fin_rec={h['finance_recall']} rescued={h['rescued_finance']}"
            )
    lines.append("")
    OUT.write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(report["recommended"], indent=2))
    print(f"Wrote {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
