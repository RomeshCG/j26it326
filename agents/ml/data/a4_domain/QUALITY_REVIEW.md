# A4 domain seed — quality review (no expansion)

**Date:** 2026-10-20  
**Scope:** Review of seed pack against [`docs/M4_A4_DOMAIN_CLASSIFIER_DATASET_SPEC.md`](../../../../docs/M4_A4_DOMAIN_CLASSIFIER_DATASET_SPEC.md).  
**Not claimed:** Independent human/peer second review. Annotator remains `seed-author`. `second_review` is `requires_human` or `not_performed` only.

**Corpus after this review:** **54** rows in `a4-domain-labels.v1.jsonl` (`split: null`).  
**Removed from knowledge-classifier pool:** `a4d-000055` (supported NLQ string).

**Later (pre-expansion finalize):** `a4d-000052` accepted as `mixed`/`M_EDU_LIVE` via Agent1+user (`decision_source`), **not** an independent human audit — see `HUMAN_REVIEW_PACKET.md`. Categories `O_STUFF` / `O_WEATHER` applied.

---

## 1. Automated checks (non-mutating except metadata already corrected)

| Check | Result |
|-------|--------|
| Exact normalized text duplicates | **None** |
| Cross-`group_id` Jaccard ≥ 0.85 | **None** |
| `stage0_cue_hit` vs live `hasFinanceOrProductSubstanceCue` | **0 mismatches** |
| All 16 `F_PARA` Stage-0 cue-miss | **Confirmed** (actual backend code) |
| Premature train/val/test splits | **None** (`split` null) |

---

## 2. Disposition of flagged IDs

### `a4d-000052` — kept **draft**

**Text:** “Is late payment the same as PAR or something we track live for this branch right now?”

| Option | Label / category | Justification |
|--------|------------------|---------------|
| **Recommended** | `mixed` / `M_EDU_LIVE` (or keep `M_AMBIG`) | Same utterance asks for a definitional comparison **and** live branch tracking (“we … this branch right now”). Spec tie-break: finance vs mixed → **mixed**. |
| Alternative A | `finance` / `F_COMPARE` | Only if the live clause is ignored — invents a narrower intent. |
| Alternative B | Reject / rewrite | Split into two questions before accepting. |

**Action:** Leave `review.status: draft` until a human confirms wording/intent. Do not train on it.

### `a4d-000055` — **removed** from this file

**Text:** “How many Tier 3 actions are awaiting approval?”

Already covered for NLQ regression (no new fixture added):

- `backend/eval-fixtures/a4/a4-knowledge-cases.v1.json` **K20** (`stage: nlq_not_knowledge`)
- `backend/scripts/verify-a4-nlq.ts` / `verify-a4-knowledge.ts` (exact string)
- Intent gold / corpus verifiers under `backend/eval-fixtures/a4/` and scripts

Optional later: adversarial holdout file may reference NLQ strings **without** putting them in the domain train pool (spec §2.2).

---

## 3. Class / category snapshot (54 rows)

| Label | n | Notes |
|-------|---|--------|
| finance | 28 | 16 `F_PARA` (all cue-miss) |
| off_topic | 15 | Includes 2 keyword-stuff rows |
| mixed | 11 | Includes 1 draft (`a4d-000052`) |

Accepted for future train candidacy (excluding draft): **53**.

---

## 4. `F_PARA` (16) — labeling & grouping

| Group | IDs | Verdict |
|-------|-----|---------|
| `para-late-pay-colloquial-v1` | 001–003 | OK; cohesive |
| `para-collection-quality-v1` | 004–006 | 004–005 OK; **006 soft** (field-cash ops vs collection education) |
| `para-missed-due-dates-v1` | 007–008 | OK (only 2 members — expand later, not now) |
| `para-overdue-balance-plain-v1` | 009–010 | OK; correctly avoids Stage-0 `overdue` |
| `para-recovery-health-v1` | 011–012 | OK (2 members) |
| `para-loss-reserve-plain-v1` | 013–014 | 013 OK; **014 soft** (metaphorical “deals … sour”) |
| `para-principal-vs-fee-v1` | 015–016 | OK |

**Proposed corrections (human approve before status change):**

- Confirm or rewrite **006**, **014** (soft ambiguity notes already on rows).
- Prefer ≥3 paraphrases per `F_PARA` group when expanding (several groups have only 2).

No hard mislabels found among the 16 cue-miss set.

---

## 5. Mixed examples

| ID | Category | Verdict |
|----|----------|---------|
| 042–044, 050–051 | `M_EDU_LIVE` | Correct edu+live |
| 045–046 | `M_EDU_ACTION` | Correct |
| 047 | `M_LIVE_ONLY` | Correct (account fishing); Stage-0 cue **hit** |
| 048 | `M_LIVE_ONLY` | Correct for 3-class fail-closed; Stage-0 cue **miss** (`borrowers` ≠ `borrower`) — Node `tenant_data` still applies |
| 049 | `M_LIVE_ONLY` | Correct; Stage-0 cue **miss** → lexical gate would `off_topic` today |
| 052 | `M_AMBIG` | Draft — see §2 |

**Schema tension:** `M_LIVE_ONLY` shares top-level label `mixed` with edu+live. Routing-wise both refuse knowledge; Node reason strings differ (`tenant_data_without_tool` vs `mixed_intent`). Rely on `category` until a schema change is approved.

---

## 6. Keyword stuffing

| ID | Label | Verdict |
|----|-------|---------|
| `a4d-000041` | `off_topic` / `O_FOOD` | Correct (ask = bake cake). Stage-0 cue **hit** — lexical allowlist may pass; ML must learn ask intent. |
| `a4d-000054` | `off_topic` / `O_CREATIVE` | Correct (ask = haiku). |

**Gap:** No dedicated `O_STUFF` category (stuffed under food/creative). Fine for seed; consider on expansion.

---

## 7. Other issues / category gaps

| Item | Issue | Proposal |
|------|--------|----------|
| `a4d-000035` weather | Bucketed `O_SPORTS_NEWS` | Spec allows; rename bucket or add `O_WEATHER` later |
| Thin product coverage | Only Agent 3 + GT Tier 3 | Gap for later expansion (A1/A2/A4) |
| Thin `F_LK` / `F_EDGE` | 1 each | Gap |
| Politics | Absent in seed | Gap under `O_SPORTS_NEWS` |
| Pure action (no edu) | Absent | Spec: Node hardRefuse; optional adversarial later — not train |
| Intra-group thinness | Several groups size 1–2 | Not repetitive; under-paraphrased |

No artificially copy-paste repetitive rows across groups detected.

---

## 8. Second-review honesty

| Value | Meaning |
|-------|---------|
| `requires_human` | Spec mandates second look (`F_PARA`, `mixed`, stuffing, drafts) — **not done** |
| `not_performed` | Spec does not mandate; also **not done** |

**Still needing human approval before train:** all `requires_human` rows + draft `a4d-000052` + soft notes on 006/014.

This review is **author quality audit + code verification**, not a peer annotation pass.

---

## 9. Challenge to Agent1

### 9.1 Excluding pure NLQ from domain ML train

**Agree with exclusion from the knowledge-classifier training pool.** Supported counts are owned by `a4-intent-v2` + tools; labeling them `mixed` would teach the wrong head and risk knowledge-gate interference if mis-wired.

**Disagree with storing NLQ inside the domain labels file even as draft.** Prefer: NLQ fixtures only (already true via K20 / NLQ verifies) + optional **adversarial holdout** later that asserts “domain model must not veto NLQ path” without using those rows for weight updates.

### 9.2 Three-class schema

**Keep three coarse labels for seed/routing simplicity**, but the seed already shows strain:

- `mixed` conflates edu+live, edu+action, and live-only.
- Cue-less live asks (048, 049) are Stage-0 `off_topic` today but labeled `mixed` for fail-closed knowledge — consistent with refuse, inconsistent with Stage-0 reason string.

**Recommended alternative (no schema change until approved):**

1. Keep labels `{finance, off_topic, mixed}` for the classifier head.
2. Treat **`category` as first-class evaluation slices** (report F1 by `M_EDU_LIVE` vs `M_LIVE_ONLY` vs `O_*`).
3. At wire time: map `finance`→knowledge; everything else→unsupported; optionally map categories to Node reason codes (`mixed_intent` vs `tenant_data` vs `off_topic`) **deterministically from category**, not from a 4th ML class — unless error analysis later demands a dedicated `live_ops` class with enough labels.

Do **not** add a 4th top-level class on 54 rows.

---

## 10. Applied file changes (this pass)

1. Removed `a4d-000055` from `a4-domain-labels.v1.jsonl`.
2. Set accurate `second_review` values (`requires_human` / `not_performed`).
3. Clarified notes on 006, 014, 035, 048, 049, 052.
4. No corpus expansion; no training; no routing edits.

---

## 11. Stop / next (await approval)

1. Human resolve `a4d-000052` (+ soft 006/014).  
2. Human second-review pass on `requires_human` rows.  
3. Then expand thin gaps / group sizes — still no train until leakage-ready grouped splits.
