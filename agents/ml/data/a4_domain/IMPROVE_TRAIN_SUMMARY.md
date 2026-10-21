# A4 domain classifier — improve-v1 (post–smoke expansion)

**Date:** 2026-10-20  
**Status:** Development candidate only. **No-go for A4 production integration.**  
**Baseline (separate):** [`SMOKE_TRAIN_SUMMARY.md`](./SMOKE_TRAIN_SUMMARY.md) — do not merge smoke numbers into research claims.

---

## Diagnosis (smoke-v0)

| Failure mode | Evidence |
|--------------|----------|
| Off-topic recall **0.33** | Val politics / chess / weather → `finance` |
| Finance-default on short GK | Probes: aviation, France capital → finance |
| Brittle cue finance | Probe “What is a loan?” → off_topic |
| Under-coverage | Basic finance thin; almost no geo/aviation/history/programming/health |
| Template collision | `What is X?` shared by `F_TERM` and `O_TRIVIA` |

---

## Challenge Agent1 — “more data alone”

**Partial agree.** Wave-2 diversity was necessary but **not sufficient**:

1. **`min_df=2`** on ~94–156 docs drops rare distinctive off-topic tokens → ablation `lr_mindf1` beats same data with `min_df=2`.
2. **Class imbalance / finance prior** — still 5 false-accepts on expand val; travel/visa and politics remain weak.
3. **Three-class `mixed`** — compound edu+live strings confuse with pure finance; support still small (val mixed=5).
4. **LinearSVC+calibration** — slightly higher full-val macro-F1 but worse smoke-group off-topic recall and ~2× latency; **not required** if LR+`min_df=1` is kept.

**Better lightweight default:** TF-IDF word+char + **LogisticRegression**, **`min_df=1`**, C=1.0, balanced, seed 42.

---

## Expansion (wave 2)

| | |
|--|--|
| Script | [`_author_wave2_expand.mjs`](./_author_wave2_expand.mjs) |
| New rows / groups | **+78 / +39** (author-labeled, not peer-audited) |
| Eligible total | **218** (above soft floor 180) |
| Classes | finance **107** / off_topic **81** / mixed **30** |
| Split | [`a4-domain-split-improve-v1.json`](./a4-domain-split-improve-v1.json) |
| Test + vault | **Frozen** — unused for train / τ / selection |
| New groups | train **31** + val **8** only |

Content themes: basic money/loan/debt/savings/interest/banking/budget/inflation/insurance/accounting; MFI progressive/joint liability; MicroFlow education; geo/aviation/science/history; programming; travel; health; entertainment; sports; stuffing; mixed edu+live/action/offtopic.

Probe strings were **not** copied into train.

---

## Results (validation only)

### Preferred candidate: `improve-v1` + `lr_mindf1`

Train **156** / val **39** · fit ~0.06 s · latency ~**1.0 ms**

| Metric | Smoke-v0 (val n=23) | Improve full val (n=39) | Improve on **smoke groups only** (n=23) |
|--------|---------------------|-------------------------|----------------------------------------|
| Accuracy | 0.696 | **0.821** | **0.826** |
| Macro-F1 | 0.600 | **0.799** | **0.779** |
| Finance recall | 0.86 | **0.90** | 0.86 |
| Off-topic recall | **0.33** | **0.71** | **0.83** |
| Mixed F1 | 0.50 | **0.73** | 0.57 |
| False-accept / reject | 4 / 2 | 5 / 2 | **2 / 2** |

Confusion (full val, gold→pred finance/off_topic/mixed):

```
[[18, 0, 2],
 [ 4,10, 0],
 [ 1, 0, 4]]
```

### Ablations (same split; selection on val only)

| Variant | Val macro-F1 | Smoke-group macro-F1 | Off-topic R (full) | Notes |
|---------|--------------|----------------------|--------------------|-------|
| `lr_c1` (min_df=2) | 0.779 | 0.733 | 0.71 | “What is a loan?” still off_topic |
| **`lr_mindf1`** | **0.799** | **0.779** | 0.71 | Best LR; probes OK |
| `linearsvc` | **0.812** | 0.778 | 0.71 | Best full F1; ~2 ms; keep as optional |

### Probes (`lr_mindf1`)

| Probe | Pred |
|-------|------|
| What is money? | finance |
| What is a loan? | **finance** (was off_topic on smoke) |
| Airplanes / France capital / photosynthesis | **off_topic** (were finance on smoke) |
| PAR30 microfinance | finance |
| Pizza stuffing | off_topic |

---

## Remaining failure modes (`lr_mindf1`)

| ID | Gold → pred | Text (abbrev.) |
|----|-------------|----------------|
| 018 | finance → mixed | Briefly define PAR30 as used by MFIs |
| 124 | finance → mixed | Explain KYC briefly for microfinance staff |
| 097 | mixed → finance | Liquidity edu + our ratio today |
| 111 | off_topic → finance | Political headline Sri Lanka |
| 182 | off_topic → finance | Why objects fall toward Earth… |
| 193–194 | off_topic → finance | Hiking pack / Japan visa |

**Interpretation:** Short educational finance still drifts to `mixed`; live+edu compounds look like finance; politics/travel/gravity lack enough contrasting negatives or share “why/what” scaffolding with finance.

---

## Go / no-go

| Decision | **NO-GO for production A4 routing** |
|----------|-------------------------------------|
| Why | Val still small; wave-2 labels not human-audited; false-accepts remain; Stage-0 must stay outer gate |
| Why continue | Clear lift vs smoke (macro-F1 0.60 → ~0.78–0.80 on comparable groups); off-topic recall recovered; probes no longer finance-default |
| Next if improving | More politics/travel/science negatives; optional finance confidence τ on val; human-review wave-2; **then** one-shot frozen test/vault — never for selection |
| Model change? | **Not required** — keep TF-IDF+LR `min_df=1`; LinearSVC optional |

Artifacts: `agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.*` (gitignored).
