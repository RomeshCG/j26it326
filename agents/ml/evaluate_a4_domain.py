"""
Evaluate A4 domain candidates on validation only + Stage-0 + probes.

Never loads eval vault for model selection. test_reserved frozen / unused for selection.
"""

from __future__ import annotations

import json
import os
import re
import sys
import time
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ml" / "data" / "a4_domain"
ART = ROOT / "artifacts" / "a4_domain"
LABELS = DATA / "a4-domain-labels.v1.jsonl"
VAULT = DATA / "a4-domain-eval-vault.v1.jsonl"

CLASS_ORDER = ["finance", "off_topic", "mixed"]

STAGE0_CUE = re.compile(
    r"\b(?:par30|par\s*30|par|npl|epf|etf|roi|oss|amortization|microfinance|mfi|"
    r"graduated\s*trust|microflow|agent\s*[1-4]|tier\s*[1-4]|principal|interest|"
    r"lending|loans?|borrower|banking|accounting|portfolio|delinquenc\w*|"
    r"repayment|collateral|guarantor|credit|financ(?:e|ial)|cbsl|compliance|"
    r"payroll|liquidity|solvency|working\s*capital|self-sufficienc\w*|"
    r"non[-\s]?performing|overdue|disbursement|kyc|provision|write[-\s]?off|"
    r"savings|deposit|branch\s*manager|loan\s*officer)\b"
)


def stage0_allow(text: str) -> bool:
    return bool(STAGE0_CUE.search(text.lower()))


def _load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _eligible(rows: list[dict]) -> list[dict]:
    return [
        r
        for r in rows
        if r.get("train_eligible") is True and r.get("review", {}).get("status") == "accepted"
    ]


def _metrics(y_true: list[str], y_pred: list[str]) -> dict:
    from sklearn.metrics import (
        accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_recall_fscore_support,
    )

    labels = CLASS_ORDER
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    prec, rec, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    per_class = {
        lab: {
            "precision": round(float(prec[i]), 4),
            "recall": round(float(rec[i]), 4),
            "f1": round(float(f1[i]), 4),
            "support": int(support[i]),
        }
        for i, lab in enumerate(labels)
    }
    return {
        "accuracy": round(float(accuracy_score(y_true, y_pred)), 4),
        "macro_f1": round(float(f1_score(y_true, y_pred, average="macro", zero_division=0)), 4),
        "per_class": per_class,
        "confusion_matrix": {"labels": labels, "matrix": cm.tolist()},
        "classification_report": classification_report(
            y_true, y_pred, labels=labels, zero_division=0
        ),
    }


def _binary_finance(y_true: list[str], y_pred: list[str]) -> dict:
    fa = fr = ta = tr = 0
    for t, p in zip(y_true, y_pred):
        gt_fin = t == "finance"
        pr_fin = p == "finance"
        if pr_fin and not gt_fin:
            fa += 1
        elif (not pr_fin) and gt_fin:
            fr += 1
        elif pr_fin and gt_fin:
            ta += 1
        else:
            tr += 1
    return {
        "true_accept_finance": ta,
        "true_reject_not_finance": tr,
        "false_accept": fa,
        "false_reject": fr,
        "n": len(y_true),
    }


def _stage0_report(rows: list[dict]) -> dict:
    false_allow = []
    false_refuse = []
    agree_allow_fin = agree_refuse_off = cue_mixed = 0
    for r in rows:
        hit = stage0_allow(r["text"])
        lab = r["label"]
        if hit and lab == "finance":
            agree_allow_fin += 1
        elif hit and lab == "off_topic":
            false_allow.append({"id": r["id"], "text": r["text"], "category": r["category"]})
        elif hit and lab == "mixed":
            cue_mixed += 1
        elif (not hit) and lab == "finance":
            false_refuse.append({"id": r["id"], "text": r["text"], "category": r["category"]})
        elif (not hit) and lab == "off_topic":
            agree_refuse_off += 1
    n_off = sum(1 for r in rows if r["label"] == "off_topic")
    n_fin = sum(1 for r in rows if r["label"] == "finance")
    return {
        "agree_allow_finance": agree_allow_fin,
        "agree_refuse_off_topic": agree_refuse_off,
        "cue_hit_mixed": cue_mixed,
        "false_allow_count": len(false_allow),
        "false_allow_rate_on_off_topic": round(len(false_allow) / n_off, 4) if n_off else None,
        "false_refuse_count": len(false_refuse),
        "false_refuse_rate_on_finance": round(len(false_refuse) / n_fin, 4) if n_fin else None,
        "false_allow_examples": false_allow[:8],
        "false_refuse_examples": false_refuse[:8],
    }


def main() -> int:
    try:
        import joblib
        import numpy as np
    except ImportError as e:
        print(f"Missing dependency: {e}", file=sys.stderr)
        return 2

    cand = os.environ.get("A4_DOMAIN_CANDIDATE", "improve-v1")
    variant = os.environ.get("A4_DOMAIN_VARIANT", "lr_mindf1")
    if cand == "smoke-v0":
        split_path = DATA / "a4-domain-split-smoke-v1.json"
        stem = "a4-domain-clf-smoke-v0"
    else:
        split_path = DATA / "a4-domain-split-improve-v1.json"
        stem = "a4-domain-clf-improve-v1"
    if variant != "lr_c1":
        stem = f"{stem}-{variant}"

    model_path = ART / f"{stem}.joblib"
    if not model_path.is_file():
        print(f"Missing model {model_path}", file=sys.stderr)
        return 2

    assert VAULT.name.endswith(".jsonl")
    split = json.loads(split_path.read_text(encoding="utf-8"))
    val_g = set(split["validation_group_ids"])
    # Also report metrics on SMOKE val groups only for apples-to-apples vs baseline
    smoke_split = json.loads(
        (DATA / "a4-domain-split-smoke-v1.json").read_text(encoding="utf-8")
    )
    smoke_val_g = set(smoke_split["validation_group_ids"])

    rows_all = _eligible(_load_jsonl(LABELS))
    val = [r for r in rows_all if r["group_id"] in val_g]
    smoke_val = [r for r in rows_all if r["group_id"] in smoke_val_g]

    pipe = joblib.load(model_path)

    def eval_part(part: list[dict], name: str) -> dict:
        X = [r["text"] for r in part]
        y_true = [r["label"] for r in part]
        t0 = time.perf_counter()
        y_pred = list(pipe.predict(X))
        batch_s = time.perf_counter() - t0
        probe_times = []
        sample = X[0]
        for _ in range(30):
            t1 = time.perf_counter()
            pipe.predict([sample])
            probe_times.append(time.perf_counter() - t1)
        proba = pipe.predict_proba(X)
        classes = list(pipe.classes_)
        conf = [float(np.max(p)) for p in proba]
        metrics = _metrics(y_true, y_pred)
        binary = _binary_finance(y_true, y_pred)
        errors = [
            {
                "id": r["id"],
                "text": r["text"],
                "gold": r["label"],
                "pred": pred,
                "category": r["category"],
                "confidence": round(c, 4),
                "stage0_cue": stage0_allow(r["text"]),
            }
            for r, pred, c in zip(part, y_pred, conf)
            if r["label"] != pred
        ]
        return {
            "partition": name,
            "n": len(part),
            "label_counts": dict(Counter(y_true)),
            "metrics": metrics,
            "binary_finance_vs_not": binary,
            "stage0_comparison": _stage0_report(part),
            "errors": errors,
            "latency": {
                "batch_predict_seconds": round(batch_s, 6),
                "warm_single_mean_ms_n30": round(1000 * float(np.mean(probe_times)), 3),
            },
            "mean_confidence_correct": round(
                float(np.mean([c for c, t, p in zip(conf, y_true, y_pred) if t == p] or [0])),
                4,
            ),
            "mean_confidence_incorrect": round(
                float(np.mean([c for c, t, p in zip(conf, y_true, y_pred) if t != p] or [0])),
                4,
            ),
            "classes": classes,
        }

    full = eval_part(val, "validation_improve")
    smoke_comparable = eval_part(smoke_val, "validation_smoke_groups_only")

    probes = [
        ("What is money?", "finance_basic"),
        ("What is a loan?", "finance_cue"),
        ("How do airplanes stay in the air?", "aviation"),
        ("What is the capital of France?", "geography"),
        ("What is photosynthesis?", "science"),
        ("What is PAR30 in microfinance?", "finance_cue"),
        ("finance PAR NPL — best pizza recipe?", "stuffing"),
        ("Why do people use a monthly household budget?", "finance_near"),
        ("Which river runs through London?", "geo_near"),
    ]
    classes = list(pipe.classes_)
    probe_out = []
    for text, kind in probes:
        pred = pipe.predict([text])[0]
        pr = pipe.predict_proba([text])[0]
        probe_out.append(
            {
                "text": text,
                "kind": kind,
                "pred": pred,
                "proba": {classes[i]: round(float(pr[i]), 4) for i in range(len(classes))},
                "stage0_cue": stage0_allow(text),
            }
        )

    report = {
        "spec_id": f"{stem}-val",
        "candidate": cand,
        "variant": variant,
        "disclaimer": (
            "DEVELOPMENT / engineering metrics only. Not research-grade final evidence. "
            "Vault and test_reserved unused for selection."
        ),
        "validation_full": full,
        "validation_smoke_groups_comparable": smoke_comparable,
        "probes": probe_out,
        "eval_vault_used_for_selection": False,
        "test_reserved_used_for_selection": False,
    }

    ART.mkdir(parents=True, exist_ok=True)
    out_path = ART / f"{stem}.val_metrics.json"
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    summary = {
        "stem": stem,
        "val_full": {
            "n": full["n"],
            "accuracy": full["metrics"]["accuracy"],
            "macro_f1": full["metrics"]["macro_f1"],
            "per_class": full["metrics"]["per_class"],
            "false_accept": full["binary_finance_vs_not"]["false_accept"],
            "false_reject": full["binary_finance_vs_not"]["false_reject"],
            "latency_ms": full["latency"]["warm_single_mean_ms_n30"],
            "n_errors": len(full["errors"]),
        },
        "val_smoke_groups": {
            "n": smoke_comparable["n"],
            "accuracy": smoke_comparable["metrics"]["accuracy"],
            "macro_f1": smoke_comparable["metrics"]["macro_f1"],
            "per_class": smoke_comparable["metrics"]["per_class"],
            "false_accept": smoke_comparable["binary_finance_vs_not"]["false_accept"],
            "false_reject": smoke_comparable["binary_finance_vs_not"]["false_reject"],
        },
        "probes": [{"text": p["text"], "pred": p["pred"]} for p in probe_out],
        "wrote": str(out_path.relative_to(ROOT)),
    }
    print(full["metrics"]["classification_report"])
    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
