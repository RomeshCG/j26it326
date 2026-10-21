# A4 domain — Wave 1 + eval vault summary

**Stop point:** Wave 1 complete. No further expansion or training until review.

## Rewrites (Agent1/user text; not human annotation audit)

| ID | New text | Stage-0 cue | `group_id` |
|----|----------|-------------|------------|
| `a4d-000006` | How can a lender tell whether borrowers are paying back money as expected? | **miss** (verified) | `para-collection-quality-v1` |
| `a4d-000014` | Why do lenders set aside money in case some borrowers never repay? | **miss** (verified) | `para-loss-reserve-plain-v1` |

**Challenge:** Both use *borrowers/lenders* (near Stage-0 `borrower`/`lending`). Plural/other forms currently miss; a stemmer or lexicon edit could flip them. Accepted after live regex verify; still `second_review: requires_human`.

## Counts

### Labels pool (`a4-domain-labels.v1.jsonl`)

| Metric | Value |
|--------|-------|
| Total rows | **141** |
| Wave 1 added | **87** |
| finance / off_topic / mixed | **77 / 42 / 22** |
| accepted / draft | **139 / 2** |
| Stage-0 cue hit / miss | **64 / 77** |
| `F_PARA` | all cue-**miss** after correcting `a4d-000134` → `F_PROCESS` |
| Distinct `group_id` | **103** |
| Cross-group near-dupes (Jaccard ≥ 0.85) | **0** |

### Eval vault (`a4-domain-eval-vault.v1.jsonl`) — frozen candidates

| Metric | Value |
|--------|-------|
| Rows | **24** |
| Classes | finance / off_topic / mixed represented |
| Includes | cue-less `F_PARA`, `O_STUFF`, mixed, product, LK, weather/sports/trivia/jailbreak |
| Isolation vs labels (group / exact / Jaccard≥0.85) | **0 issues** |
| Usage bans | train, validation, threshold tuning, model selection, iterative data revision |
| NLQ | **not** in vault (remain in K20 / NLQ verifies) |

## Drafts still open

| ID | Text | Issue |
|----|------|--------|
| `a4d-000104` | List pending Tier 3 items for our Colombo branch right now | NLQ-adjacent live list |
| `a4d-000130` | …book looks dirty because many dues are late | Local slang clarity |

## Human review outstanding

- All `second_review: requires_human` (F_PARA, mixed, O_STUFF, rewrites, drafts)
- Agent1/user decisions ≠ independent annotator audit

## Representative examples

- **F_PARA gap:** rewritten `a4d-000006` / `a4d-000014`
- **Stuffing:** `PAR30 NPL OSS — teach me a 5-minute yoga stretch`
- **Mixed edu+live:** `Explain PAR90 educationally and also show our current PAR90`
- **Product:** `What does Agent 1 do in MicroFlow?`
- **Vault (unseen):** `When neighbors keep delaying what they owe…`

## Limitations

- Wave 1 authored by seed-author tooling — not peer-annotated
- Some product lines overlap knowledge fixtures (intentional education; shared themes OK if `group_id` differs from vault)
- `group_id` on `a4d-000052` still contains historical `ambig` slug
- No train/val/test assignment yet (`split: null`)

## Challenge Agent1

| Item | Position |
|------|----------|
| Approved rewrites | Accept after cue verify; warn near-lexicon *borrower* |
| Vault-first | Agree; vault sealed with usage bans |
| 80–120 wave size | Delivered **87** — stopped rather than pad with templates |
| Categories | `O_STUFF`/`O_WEATHER` working; politics still under `O_SPORTS_NEWS` (1 row) — optional later split |
| Better alt | Prefer vault+adversarial growth before chasing 400-label vanity |
