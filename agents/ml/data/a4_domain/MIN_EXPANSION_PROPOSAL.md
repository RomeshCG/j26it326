# Smallest dataset expansion (after Batch 1+ human review) — proposal only

**Do not generate these rows until you approve expansion.** Split-v0 will be **recomputed** after expansion (vault + test isolation preserved).

## Goals

1. Meet spec **accepted-row floor ≥ 180** (currently **139** train-eligible → need **≥41** net new **accepted** rows).  
2. Improve **mixed** validation coverage after re-split (today val has only **3** mixed rows / **3** mixed groups in split-v0).

## Minimum package (recommended)

| Bucket | New accepted rows (min) | New `group_id`s (min) | Rationale |
|--------|-------------------------|------------------------|-----------|
| `M_EDU_LIVE` | 12 | 12 (1 each) or 6×2 | Raises mixed group count for val/test strata |
| `M_EDU_ACTION` | 6 | 6 | Thin today |
| `M_LIVE_ONLY` | 6 | 6 | Include cue-hit and cue-miss variants |
| `F_PARA` (cue-miss) | 12 | 4 groups × 3 | Protect Stage-0 gap; keep majority cue-miss |
| `O_STUFF` | 5 | 5 | Hard negatives for false-allow |
| **Total** | **~41** | | Hits 180 if all accepted |

**Optional +10–15** only if Batch 1 rejects many current rows (replace losses).

## Mixed validation target after re-split

Aim for **≥8 mixed groups** in the eventual validation stratum (≈ **≥8–12 mixed val rows**), via:

- Adding singleton mixed groups (helps stratified group split), and  
- Re-running `a4-domain-split-v1.json` with same hash method after expansion.

Keep **eval vault (24)** untouched and excluded. Keep **test_reserved** as a fresh holdout after re-split (do not reuse split-v0 test groups blindly if groups change).

## Out of scope for this minimum

- Full 600–800 vanity corpus  
- Training / threshold tuning  
- Touching vault for selection  
- Pure NLQ count strings in domain train (K20/K24 stay in NLQ/knowledge fixtures)

## Sequencing

1. You finish **Batch 1** (and ideally Batches 2–3 for P1).  
2. Apply your decisions to labels (`human_approved` metadata).  
3. Approve this minimum expansion → author ~41 rows.  
4. Recompute group split → then reconsider smoke vs full train.
