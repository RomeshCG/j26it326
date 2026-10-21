# A4 domain classifier — smoke train summary (NOT research-grade)

**Date:** 2026-10-20  
**Status:** Engineering dry-run only. **Not** production-ready. **Not** wired into A4.  
**Artifacts:** `agents/artifacts/a4_domain/a4-domain-clf-smoke-v0.*` (local; gitignored)

---

## Methodology

| Item | Choice |
|------|--------|
| Model | TF-IDF word(1–2) + char_wb(3–5) FeatureUnion → Logistic Regression (lbfgs, C=**1.0** frozen, balanced, seed **42**) |
| Split | [`a4-domain-split-smoke-v1.json`](./a4-domain-split-smoke-v1.json) — **reuses** v0 group IDs (no reshuffle); counts refreshed |
| Train / val / test_reserved | **94** / **23** / **23** (eligible accepted only) |
| Excluded | Drafts (`104`); eval vault **never** loaded for fit or selection |
| C grid | **Skipped** (challenge: val mixed=3 → macro-F1 selection is noise) |
| sklearn note | `multi_class` removed (sklearn 1.9+) |

---

## Validation results (n=23)

| Metric | Value |
|--------|-------|
| Accuracy | **0.696** |
| Macro-F1 | **0.600** |
| Finance P/R/F1 | 0.75 / 0.86 / **0.80** |
| Off-topic P/R/F1 | 1.00 / **0.33** / 0.50 |
| Mixed P/R/F1 | 0.40 / 0.67 / 0.50 |

**Confusion (rows=gold, cols=pred: finance, off_topic, mixed):**

```
finance    [[12, 0, 2],
off_topic   [ 3, 2, 1],
mixed       [ 1, 0, 2]]
```

| Binary (finance vs not) | Count |
|-------------------------|-------|
| False-accept (pred finance, gold not) | **4** |
| False-reject (pred not, gold finance) | **2** |

**Latency (warm single predict):** ~**0.9 ms** mean (n=30).

**F_PARA slice (n=6 val):** accuracy **1.0** — ML recovers Stage-0 cue-miss paraphrases on this tiny slice.

---

## Stage-0 comparison (same val set)

| | Count / rate |
|--|--|
| Stage-0 false-allow (cue hit, gold off_topic) | **2** (33% of off_topic) — stuffing |
| Stage-0 false-refuse (cue miss, gold finance) | **6** (43% of finance) — mostly F_PARA |

ML predicts finance on **9** val rows where Stage-0 misses (intended gap fill) but also over-predicts finance on some off_topic/trivia.

---

## Hand probes (not used for selection; vault untouched)

| Probe | ML | Stage-0 |
|-------|-----|---------|
| What is money? | finance | miss |
| What is a loan? | **off_topic** | hit |
| How do airplanes stay in the air? | **finance** | miss |
| What is the capital of France? | **finance** | miss |
| What is photosynthesis? | off_topic | miss |
| What is PAR30 in microfinance? | finance | hit |
| finance PAR NPL — best pizza recipe? | off_topic | hit |

---

## Challenge Agent1 / limitations

1. **Do not cite these numbers in research/viva as model quality** — n_val=23, corpus 140 &lt; spec 180, incomplete human review.
2. **Off-topic recall is the failure mode** — short trivia/weather/politics → finance; probes confirm aviation/geography false-accept.
3. **“What is a loan?” → off_topic** shows brittle lexical overfitting despite Stage-0 correctly allowing.
4. Keeping Stage-0 as outer fail-closed gate remains necessary; ML is not ready to replace it.
5. Soft `requires_human` on accepted `a4d-000134` left eligible (not a draft) — document, don’t silently drop mid-smoke.

---

## Recommendation

**Improve before integration.** Expand clean off_topic / short GK negatives, add a finance confidence threshold τ on validation (after more mixed/off_topic support), then retrain toward ≥180. Do **not** wire smoke-v0 into production A4.
