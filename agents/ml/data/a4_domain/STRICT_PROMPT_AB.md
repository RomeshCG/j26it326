# A4 knowledge — strict prompt A/B (live Qwen)

**Date:** 2026-10-20
**Model:** configured `OLLAMA_MODEL` (qwen2.5 family expected)
**Mode:** prompt-only `ollamaChatJson` with separate system/user; **ML enforce OFF**; Stage-0/ML not applied to model calls

## Structure (offline)

```json
{
  "flagDefaultOff": true,
  "baseHasJsonContract": true,
  "strictHasRules": true,
  "strictHasMicroFlow": true,
  "strictHasGlossary": true,
  "baseLacksStrictBlock": true,
  "nlqUntouched": true,
  "rolesSeparate": true
}
```

## Prompt-only metrics

| Metric | Base | Strict | Δ (strict−base) |
|--------|------|--------|-----------------|
| Correct allow/refuse | 10/16 | 14/16 | 4 |
| Finance answered (ok) | 5/6 | 6/6 | 1 |
| False accepts | 5 | 2 | -3 |
| False rejects | 1 | 0 | -1 |
| JSON usable (ok/unsupported) | 16 | 14 | -2 |
| Timeouts | 0 | 0 | |
| Errors | 0 | 2 | |
| Latency mean / p50 / p95 (ms) | 7663 / 8921 / 14414 | 6120 / 7015 / 14183 | |

## Per-case (model allow = Node parse status ok)

| ID | Expect | Base allow | Strict allow | Stage-0 | hardRefuse | ML τ0.45 would |
|----|--------|------------|--------------|---------|------------|----------------|
| P01 | finance | true | true | true | null | true |
| P02 | finance | true | true | true | null | true |
| P03 | finance | true | true | true | null | true |
| P04 | finance | false | true | false | null | true |
| P05 | finance | true | true | false | null | true |
| P06 | finance | true | true | true | null | false |
| P07 | off_topic | true | true | false | null | false |
| P08 | off_topic | true | false | false | null | false |
| P09 | off_topic | true | true | false | null | false |
| P10 | off_topic | true | false | false | null | false |
| P11 | off_topic | true | false | false | null | false |
| P12 | mixed | false | false | true | mixed_intent | false |
| P13 | mixed | false | false | true | off_topic | false |
| P14 | off_topic | false | false | true | null | false |
| P15 | off_topic | false | false | true | off_topic | false |
| P16 | off_topic | false | false | false | null | false |

## Challenge Agent1

Base prompt already forbids off-topic/mixed; strict block is additive. Live delta is the only evidence of improvement.

Quality notes base: P05: weak finance lexical content
Quality notes strict: P05: weak finance lexical content

## Distinguishing filters

- **Prompt-only** (table above): raw Qwen `in_scope` / Node parse — Stage-0 and ML **did not** filter these calls.
- **Stage-0** would still refuse many model false accepts (e.g. P07–P11 geography/aviation/science/coding/film) before Ollama in production `mode=off`.
- **ML τ=0.45** (shadow `enforceWould`) aligns with refusing those off-topics; would also rescue P04/P05 paraphrases Stage-0 misses.
- Remaining **prompt-only FAs under strict:** P07 (Portugal), P09 (photosynthesis) — stricter text did **not** stop these.
- Strict arm had **2× HTTP 500** (`token repeat limit`) on P10/P13 — counted as non-allow; hurts JSON reliability vs base (16/16 → 14/16 usable).

## Challenge Agent1 (outcome)

The base prompt already says refuse off-topic/mixed. Strict rules are largely **reinforcement**, not a new contract. Live evidence: **partial** real improvement (FA 5→2, FR 1→0, finance 5/6→6/6) but **not** elimination of open-world FAs, plus **new instability** (repeat-limit aborts). Do not treat “more instructions” as sufficient domain enforcement.

## Verdict

| Action | Recommendation |
|--------|----------------|
| Keep `A4_KNOWLEDGE_STRICT_PROMPT` flag | **GO** (default **off**) |
| Turn strict **on by default** | **NO-GO** until more soak / fewer FAs / no repeat-limit regressions |
| Rely on prompt instead of Stage-0/ML | **NO-GO** |

Raw: `agents/artifacts/a4_domain/a4-knowledge-prompt-ab.json` (gitignored artifacts dir).
