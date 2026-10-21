# Human review queue (AI-prioritized — not validation)

**File:** [`HUMAN_REVIEW_QUEUE.json`](./HUMAN_REVIEW_QUEUE.json) — **75** items with `second_review: requires_human`.

**This list is not independent human validation.** It only orders work for a human annotator.

## Priority order used

1. Drafts / soft flags / rewrites  
2. `F_PARA`  
3. `mixed`  
4. `O_STUFF`  
5. Other `requires_human`

See also [`TRAIN_READINESS.md`](./TRAIN_READINESS.md) for draft decisions and train exclusion.
