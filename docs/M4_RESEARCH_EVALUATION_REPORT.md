# Controlled Evaluation of M4 Agent Governance and Decision Components

**Project:** IMFS / MicroFlow — Component 4 (M4)
**Branch:** `research/m4-eval-stage1`
**Document status:** **Draft complete for review** — objectives, methodology, results, discussion, and conclusions

This report defines *what* is evaluated, *which questions* the existing evidence can answer, *how* that evidence was produced, the **measured results** under those protocols, their **interpretation**, and *what must not be claimed*. It does not present M4 as a production-certified AI platform.

---

## 1. Evaluation objectives

### 1.1 Purpose

Component 4 (M4) of the IMFS / MicroFlow system introduces Graduated Trust (GT) governance together with four specialised agents (A1–A4). Before broader research claims about “AI-assisted microfinance operations” can be made, the project requires a **controlled evaluation** that:

1. States explicitly what each agent and the GT layer are intended to do.
2. Separates **deterministic policy / rule conformance** from **predictive (model) performance**.
3. Grounds claims in **repository-tracked oracles, fixtures, and sanitized summaries**, rather than anecdotal demos or outdated handover notes.

The objective of this evaluation report is therefore **scientific bookkeeping of M4 decision components under declared protocols**, not certification of regulatory compliance, end-to-end product quality, or general artificial intelligence capability.

### 1.2 Scope

| In scope | Out of scope (this report) |
|----------|----------------------------|
| A1 compliance-*readiness* rules and labelled fixtures | Official CBSL filing accuracy or examiner validation |
| A2 budget-threshold decision and validation rules | Live M2 ledger / budget-feed quality |
| A3 Isolation Forest v2 on synthetic volume data | Real MFI production fraud detection |
| A4 NLQ intent classification (Ollama → parse → lexical gate) on a frozen gold corpus | General chatbot / conversational quality; grounded DB answer correctness |
| Graduated Trust default policies, transitions, and A1 approve-gate helpers | Production-wide security assurance; penetration testing |
| Offline functional regression framing (as supporting provenance) | M1–M3 subsystems; UX studies; human-subject experiments |

Authoritative methodology and metric sources for predictive / live components are the tracked summaries:

- A3: [`docs/M4_A3_IFOREST_V2_EVAL_SUMMARY.json`](./M4_A3_IFOREST_V2_EVAL_SUMMARY.json)
- A4: [`docs/M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json`](./M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json)

Deterministic rule-conformance oracles and packs live under `backend/eval-fixtures/{a1,a2,gt}/`. The A4 **gold-intent corpus** (semantic labels for predictive / pipeline evaluation, not rule-agreement scoring) lives under `backend/eval-fixtures/a4/`. Offline suite inventory and disclaimers are documented in [`docs/M4_OFFLINE_EVAL.md`](./M4_OFFLINE_EVAL.md).

### 1.3 Evidence classes (do not conflate)

M4 evaluation evidence falls into three **non-interchangeable** classes:

| Class | Meaning | Typical metric | Agents / layers |
|-------|---------|----------------|-----------------|
| **Functional / regression correctness** | Implementation matches coded contracts under offline verifies | Suite pass / assertion counts | Supporting (`eval:offline`, unit verifies) |
| **Rule / policy conformance** | Implementation matches a **written oracle** on labelled synthetic fixtures | Agreement rate vs oracle | A1, A2, GT |
| **Predictive / pipeline performance** | Model or model+guards scored against held-out or gold labels | Precision/recall, intent agreement, confusion | A3, A4 |

A high rule-agreement rate does **not** imply strong predictive performance, and conversely. This report never collapses the three classes into a single “M4 AI accuracy” figure.

---

## 2. Research questions

Five evidence areas are retained. To avoid five near-identical “does the code match the rules?” questions, they are organised into **two families**. Family A asks whether **declared governance and threshold policies** are faithfully implemented. Family B asks whether **data-driven or model-backed components** behave as claimed under controlled datasets.

### Family A — Deterministic policy and rule conformance

**RQ-A1 (A1).** On the frozen labelled readiness fixtures derived from `a1-readiness-oracle-v1`, does `analyzeA1Readiness` agree with the oracle on (i) overall readiness status and (ii) the set of `{code, severity}` data gaps?

- Oracle: [`backend/eval-fixtures/a1/SPEC.md`](../backend/eval-fixtures/a1/SPEC.md)
- Pack: [`backend/eval-fixtures/a1/a1-readiness-fixtures.v1.json`](../backend/eval-fixtures/a1/a1-readiness-fixtures.v1.json) (8 fixtures)
- Runner: `npm run verify:a1-fixtures` (see also `verify:a1-compliance`)

**RQ-A2 (A2).** On the frozen threshold fixtures derived from `a2-budget-threshold-oracle-v1`, does the A2 validator/evaluator (i) reproduce the oracle breach decision `metricValue >= threshold` for valid inputs, and (ii) reject invalid bodies before comparison?

- Oracle: [`backend/eval-fixtures/a2/SPEC.md`](../backend/eval-fixtures/a2/SPEC.md)
- Pack: [`backend/eval-fixtures/a2/a2-threshold-fixtures.v1.json`](../backend/eval-fixtures/a2/a2-threshold-fixtures.v1.json) (6 threshold decisions + 4 input rejections)
- Runner: `npm run verify:a2-fixtures` (see also `verify:a2-budget`)

**RQ-GT (Graduated Trust).** On the frozen governance fixtures derived from `gt-governance-oracle-v1`, do default tier routing, tier fallback, status transitions, post-handler status mapping, and A1 Tier-3 approve-gate checks agree with the written oracle?

- Oracle: [`backend/eval-fixtures/gt/SPEC.md`](../backend/eval-fixtures/gt/SPEC.md)
- Pack: [`backend/eval-fixtures/gt/gt-governance-fixtures.v1.json`](../backend/eval-fixtures/gt/gt-governance-fixtures.v1.json) (12 fixtures)
- Runner: `npm run verify:gt-fixtures` (see also `verify:graduated-trust`)

> **Naming.** `RQ-GT` denotes Graduated Trust. **Agent A3** (Isolation Forest) is addressed only under **RQ-B1**, to avoid colliding the agent id with a research-question id.
> **Note on GT novelty.** The GT pack marks fixtures as overlapping existing verifies (`duplicateOfVerify`). RQ-GT therefore measures **labelled agreement with a published oracle**, not incremental security coverage beyond those verifies.

### Family B — Controlled predictive and pipeline performance

**RQ-B1 (A3).** Under the Isolation Forest v2 protocol on synthetic volume data, what are the held-out (primary **test**) detection metrics—precision, recall, F1, false-positive rate, PR-AUC, ROC-AUC, and confusion counts—and how do they degrade on anomaly subtypes and unseen holdout branches?

- Authoritative summary: [`docs/M4_A3_IFOREST_V2_EVAL_SUMMARY.json`](./M4_A3_IFOREST_V2_EVAL_SUMMARY.json)
- Pipeline modules (reproduction): `agents/ml/generate_synthetic_volume.py`, `train_iforest.py`, `evaluate_iforest.py` (see summary `reproduce` block)
- Primary claim set: `test.overall` in the summary (**not** the validation split used for threshold selection)

**RQ-B2 (A4).** On a single authorized live run against the frozen 34-question intent gold corpus, what are (i) raw semantic-intent agreement, (ii) full-pipeline three-class accuracy after parse and lexical gate (with declared exclusions), (iii) operational success including unsupported and invalid-parameter rejection, and (iv) documented failure modes (transport timeout, false accept, gate false negatives)?

- Capability oracle / gold: [`backend/eval-fixtures/a4/SPEC.md`](../backend/eval-fixtures/a4/SPEC.md), [`backend/eval-fixtures/a4/a4-intent-gold.v1.json`](../backend/eval-fixtures/a4/a4-intent-gold.v1.json)
- Authoritative live baseline summary: [`docs/M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json`](./M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json)
- Full per-question artifact (gitignored): `backend/eval-results/a4-intent-ollama-2026-10-16T16-42-27-284Z.json`
- Runner: `npm run eval:a4-intent-ollama`
- Experiment provenance recorded in the summary (prompt `a4-intent-v2`, model `qwen2.5:1.5b`, temperature 0, git SHA of the live run)

Measured answers to RQ-A1, RQ-A2, RQ-GT, RQ-B1, and RQ-B2 are reported in §4, separately by evidence family and **without** cross-family performance ranking.

---

## 3. Methodology

### 3.1 General principles

1. **Oracle-first labelling.** For A1, A2, and GT, expected labels are derived from written SPEC rules. Fixtures are rejected by guard scripts if labels disagree with the oracle helpers (see `verify:*-fixture-guards`).
2. **Tracked summaries for model/live claims.** A3 and A4 research numbers cited in later sections must come from the sanitized JSON summaries above, not from untracked notebook exports or chat transcripts.
3. **Denominator honesty.** Incomplete live attempts (e.g. transport timeouts) and protocol exclusions (e.g. invalid-parameter rows outside A4’s three-class matrix) are stated explicitly in the A4 summary and must be repeated wherever rates are quoted.
4. **No silent retargeting.** Gold labels and production prompts/gates are not edited to improve scores after measurement (A4 SPEC and evaluation disclaimers).
5. **Code and measured artifacts override narrative docs** when they conflict (e.g. historical handover status of the evaluation harness).

### 3.2 A1 / A2 / GT — project specifications and labelled fixtures

**A1.** The function under study is pure readiness analysis (`analyzeA1Readiness`), versioned as `a1-readiness-rules-v1`. For this evaluation, fixture inputs are **synthetic institutional facts** constructed for the pack—not live tenant database aggregates. Status aggregation (blocking → `not_ready`; else warnings → `ready_with_warnings`; else scoped completion) and gap codes/severities are defined in the A1 SPEC. Measurement is **status agreement** and **gap-set agreement** (order-insensitive `{code, severity}`), not examiner judgement of a real CBSL submission.

**A2.** The decision under study is a deterministic threshold rule after input validation: breach iff `metricValue >= threshold`, with explicit rejection of non-finite, non-positive threshold, negative metric, and related invalid bodies (A2 SPEC R1–R2). Measurement splits **valid-decision agreement** (6 fixtures) from **invalid-input rejection** (4 fixtures). Caller-supplied metrics (`manual_api_v1`) are assumed; automatic M2 monitoring is not evaluated.

**GT.** Fixtures exercise default policy tier routing, fail-closed tier fallback, legal status transitions, post-handler status mapping, and pure `evaluateA1ApproveGate` SoD/hash scenarios (GT SPEC G1–G5). Measurement is **category-wise rule agreement**. Live HTTP RBAC, Prisma durability, and database-administrator threat models are outside the fixture protocol.

Offline aggregation of many verifies is described in [`docs/M4_OFFLINE_EVAL.md`](./M4_OFFLINE_EVAL.md). Those suite pass rates are **functional regression / fixture agreement** provenance; they are **not** interchangeable with A3/A4 predictive metrics.

### 3.3 A3 — synthetic generation, splits, and threshold selection

As recorded in [`docs/M4_A3_IFOREST_V2_EVAL_SUMMARY.json`](./M4_A3_IFOREST_V2_EVAL_SUMMARY.json):

- Data are **controlled synthetic** volumes (`synthetic-volume-v2`), not production MFI traffic.
- Splits: train / validation / test counts are recorded in the summary; holdout branches never appear in training.
- Model: RobustScaler + sklearn Isolation Forest (`a3-iforest-v2`), with fixed seeds and hyperparameters listed in the summary.
- **Threshold selection** uses the validation set (bootstrap median under stated precision/recall constraints). The **primary research claim** is one-shot performance on the independent **test** split after the threshold is frozen.
- Score semantics: decision-function transforms used for ranking/display are **not** calibrated fraud probabilities (summary `scoreSemantics` and limitations).
- Local regeneration produced bit-identical test overall metrics relative to a verified external backup (summary `localReproducibility`); raw CSVs and joblib weights remain gitignored under `agents/`.

Subtype and difficulty recalls are **recall among labelled positives only**; type-level precision is not produced by the evaluator and must not be invented.

### 3.4 A4 — frozen corpus, live pipeline, and denominator rules

**Corpus.** Capability oracle `a4-intent-oracle-v1` and pack `a4-intent-gold.v1.json` (34 questions, pack version `1.0.0`) label **semantic** intent (and `paramsValid`) independently of lexical-gate behaviour. Items with `probesLexicalGateLimitation: true` remain semantically supported even when the production gate is expected to reject them ([`backend/eval-fixtures/a4/SPEC.md`](../backend/eval-fixtures/a4/SPEC.md)).

**Live protocol (recorded baseline).** One sequential Ollama chat evaluation (concurrency 1, temperature 0, configured timeout 30 s, no automatic retries) using production prompt version `a4-intent-v2` and model identity `qwen2.5:1.5b`, followed by `resolveNlqIntentFromModel` (parse + lexical gate). No database or Graduated Trust dispatch is required for this intent-only study. The authorized baseline summary cites the timestamped gitignored artifact and the live-run git SHA.

**Denominator rules (must be preserved in results writing):**

| Metric | Denominator / exclusion |
|--------|-------------------------|
| Raw semantic-intent agreement | Scored responses only (exclude transport errors) |
| Operational success | Same scored set; invalid-parameter success = pipeline `unsupported` |
| Full-pipeline three-class confusion / accuracy | Exclude `paramsValid: false`; exclude transport errors |
| Unsupported rejection / false accept | Gold `unsupported` items |
| Invalid-parameter rejection | Gold invalid-parameter items (G25–G27) |
| Parameter accuracy | Valid window items **correctly accepted** as `count_actions_window` |
| Latency for model behaviour | Prefer **non-transport** mean; report all-attempt mean separately if timeouts included |

Raw model intent and full-pipeline disposition are reported **separately** so that correct operational rejection of bad parameters is not mis-scored as a semantic classification error, and so that lexical-gate false negatives are not silently attributed solely to the language model.

### 3.5 Reproducibility and evidence provenance

| Concern | Practice |
|---------|----------|
| Spec / pack versions | Embedded in fixture JSON (`specId`, `fixturePackVersion`, ruleset/prompt fields) |
| A3 provenance | Summary records model/data versions, seeds, hyperparameters, git SHA of regeneration check |
| A4 provenance | Summary records prompt, model configured/reported, temperature, timeout, corpus ids, live-run git SHA, and path to gitignored full artifact |
| Secrets / infrastructure | Summaries omit endpoint URLs, credentials, and raw model transcripts |
| Working-tree hygiene | Full eval dumps under `backend/eval-results/**` and A3 artifacts under `agents/artifacts/**` are gitignored; research-facing numbers are promoted only via sanitized `docs/` JSON |

Exact commands for local reproduction appear in the A3 summary `reproduce` block, [`agents/ml/README.md`](../agents/ml/README.md), [`docs/M4_OFFLINE_EVAL.md`](./M4_OFFLINE_EVAL.md), and the A4 summary `reproduction` block.

---

## 4. Results

Results are organised by research-question family. **Family A** rates are deterministic **oracle agreement** on labelled fixtures (plus a separate offline regression note). **Family B** rates are **predictive / pipeline** measurements from the tracked A3 and A4 summaries. No cross-family ranking or single aggregate “AI accuracy” is reported.

### 4.1 Family A — Deterministic rule and policy conformance

#### 4.1.1 RQ-A1 — A1 compliance readiness

**Evidence:** [`backend/eval-fixtures/a1/SPEC.md`](../backend/eval-fixtures/a1/SPEC.md) (`a1-readiness-oracle-v1`, ruleset `a1-readiness-rules-v1`); pack [`a1-readiness-fixtures.v1.json`](../backend/eval-fixtures/a1/a1-readiness-fixtures.v1.json) (8 fixtures, category `readiness_analysis`); runner `npm run verify:a1-fixtures` (passed in the offline run in §4.3).

| Metric | Result | Denominator |
|--------|--------|-------------|
| Overall status agreement | **8/8** | All pack fixtures |
| Gap-code / severity set agreement | **8/8** | Same 8 fixtures (`{code, severity}` order-insensitive) |

Fixture expected statuses in the pack: one `evidence_complete_for_scoped_checks` (A1-F01), two `ready_with_warnings` (A1-F03, A1-F05), and five `not_ready` (A1-F02, A1-F04, A1-F06–A1-F08). Inputs are **synthetic institutional facts**. These rates measure internal readiness-rule conformance, not official CBSL compliance.

#### 4.1.2 RQ-A2 — A2 budget threshold

**Evidence:** [`backend/eval-fixtures/a2/SPEC.md`](../backend/eval-fixtures/a2/SPEC.md) (`a2-budget-threshold-oracle-v1`); pack [`a2-threshold-fixtures.v1.json`](../backend/eval-fixtures/a2/a2-threshold-fixtures.v1.json); `npm run verify:a2-fixtures`.

| Sub-protocol | Result | Denominator |
|--------------|--------|-------------|
| Valid threshold decisions (`category: threshold_decision`) | **6/6** | Oracle breach iff `metricValue >= threshold` |
| Invalid-input rejection (`category: input_rejection`) | **4/4** | Validate fails before compare |

Boundary coverage in the six valid cases includes: below-threshold (99 vs 100), **equality counts as breach** (100 vs 100), above-threshold (150 vs 100), zero metric with positive threshold, decimal equality breach (10.5 vs 10.5), and decimal just-below (10.49 vs 10.5). Rejections cover non-positive threshold (0, −1), negative metric (−1), and non-number metric (`null` / non-finite path). Scope is caller-supplied `manual_api_v1` metrics only—not live M2 feed quality.

#### 4.1.3 RQ-GT — Graduated Trust governance

**Evidence:** [`backend/eval-fixtures/gt/SPEC.md`](../backend/eval-fixtures/gt/SPEC.md) (`gt-governance-oracle-v1`); pack [`gt-governance-fixtures.v1.json`](../backend/eval-fixtures/gt/gt-governance-fixtures.v1.json); `npm run verify:gt-fixtures`.

| Category | Result | Fixtures |
|----------|--------|----------|
| Tier routing (G1–G2) | **5/5** | GT-F01–GT-F05 |
| Status transitions (G3) | **2/2** | GT-F06–GT-F07 |
| Post-handler status (G4) | **2/2** | GT-F08–GT-F09 |
| A1 approve-gate SoD/hash (G5) | **3/3** | GT-F10–GT-F12 |
| **Pack total** | **12/12** | |

All twelve fixtures set `duplicateOfVerify: true`: labelled oracle agreement overlapping existing regression coverage, not incremental production-security proof.

### 4.2 Family B — Predictive and pipeline performance

#### 4.2.1 RQ-B1 — A3 Isolation Forest (synthetic)

**Source of truth:** [`docs/M4_A3_IFOREST_V2_EVAL_SUMMARY.json`](./M4_A3_IFOREST_V2_EVAL_SUMMARY.json) (`a3-iforest-v2`, data `synthetic-volume-v2`).

**Primary claim — held-out test** (`test.role`: `primary_held_out_claim`):

| Quantity | Value |
|----------|-------|
| *n* (rows) | 760 (40 positive / 720 negative) |
| Precision | 0.7027027027027027 |
| Recall | 0.65 |
| F1 | 0.6753246753246753 |
| False-positive rate | 0.015277777777777777 |
| PR-AUC | 0.7767328317750506 |
| ROC-AUC | 0.9538194444444443 |
| TP / FP / TN / FN | 26 / 11 / 709 / 14 |

**Test recall by anomaly type** (positives only; *n*=8 each): `after_hours_burst` 0.875; `amount_spike` **0.0**; `combined_burst` 1.0; `new_payee_flood` 0.875; `volume_spike` 0.5. **By difficulty:** easy 0.8 (*n*=20); subtle 0.5 (*n*=20). The zero `amount_spike` recall is a hard limitation for any claim of detecting all financial anomalies.

**Unseen holdout branches** (`testHoldoutBranches`; never in train): *n*=280 (11 positive / 269 negative); precision 0.6666666666666666; recall 0.5454545454545454; F1 0.6; FPR 0.011152416356877323; PR-AUC 0.7172013756993995; ROC-AUC 0.9313957418046638; TP/FP/TN/FN = 6/3/266/5. Subtype counts are small (summary warns rates are unstable); `amount_spike` recall remains 0.0 (*n*=3).

**Validation split (threshold selection only — not the primary claim):** *n*=360 (40 positive); precision 0.9333333333333333; recall 0.7; F1 0.8; FPR 0.00625; PR-AUC 0.8502364348710921; ROC-AUC 0.9592968749999999; TP/FP/TN/FN = 28/2/318/12. Do not substitute these for test metrics when citing A3 performance.

#### 4.2.2 RQ-B2 — A4 NLQ intent (live baseline)

**Source of truth:** [`docs/M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json`](./M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json), from gitignored stamp `backend/eval-results/a4-intent-ollama-2026-10-16T16-42-27-284Z.json` (live-run git SHA `f71c788…`; prompt `a4-intent-v2`; model `qwen2.5:1.5b`; temperature 0).

**Sample accounting:** 34 gold questions attempted; **33** scored without transport error; **1** infra timeout (**A4-G01**, latency 30003 ms vs 30000 ms timeout). Cold start / model load is a *plausible* explanation only—not instrumented confirmation.

| Metric | Result | Denominator / note |
|--------|--------|-------------------|
| Raw semantic-intent agreement | **28/33** (rate 0.8484848484848485) | Excludes transport errors |
| Operational success | **29/33** (rate 0.8787878787878788) | Same scored set |
| Full-pipeline 3-class accuracy | **26/30** (0.8666666666666667) | Excludes `paramsValid: false` (G25–G27) and G01 |
| Unsupported rejection | **13/14** | False accept: **A4-G29** → `count_pending_tier3` |
| Invalid-parameter rejection | **3/3** | G25–G27; excluded from 3-class matrix |
| Window parameter accuracy \| accepted | **8/8** | Valid window rows accepted as `count_actions_window` |
| Lexical-gate FN probes | **G32, G33, G34** | Raw intent matched gold; pipeline `unsupported` |

**Confusion matrix** (rows = gold, columns = predicted; *n*=30, `totalsMatch: true`):

| gold \\ pred | pending | window | unsupported |
|--------------|--------:|-------:|------------:|
| `count_pending_tier3` | 5 | 0 | 2 |
| `count_actions_window` | 0 | 8 | 1 |
| `unsupported` | 1 | 0 | 13 |

**Per-class P/R/F1** (derived from the matrix in the summary):

| Class | P | R | F1 |
|-------|--:|--:|---:|
| `count_pending_tier3` | 0.8333333333333334 | 0.7142857142857143 | 0.7692307692307692 |
| `count_actions_window` | 1 | 0.8888888888888888 | 0.9411764705882353 |
| `unsupported` | 0.8125 | 0.9285714285714286 | 0.8666666666666666 |

**Latency:** successful (non-transport) mean **4590 ms** (*n*=33; min 2467; max 7198). All-attempt mean **5337.441176470588 ms** (*n*=34) includes the G01 timeout—prefer 4590 ms for model-latency claims. G32–G34 reduce pipeline accuracy despite correct raw intent; they are gate-limitation probes, not raw-intent misses.

### 4.3 Functional regression note (not research accuracy)

A fresh offline run on HEAD `eb6537014ee250ae01c0cbba83efae65313833ee` executed `npm run eval:offline` with **14/14 suites passed** (exit 0). Artifacts: gitignored `backend/eval-results/offline-eval-latest.json` (and Markdown twin).

This run is **functional regression / rule-fixture agreement hygiene**. It must **not** be cited as A3 or A4 model accuracy. Notable suite outcomes used as provenance for Family A and supporting verifies include `a1-fixtures` (17 asserts), `a2-fixtures` (10), `gt-fixtures` (13), `a4-intent-corpus` (169 structure checks), and `a4-gate-diagnostic` (**passed**, assertion counts **n/a** / not parsed). Gate-diagnostic pass ≠ the live A4 intent accuracy in §4.2.2.

---

## 5. Limitations and non-claims

The following boundaries are **constitutive** of a valid reading of this evaluation. They are not optional caveats to be dropped in a conclusions section.

1. **A1 is not official CBSL compliance certification.** The labelled evaluation uses **synthetic institutional facts** as an **internal evidence checklist** under project rules. No independent regulator, auditor, or CBSL examiner validated the outputs.

2. **A2 does not measure live M2 budget-feed quality.** Threshold correctness assumes caller-supplied metric values. Soft deduplication, monitoring coverage, and ledger correctness are outside the oracle.

3. **A3 synthetic performance does not establish real MFI fraud-detection accuracy.** Training and test labels are generated under a controlled simulator. Isolation Forest scores are not calibrated probabilities. In particular, failure modes on subtypes such as amount-only spikes (documented in the A3 summary) forbid claims of detecting “all financial anomalies.”

4. **A4 is not a general chatbot or NL understanding benchmark.** The study covers a **34-question**, two-intent-plus-unsupported corpus, a **single** live trial, and a **guarded** production pipeline. It does not measure multi-turn dialogue, grounded numeric answers, or cross-domain language tasks.

5. **GT fixture agreement does not prove production-wide security.** Pure helper and policy-table agreement excludes live JWT/RBAC paths, persistence threats, and adversarial operations research.

6. **No single overall “AI accuracy” score.** Rule-conformance rates, synthetic anomaly metrics, and live intent rates answer different research questions (Family A vs Family B). Aggregating them into one percentage would be methodologically false.

7. **Sample-size and trial-count limits.** A1/A2/GT packs are small by design (explainable unit oracles). A4’s live study is one run without confidence intervals. A3 holdout-branch positives are few; subtype rates there are unstable (A3 summary).

8. **Incomplete live attempts.** Transport or infrastructure failures (e.g. first-item timeout in the A4 baseline) reduce scored denominators. Traversal completion must not be narrated as “all questions successfully scored.”

9. **Deployment anecdotes are a separate evidence class.** Narrative live E2E notes in operational docs are not substitutes for the tracked summaries and labelled packs above unless promoted into versioned, sanitized metrics artifacts.

---

## 6. Discussion

Interpretation below is bounded by the measurements in §4 and the non-claims in §5. Points already stated as constitutive limits (e.g. “not CBSL certification,” “not chatbot benchmark”) are referenced rather than restated at length.

### 6.1 Family A — What rule agreement demonstrates

**A1.** Exact agreement on status and `{code, severity}` gap sets (8/8) shows that `analyzeA1Readiness` implements the published readiness oracle on the synthetic pack. That is valuable for **explainable, regression-testable** internal checks. It does **not** show that a real institution would pass an external CBSL process, nor that live tenant evidence is complete (§5.1).

**A2.** Correct decisions on equality, decimal boundaries, and invalid-body rejection (6/6 + 4/4) establish that the threshold policy `metricValue >= threshold` and its validators are implemented as specified. Operational usefulness still depends on whether upstream metrics are timely and correct—an unmeasured live M2 concern (§5.2).

**Graduated Trust.** Category-wise 12/12 agreement shows default tier routing, fail-closed fallback, transition legality, post-handler status mapping, and pure A1 approve-gate SoD/hash helpers match `gt-governance-oracle-v1`. Because every fixture duplicates existing verifies, this is **labelled documentation of known contracts**, not a new penetration or live RBAC study (§5.5). Offline fixtures cannot speak to JWT middleware, audit durability, or adversarial misuse.

Family A therefore supports a claim of **faithful implementation of declared deterministic rules**, not of autonomous “intelligent” compliance or security.

### 6.2 Family B — Predictive and pipeline behaviour

**A3.** On the primary synthetic test set, Isolation Forest v2 achieves moderate precision/recall (P≈0.70, R=0.65, F1≈0.68) with low FPR and strong ranking metrics (ROC-AUC≈0.95). That is meaningful **under the simulator’s anomaly definitions**. The same run shows **zero recall on `amount_spike`**, weaker subtle-anomaly recall (0.5), and a small unseen-branch positive count (*n*=11) where subtype rates are unstable (§4.2.1). Scores remain ranking transforms, not calibrated fraud probabilities (§5.3). Held-out synthetic success is therefore a **controlled detection baseline**, not evidence of real MFI fraud-ops readiness.

**A4.** Raw intent agreement (28/33) and operational success (29/33) indicate that, on this small gold set, the model often proposes the semantic class while the **parse + lexical gate** frequently recovers unsupported or invalid-parameter cases. Full-pipeline accuracy (26/30) is lower than raw agreement partly because **G32–G34** are intentional gate false-negative probes: the model’s raw intent matched gold supported intents, yet the gate blocked them—automation is constrained by a conservative lexical policy. The single unsupported **false accept (G29)** shows the opposite failure: the guarded pipeline still executed a pending-tier intent on a jailbreak-style ask. **G01**’s first-item timeout reduced scored coverage; cold start is a plausible infrastructure hypothesis only, not a confirmed diagnosis (§5.8). Latency should be quoted from the non-transport mean (4590 ms), not the timeout-inflated all-attempt mean.

Family B therefore supports **narrow, protocol-specific performance claims**, not general NLP or fraud SOTA comparisons. Cross-agent ranking against Family A percentages would be invalid (§5.6).

### 6.3 Design trade-offs (qualitative)

M4 couples **automation** (A3 scoring, A4 intent) with **governance** (GT tiers, A1 Tier-3 gates, A4 lexical fail-closed behaviour). The A4 gate probes illustrate a robustness–recall trade-off: rejecting paraphrases that omit cue words reduces false tool calls but also rejects some semantically valid asks. Homelab constraints (single small model, sequential inference, fixed timeout, no retries) limit latency variance and trial count; those choices were **operational safeguards**, not experimentally optimised hyperparameters. This discussion does not claim a measured Pareto frontier among automation, safety, and cost.

### 6.4 Offline regression in context

The 14/14 offline run at `eb65370` (§4.3) increases confidence that oracles, packs, and verifies still cohere after evaluation tooling landed. It remains **engineering hygiene**, not an additional predictive result.

---

## 7. Conclusions

| RQ | Evidence-bounded answer |
|----|-------------------------|
| **RQ-A1** | On the eight synthetic readiness fixtures, A1 achieved **exact status and gap-severity agreement** with `a1-readiness-oracle-v1`. This supports correct implementation of the internal readiness ruleset, **not** official CBSL compliance. |
| **RQ-A2** | A2 achieved **6/6** valid threshold decisions (including equality and decimal boundaries) and **4/4** invalid-input rejections under `a2-budget-threshold-oracle-v1`. Live budget-feed effectiveness was **not** measured. |
| **RQ-GT** | Graduated Trust helpers achieved **12/12** labelled agreement (5+2+2+3 by category), documenting policy and approve-gate contracts. This is **not** comprehensive security validation; all cases duplicate prior regression coverage. |
| **RQ-B1** | On synthetic held-out test data, A3 Isolation Forest v2 obtained the §4.2.1 test metrics (including TP/FP/TN/FN). Performance is **protocol- and simulator-specific**; `amount_spike` recall of 0 and small holdout-branch positives limit external claims. Real MFI validation remains outstanding. |
| **RQ-B2** | On one live 34-question baseline, A4 showed raw agreement **28/33**, operational success **29/33**, and pipeline 3-class accuracy **26/30**, with strong invalid-parameter rejection (**3/3**) and one unsupported false accept (**G29**). Gate probes **G32–G34** and timeout **G01** must be retained in any fair reading. This is **not** a general chatbot evaluation. |

**Synthesis.** M4’s evaluated contribution, on present evidence, is a **controlled demonstration** that (i) specified deterministic governance and threshold rules can be oracle-tested, and (ii) two data-driven components can be measured under declared synthetic or small live protocols with honest failure modes. Correct rule implementation ≠ predictive excellence ≠ deployment certification. External validation (regulatory, real traffic, larger NL corpora, live RBAC/audit) is still required before stronger claims.

---

## 8. Future work

Priorities suggested by the gaps in §4–§5 (no new results claimed here):

1. **A3 — real MFI data**, only with appropriate permissions and ethics/data-governance review; re-estimate detection metrics without treating current scores as probabilities.
2. **A4 — larger, independently labelled** intent corpora and **repeated** live trials (multi-seed / multi-session) before interval estimates or model comparisons.
3. **A4 — optional conservative pre-Ollama filter** as a *future, separately evaluated* optimisation if gate false negatives dominate product risk; **not** an implemented feature in this baseline and not credited here.
4. **Live GT / RBAC / audit** evaluation packs (HTTP-level), distinct from pure helper fixtures.
5. **Cross-module ERP data integration** so readiness and alerts consume consistent operational facts rather than only synthetic or manually supplied inputs.
6. **Reliability and cold-start** characterisation for Ollama-backed paths (instrumented warmup vs timeout), without retrofitting a confirmed cause onto G01.
7. **HR/Payroll** remains an unfinished **supporting** M4 implementation area for tenant evidence completeness; it is **not** an evaluated AI research contribution in this report.

---

## Document control

| Field | Value |
|-------|--------|
| Draft slice | 3 — discussion, conclusions, and future work |
| Intentionally omitted | Additional experiments; promotional “production AI platform” claims; cross-agent accuracy rankings |
| Evidence authority | Tracked A3/A4 summaries; fixture SPECs and packs; offline-eval at `eb65370` |
| Next step | Final document review / formatting for submission (no new measurements required for this draft) |

---

*End of draft for review.*
