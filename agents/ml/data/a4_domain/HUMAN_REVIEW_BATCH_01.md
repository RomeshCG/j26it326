# Human review — Batch 1 — **APPLIED**

**Reviewer:** chinookz (explicit user approval of Agent1 recommendations)  
**Applied:** 2026-10-20  
**Provenance:** `review.human_review = { batch: 1, reviewer: "chinookz", source: "user_explicit_batch1" }`  
**Not claimed:** Batches 2+ human-reviewed. Automated Stage-0/dupe checks ≠ human label audit for other rows.

## Decisions applied (20/20)

| ID | Action | Result |
|----|--------|--------|
| `a4d-000130` | **Rewrite** | `finance`/`F_PARA` — “What does it mean when a lender has many customers who keep paying late?” · Stage-0 **miss** |
| `a4d-000061` | **Rewrite** + **metadata fix** | Wording/`finance` kept; category later **`F_PROCESS`** (not Stage-0-gap `F_PARA`); Stage-0 **HIT**; `stage0_gap_exemplar: false` |
| `a4d-000056` | **Rewrite** | `finance`/`F_PARA` — “Why is it a problem when many households keep missing their payment dates?” · Stage-0 **miss** |
| `a4d-000105` | **Relabel** | `mixed` / **`M_EDU_OFFTOPIC`** (was `off_topic`/`O_STUFF`) |
| `a4d-000043` | **Recategory** | `mixed` / **`M_LIVE_ONLY`** (was `M_EDU_LIVE`) |
| `006` `014` `001` `004` `015` `041` `054` `108` `042` `047` `048` `052` `096` `100` `045` | **Approve unchanged** | metadata `user_batch1_approved` |

## Checks after apply

- Cross-group near-dupes (Jaccard ≥ 0.85): **none**  
- Batch 1 rows marked human-reviewed: **20**  
- Still `requires_human` (other rows): **56**  
- Train-eligible accepted: **140** (excluded: `a4d-000104` only)

## Policy notes (not silently “fixed”)

1. **`a4d-000061`:** User-approved text contains `borrower` → Stage-0 allowlist **hit**, so this row is **not** a Stage-0 gap example despite `F_PARA`. Kept as approved; future rewrite could restore cue-miss if desired.  
2. **`a4d-000043`:** `M_LIVE_ONLY` + “what is our institution PAR30” tensions with Node `mixed_intent` history; top-level `mixed` remains correct.  
3. **`M_EDU_OFFTOPIC`:** Spec + decision tree updated; distinguishes edu+unrelated from pure `O_STUFF`.

## Next

Batch 2 (remaining F_PARA / mixed / O_STUFF) — **not started**. No train / no expansion this turn.
