# Human review — Batch 4 (18 items) — **USER APPLIED**

**Status:** Applied to `a4-domain-labels.v1.jsonl` after explicit user approval (2026-10-20).

**Provenance:** `human_review.source = user_explicit_batch4` — **not** independent peer review.

**Script:** [`_apply_batch4.mjs`](./_apply_batch4.mjs) · report [`_batch4_apply_report.json`](./_batch4_apply_report.json)

---

## Decisions

| Action | IDs |
|--------|-----|
| **Rewrite** (keep `finance`) | `a4d-000066`, `a4d-000071`, `a4d-000075` |
| **Approve unchanged** | `063`–`065`, `067`–`070`, `072`–`074`, `131`–`133`, `136`, `137` |

### Rewrites (Stage-0 cue-miss verified → `F_PARA` gap exemplars)

| ID | Approved text | Cue |
|----|---------------|-----|
| `a4d-000066` | Why does someone who lends money expect to receive more than they originally gave? | miss (`lends` ≠ `lending`) |
| `a4d-000071` | How can staff recognize early signs that customers may struggle to make their payments? | miss (`payments` ≠ `repayment`) |
| `a4d-000075` | Why does a small shop need money readily available to cover everyday expenses? | miss |

### Unchanged labels

- `136` → `mixed` / `M_EDU_ACTION`
- `137` → `off_topic` / `O_STUFF`
- Remaining F_PARA rows → `finance` / `F_PARA`

---

## Post-apply totals

| Metric | Value |
|--------|-------|
| Human-reviewed (batches 1–4) | **74** (20+18+18+18) |
| Still `requires_human` | **2** (`104` excluded draft; `134` soft accepted F_PROCESS) |
| Classes | finance **77** / off_topic **41** / mixed **23** |
| Train-eligible accepted | **140** |
| Cross-group near-dupes | **0** |
| `F_PARA` with cue-hit | **0** |

Priority P1 queue cleared. Non-priority categories may still lack `human_review` (author-accepted only).
