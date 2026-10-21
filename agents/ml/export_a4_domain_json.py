"""
Export a4-domain-clf-improve-v1-lr_mindf1.joblib → full JSON for Node parity.

  cd agents
  .\\.venv\\Scripts\\Activate.ps1
  python -m ml.export_a4_domain_json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / "artifacts" / "a4_domain"
JOBLIB = ART / "a4-domain-clf-improve-v1-lr_mindf1.joblib"
OUT = ART / "a4-domain-clf-improve-v1-lr_mindf1.json"
FIXTURES = ART / "a4-domain-clf-parity-fixtures.json"
DATA = ROOT / "ml" / "data" / "a4_domain"
LABELS = DATA / "a4-domain-labels.v1.jsonl"
SPLIT = DATA / "a4-domain-split-improve-v1.json"

SPEC_ID = "a4-domain-clf-improve-v1-lr_mindf1"


def _load_jsonl(path: Path) -> list[dict]:
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line:
            rows.append(json.loads(line))
    return rows


def _vectorizer_export(name: str, vec) -> dict:
    # vocabulary: token -> index
    vocab = {str(k): int(v) for k, v in vec.vocabulary_.items()}
    idf = vec.idf_.tolist()
    return {
        "name": name,
        "analyzer": vec.analyzer,
        "ngram_range": list(vec.ngram_range),
        "min_df": int(vec.min_df) if isinstance(vec.min_df, (int, float)) else vec.min_df,
        "max_df": float(vec.max_df),
        "sublinear_tf": bool(vec.sublinear_tf),
        "lowercase": bool(vec.lowercase),
        "strip_accents": vec.strip_accents,
        "norm": vec.norm,
        "use_idf": bool(vec.use_idf),
        "smooth_idf": bool(vec.smooth_idf),
        "token_pattern": getattr(vec, "token_pattern", None),
        "vocabulary": vocab,
        "idf": idf,
        "n_features": len(vocab),
    }


def main() -> int:
    try:
        import joblib
        import numpy as np
    except ImportError as e:
        print(e, file=sys.stderr)
        return 2

    if not JOBLIB.is_file():
        print(f"Missing {JOBLIB}", file=sys.stderr)
        return 2

    pipe = joblib.load(JOBLIB)
    feats = pipe.named_steps["features"]
    clf = pipe.named_steps["clf"]
    word = dict(feats.transformer_list)["word"]
    char = dict(feats.transformer_list)["char"]

    export = {
        "spec_id": SPEC_ID,
        "format_version": 1,
        "sklearn_note": "FeatureUnion(word,char) then LogisticRegression; Node must match predict_proba",
        "feature_order": ["word", "char"],
        "word": _vectorizer_export("word", word),
        "char": _vectorizer_export("char", char),
        "classifier": {
            "type": "LogisticRegression",
            "classes": [str(c) for c in clf.classes_],
            "coef": np.asarray(clf.coef_, dtype=np.float64).tolist(),
            "intercept": np.asarray(clf.intercept_, dtype=np.float64).tolist(),
            "C": float(clf.C),
            "solver": str(clf.solver),
        },
        "policy_defaults": {
            "policy": "ml_tau",
            "tau": 0.45,
            "tau_rescue": 0.45,
            "tau_veto": 0.50,
            "mode_default": "off",
            "note": "Val-preferred enforce policy is ml_tau@0.45 (FA=3,FR=4); hybrid_v1 optional A/B",
        },
    }
    OUT.write_text(json.dumps(export), encoding="utf-8")
    print(f"Wrote {OUT} bytes={OUT.stat().st_size}")

    # Parity fixtures: validation texts + a few probes (not vault/test-only tuning set)
    split = json.loads(SPLIT.read_text(encoding="utf-8"))
    val_g = set(split["validation_group_ids"])
    rows = [
        r
        for r in _load_jsonl(LABELS)
        if r.get("train_eligible")
        and r.get("review", {}).get("status") == "accepted"
        and r["group_id"] in val_g
    ]
    probes = [
        "What is money?",
        "What is a loan?",
        "How do airplanes stay in the air?",
        "What is the capital of France?",
        "What is photosynthesis?",
        "What is PAR30 in microfinance?",
        "finance PAR NPL — best pizza recipe?",
        "Why do people use a monthly household budget?",
        "Which river runs through London?",
        "How can a small lender tell whether it's collecting money back successfully?",
    ]
    texts = [r["text"] for r in rows] + probes
    ids = [r["id"] for r in rows] + [f"probe-{i}" for i in range(len(probes))]

    proba = pipe.predict_proba(texts)
    pred = pipe.predict(texts)
    classes = [str(c) for c in clf.classes_]
    fixtures = []
    for i, text in enumerate(texts):
        fixtures.append(
            {
                "id": ids[i],
                "text": text,
                "pred": str(pred[i]),
                "proba": {classes[j]: float(proba[i, j]) for j in range(len(classes))},
            }
        )
    FIXTURES.write_text(
        json.dumps(
            {
                "spec_id": SPEC_ID,
                "source": "validation_plus_probes",
                "n": len(fixtures),
                "classes": classes,
                "fixtures": fixtures,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Wrote {FIXTURES} n={len(fixtures)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
