# Human review packet — A4 domain seed (pre-expansion)

**Purpose:** Resolve remaining uncertain seed labels before any corpus expansion or training.  
**Not this packet:** Agent1/user acceptance of `a4d-000052` (already applied) — that is **not** an independent human annotation audit. All `second_review: requires_human` rows still need a real annotator pass.

**Corpus:** `a4-domain-labels.v1.jsonl` — **54** rows, `split: null`. NLQ counts remain outside this pool.

---

## A. Flagged soft cases (decide: accept / rewrite / exclude)

### A1 — `a4d-000006`

| Field | Value |
|-------|--------|
| **Exact text** | What would a field officer look at to see if cash is coming back from the field as expected? |
| **Current** | `finance` / `F_PARA` / `para-collection-quality-v1` |
| **Stage-0 cue** | `false` (verified) |
| **Issue** | Reads as field-ops / cash logistics; finance-education reading is indirect. |

| Decision | Recommendation |
|----------|----------------|
| **Recommend** | **Rewrite** (keep same `group_id`) to a clearer cue-less collection/portfolio-quality ask, e.g. focus on “how staff tell if customer payments are coming in as planned” without “field officer / field”. |
| Accept if | Human confirms MFI collection-education intent is obvious to staff. |
| Exclude if | Still reads as general ops/HR after rewrite attempts. |

### A2 — `a4d-000014`

| Field | Value |
|-------|--------|
| **Exact text** | Why do careful lenders keep a cushion for deals that might turn sour later? |
| **Current** | `finance` / `F_PARA` / `para-loss-reserve-plain-v1` |
| **Stage-0 cue** | `false` (verified) |
| **Issue** | “Deals … turn sour” is metaphorical; loss-provision reading is easy to miss. |

| Decision | Recommendation |
|----------|----------------|
| **Recommend** | **Rewrite** (same `group_id`) toward plain-language provision/reserve education without Stage-0 tokens (`loan`, `provision`, `credit`, …), closer to sibling `a4d-000013`. |
| Accept if | Human finds the loss-reserve reading unambiguous. |
| Exclude if | Remains too vague / non-finance after one rewrite. |

---

## B. Applied without claiming human audit — `a4d-000052`

| Field | Value |
|-------|--------|
| **Exact text** | Is late payment the same as PAR or something we track live for this branch right now? |
| **Applied label** | `mixed` / `M_EDU_LIVE` |
| **`group_id`** | `mixed-ambig-latepay-live-v1` (**unchanged** — leakage continuity) |
| **`decision_source`** | `agent1_user_review` |
| **Still required** | Independent human `second_review` |

**Challenge note:** Label matches spec (education + live). Category `M_EDU_LIVE` fits better than `M_AMBIG`. Keeping the old `group_id` slug (“ambig”) is slightly misleading; rename only at a versioned group remap with a migration note — **not** done this pass to protect leakage identity.

---

## C. Preserved / metadata-only (no label change)

| ID | Text (abbrev.) | Change |
|----|----------------|--------|
| `a4d-000041` | PAR30 NPL OSS … bake a cake | category → **`O_STUFF`** (still `off_topic`) |
| `a4d-000054` | PAR NPL … haiku | category → **`O_STUFF`** |
| `a4d-000035` | weather in Colombo | category → **`O_WEATHER`** |

---

## D. Broader second-review queue (not soft-flagged, still `requires_human`)

All remaining `F_PARA`, `mixed`, and `O_STUFF` rows. Spot-check especially:

- Cue-less live `M_LIVE_ONLY` with `stage0_cue_hit: false` (`a4d-000048`, `a4d-000049`) — Stage-0 would `off_topic` today; label `mixed` is fail-closed for knowledge.
- Keyword stuffing vs Stage-0 allowlist mismatch (`041`, `054`).

---

## E. Focused expansion proposal (do **not** generate yet)

### E.1 Principles

1. Expand only after human decisions on §A and a pass over §D priorities.  
2. Split by **`group_id`**, never by row (existing safeguard).  
3. **Hold out unseen paraphrases before authoring train-heavy clones:** for each expansion topic, author the eval/adversarial variants **first** or in a sealed list, then expand train groups without those strings.  
4. Pure NLQ (`How many Tier 3…`, window counts) stay in NLQ fixtures / future adversarial file — **never** in domain train labels.  
5. Quality over quota; soft ceilings below are guidance, not vanity targets.

### E.2 Priority expansion targets (seed → next wave)

| Priority | Gap | Current seed | Target after next wave (accepted) | Notes |
|----------|-----|--------------|-------------------------------------|--------|
| P0 | `F_PARA` groups with &lt;3 members | several at 2 | **≥3** paraphrases/group; keep majority `stage0_cue_hit: false` | miss/due, recovery, overdue, loss-reserve |
| P0 | New `F_PARA` topics (cue-less) | 7 groups | **+3–5** new `group_id`s × ≥3 | e.g. collateral plain-language, interest-rate plain, group liability |
| P1 | `O_STUFF` | 2 | **6–10** | vary ask type (food/creative/trivia) + token salad |
| P1 | `M_EDU_LIVE` / `M_EDU_ACTION` | thin | **+6–8** each family | diverse terms + live/action |
| P1 | `M_LIVE_ONLY` | 3 | **+4–6** | include cue-hit and cue-miss variants |
| P2 | `F_PRODUCT` | A3 + GT only | **+A1/A2/A4** (≥2 each group) | education only |
| P2 | `O_WEATHER` / politics / sports | 1 weather | **+2–3** each | keep `O_WEATHER` separate |
| P2 | `F_LK` / `F_EDGE` | 1 each | **+3–5** | typos, Sinhala-English light mix (no PII) |

**Suggested next-wave size:** ~**80–120** new accepted rows (not full 400), then re-run leakage checks — still below first-train floor if quality gaps remain.

### E.3 Reserving unseen paraphrases & adversarial eval

| Pool | How to reserve | Used for |
|------|----------------|----------|
| **Eval paraphrase vault** | Before expanding a `group_id`, write 1–2 held paraphrases into `a4-domain-eval-vault.v1.jsonl` (or mark `pool: eval_vault` on rows with `split` still null). **Do not** put vault text into train groups. At group-split time, vault groups → **test only** or stay out of train/val. | Genuinely unseen wording |
| **Adversarial holdout** | Separate `a4-domain-adversarial.v1.jsonl`, frozen once; includes stuffing, jailbreak+, cue-less finance, mixed traps, **NLQ regressors** (assert domain head must not own them). Never used for C / threshold search. | Stress table |
| **Val vs test** | After vault reservation: group-stratified ~70/15/15 on remaining groups; near-dupe scrub across boundaries. | Threshold on **val** only |

**Challenge to “expand then hold out”:** Holding out after seeing all paraphrases leaks author intent. Prefer **vault-first** for each new topic.

### E.4 Stop conditions before training

- [ ] §A human decisions applied  
- [ ] Second-review sampled on `requires_human` (100% of `F_PARA`/`mixed`/`O_STUFF` preferred)  
- [ ] Eval vault + adversarial file exist and are disjoint from train groups  
- [ ] Leakage checklist green  
- [ ] Still no production wiring

---

## F. Challenge Agent1 (independent)

| Decision | Verdict |
|----------|---------|
| `052` → `mixed`/`M_EDU_LIVE` | **Agree** with label/category; live + education is clear. |
| Claim of “review” closing audit | **Reject** — Agent1/user gate ≠ independent annotator; metadata records `decision_source: agent1_user_review`. |
| Keep `006`/`014` flagged | **Agree**; recommend **rewrite** not silent accept. |
| Keep stuffing | **Agree** — critical Stage-0 vs ML mismatch cases. |
| `O_STUFF` / `O_WEATHER` | **Agree**; improves error slices without a 4th class. |
| NLQ out of train | **Agree**; adversarial-only later. |
| Three-class unchanged | **Agree for now**; evaluate by `category`. |

**Improvement:** When expanding, add optional `ask_intent` note on `O_STUFF` rows (food vs creative) for stratified reports without changing the coarse label.
