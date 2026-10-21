"""
A4 domain classifier — TF-IDF (word+char) + Logistic Regression.

Candidates:
  smoke-v0   — historical baseline (split-smoke-v1)
  improve-v1 — post–wave-2 expansion (split-improve-v1)

  cd agents
  $env:ALLOW_A4_DOMAIN_TRAIN='1'
  $env:A4_DOMAIN_CANDIDATE='improve-v1'   # default
  python -m ml.train_a4_domain

Challenge ablations (val-only selection, never test/vault):
  $env:A4_DOMAIN_VARIANT='lr_mindf1' | 'lr_c1' | 'linearsvc'
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "ml" / "data" / "a4_domain"
ART = ROOT / "artifacts" / "a4_domain"
LABELS = DATA / "a4-domain-labels.v1.jsonl"
VAULT = DATA / "a4-domain-eval-vault.v1.jsonl"

CLASS_ORDER = ["finance", "off_topic", "mixed"]
RANDOM_SEED = 42

CANDIDATES = {
    "smoke-v0": {
        "split": DATA / "a4-domain-split-smoke-v1.json",
        "stem": "a4-domain-clf-smoke-v0",
    },
    "improve-v1": {
        "split": DATA / "a4-domain-split-improve-v1.json",
        "stem": "a4-domain-clf-improve-v1",
    },
}


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


def _build_pipeline(variant: str):
    from sklearn.calibration import CalibratedClassifierCV
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.linear_model import LogisticRegression
    from sklearn.pipeline import FeatureUnion, Pipeline
    from sklearn.svm import LinearSVC

    # Challenge Agent1: min_df=2 on small corpora drops rare distinctive
    # off-topic tokens (city names, science nouns) that separate classes.
    mindf = 1 if variant == "lr_mindf1" else 2
    word = TfidfVectorizer(
        analyzer="word",
        ngram_range=(1, 2),
        min_df=mindf,
        max_df=0.95,
        sublinear_tf=True,
        lowercase=True,
        strip_accents="unicode",
    )
    char = TfidfVectorizer(
        analyzer="char_wb",
        ngram_range=(3, 5),
        min_df=mindf,
        max_df=0.95,
        sublinear_tf=True,
        lowercase=True,
    )
    features = FeatureUnion([("word", word), ("char", char)])

    if variant == "linearsvc":
        # Lightweight alternative: margin classifier + probability calibration.
        base = LinearSVC(class_weight="balanced", C=1.0, random_state=RANDOM_SEED, max_iter=5000)
        clf = CalibratedClassifierCV(base, method="sigmoid", cv=3)
    else:
        # lr_c1 (smoke default) and lr_mindf1
        clf = LogisticRegression(
            solver="lbfgs",
            class_weight="balanced",
            max_iter=2000,
            C=1.0,
            random_state=RANDOM_SEED,
        )

    return Pipeline([("features", features), ("clf", clf)]), {
        "variant": variant,
        "min_df": mindf,
        "C": 1.0,
        "classifier": "LinearSVC+Calibrated" if variant == "linearsvc" else "LogisticRegression",
    }


def main() -> int:
    try:
        import joblib
        import numpy as np
    except ImportError as e:
        print(f"Missing dependency: {e}", file=sys.stderr)
        return 2

    if os.environ.get("ALLOW_A4_DOMAIN_TRAIN") != "1":
        print(
            "Refusing fit: set ALLOW_A4_DOMAIN_TRAIN=1 for explicit train waiver.",
            file=sys.stderr,
        )
        return 1

    cand_name = os.environ.get("A4_DOMAIN_CANDIDATE", "improve-v1")
    variant = os.environ.get("A4_DOMAIN_VARIANT", "lr_mindf1")
    if cand_name not in CANDIDATES:
        print(f"Unknown candidate {cand_name}", file=sys.stderr)
        return 2

    cfg = CANDIDATES[cand_name]
    split_path = cfg["split"]
    stem = cfg["stem"]
    if variant != "lr_c1":
        stem = f"{stem}-{variant}"

    if not LABELS.is_file() or not split_path.is_file():
        print(f"Missing labels or split {split_path}", file=sys.stderr)
        return 2

    _ = VAULT  # never used for fitting

    split = json.loads(split_path.read_text(encoding="utf-8"))
    train_g = set(split["train_group_ids"])
    val_g = set(split["validation_group_ids"])
    test_g = set(split["test_reserved_group_ids"])

    rows = _eligible(_load_jsonl(LABELS))
    train = [r for r in rows if r["group_id"] in train_g]
    val = [r for r in rows if r["group_id"] in val_g]
    test_reserved = [r for r in rows if r["group_id"] in test_g]

    if not train or not val:
        print("Empty train/val after split filter.", file=sys.stderr)
        return 2

    pipe, feat_meta = _build_pipeline(variant)
    X_train = [r["text"] for r in train]
    y_train = [r["label"] for r in train]

    t0 = time.perf_counter()
    pipe.fit(X_train, y_train)
    fit_s = time.perf_counter() - t0

    ART.mkdir(parents=True, exist_ok=True)
    model_path = ART / f"{stem}.joblib"
    joblib.dump(pipe, model_path)

    def _counts(part: list[dict]) -> dict:
        c = {k: 0 for k in CLASS_ORDER}
        for r in part:
            c[r["label"]] = c.get(r["label"], 0) + 1
        return c

    meta = {
        "spec_id": stem,
        "candidate": cand_name,
        "split_id": split.get("spec_id"),
        "random_seed": RANDOM_SEED,
        "features": feat_meta,
        "C_selection": "frozen_no_grid_on_test_or_vault",
        "challenge_agent1": (
            "More diverse data helps but min_df=2 + What-is template overlap "
            "also drove smoke off-topic misses; lr_mindf1 / linearsvc are ablations."
        ),
        "n_train": len(train),
        "n_val": len(val),
        "n_test_reserved": len(test_reserved),
        "train_counts": _counts(train),
        "val_counts": _counts(val),
        "test_reserved_counts": _counts(test_reserved),
        "class_order": CLASS_ORDER,
        "fit_seconds": round(fit_s, 4),
        "model_path": str(model_path.relative_to(ROOT)),
        "note": "DEVELOPMENT candidate — not production; vault/test unused for selection",
        "eval_vault_used": False,
        "test_reserved_used_for_selection": False,
    }
    (ART / f"{stem}.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(json.dumps(meta, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
