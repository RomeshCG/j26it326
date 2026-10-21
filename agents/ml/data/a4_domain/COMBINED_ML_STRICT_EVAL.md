# A4 — Combined ML enforce + strict Qwen eval

**Date:** 2026-10-20
**Arms:** `stage0_base` (ML off, base prompt) vs `ml_strict` (enforce ml_tau@0.45 + strict prompt)
**Routing:** hardRefuse → grounded MicroFlow → domain gate → optional knowledge Ollama (same helpers as production). No DB/NLQ dispatch. Isolated process env only.

## Fail-closed / path isolation

**Finding (eval bug → gate fix):** first combined run reported `allowKnowledge: true` for a missing artifact because the gate took `A4_DOMAIN_ML_MODE` from `options.env` but loaded the clf from `process.env.A4_DOMAIN_CLF_JSON` (still pointing at the good file). Gate now honors `A4_DOMAIN_CLF_JSON` from the same env snapshot. Re-probe after fix:

```json
{
  "enforceMissingArtifact_allowKnowledge": false,
  "enforceMissingArtifact_reason": "enforce_fail_closed",
  "enforceMissingArtifact_failClosed": true,
  "nlqCountCueStillDetected": true,
  "cookingHardRefuseUnaffected": true,
  "note": "Domain gate fail-closed does not run inside NLQ count branch; hardRefuse still first. Missing clf JSON → enforce_fail_closed on knowledge path only."
}
```

## Repeat-limit re-probe (strict prompt, no ML)

```json
{
  "note": "Isolated strict-prompt re-probe of prior P10/P13 offenders; no ML gate",
  "results": [
    {
      "q": "How do you write a for-loop over a list in Python?",
      "ok": true,
      "ms": 20832,
      "contentLen": 678,
      "contentHead": "{\n  \"in_scope\": true,\n  \"answer\": \"In Python, you can write a for-loop over a li"
    },
    {
      "q": "Explain progressive lending, then tell me who won the last C",
      "ok": true,
      "ms": 9752,
      "contentLen": 904,
      "contentHead": "{\n  \"in_scope\": true,\n  \"answer\": \"Progressive lending is a lending strategy whe"
    }
  ]
}
```

## End-to-end metrics

| Metric | Stage-0 + base | ML enforce + strict | Δ |
|--------|----------------|---------------------|---|
| Correct | 14/18 | 17/18 | 3 |
| False accepts | 0 | 0 | 0 |
| False rejects | 4 | 1 | -3 |
| Finance/product answered | 5/9 | 8/9 | |
| Reached Ollama | 5 | 7 | |
| Repeat-limit errors | 0 | 0 | |
| Timeouts / errors | 0/0 | 0/0 | |
| Latency mean/p50/p95 (ms) | 2210/0/12513 | 2714/14/10947 | |
| Rescued Stage-0 misses | — | C04, C05, C06, C07 | |

## Per-case endAllow

| ID | Expect | Slice | A allow | B allow | A ollama | B ollama | B ml | B pFin |
|----|--------|-------|---------|---------|----------|----------|------|--------|
| C01 | finance | finance | true | true | true | true | finance | 0.507 |
| C02 | finance | finance | true | true | true | true | finance | 0.551 |
| C03 | finance | finance | true | true | true | true | finance | 0.775 |
| C04 | finance | rescue | false | true | false | true | finance | 0.708 |
| C05 | finance | rescue | false | true | false | true | finance | 0.705 |
| C06 | finance | rescue | false | true | false | true | finance | 0.714 |
| C07 | finance | rescue | false | true | false | true | finance | 0.629 |
| C08 | finance | finance | true | false | true | false | finance | 0.404 |
| C09 | product | microflow | true | true | false | false | null | — |
| C10 | off_topic | unrelated | false | false | false | false | off_topic | 0.354 |
| C11 | off_topic | unrelated | false | false | false | false | off_topic | 0.366 |
| C12 | off_topic | unrelated | false | false | false | false | off_topic | 0.255 |
| C13 | off_topic | unrelated | false | false | false | false | off_topic | 0.212 |
| C14 | mixed | mixed | false | false | false | false | null | — |
| C15 | mixed | mixed | false | false | false | false | null | — |
| C16 | off_topic | stuffing | false | false | true | false | off_topic | 0.165 |
| C17 | off_topic | stuffing | false | false | false | false | null | — |
| C18 | off_topic | injection | false | false | false | false | off_topic | 0.183 |

## Challenge Agent1

Two imperfect filters can correlate (shared template sensitivity) or stack FR (ML τ rejects borderline finance Stage-0 allowed). Combined win must beat Stage-0+base on FA without large FR/latency/repeat regressions.

Correlated both-wrong: none
New FR vs baseline: C08
New FA vs baseline: none

## Verdict

**NO-GO for production activation of both flags.** Combined arm wins on this synthetic set (correct 17/18 vs 14/18; FA=0; FR 4→1 with Stage-0 rescues C04–C07) but:

- Residual FR **C08** (`pred=finance`, `pFin=0.404 < 0.45`) — Stage-0 would answer; ML stacks a false reject.
- Strict-prompt alone still showed intermittent repeat-limit HTTP 500s (P10/P13); combined path avoided them here because ML blocked the worst off-topic before Ollama — not a guarantee under enforce+strict on allowed finance.
- Two imperfect filters are **not** proven complementary in general; correlated mistakes remain a risk on unseen paraphrases.
- **CONDITIONAL GO** only for optional local `shadow` soak (ML log-only) and isolated A/B — not for default-on `enforce` or `A4_KNOWLEDGE_STRICT_PROMPT`.

**Production flags remain OFF.** This eval did not enable them in `.env` or deployment.
