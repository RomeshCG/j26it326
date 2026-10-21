# A4 domain — shadow mode verification

**Date:** 2026-10-20
**Mode tested:** `A4_DOMAIN_ML_MODE=shadow` (enforce not used)
**Scope:** Same `resolveA4KnowledgeDomainGate` as `handleNlqQuery`; no HTTP server, DB, or Ollama.

## Artifact

- Path: `agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.json`
- Load: **4.02 ms**
- Spec: `a4-domain-clf-improve-v1-lr_mindf1`

## Noninterference

- Shadow `allowKnowledge` === Stage-0 / mode=off on **22/22** cases
- Reason always `shadow_stage0`
- Telemetry excludes raw question text

## Latency (per question, shadow gate + predict)

| mean | p50 | p95 |
|------|-----|-----|
| 0.356 ms | 0.212 ms | 0.780 ms |

## Stage-0 vs ML vs expected (knowledge path; hardRefuse excluded from gold compare)

| ID | Slice | Expect | Stage-0 | ML pred | pFin | ml_tau@0.45 | Shadow allow (=S0) | Enforce would |
|----|-------|--------|---------|---------|------|-------------|-------------------|---------------|
| S01 | basic_finance | finance | false | finance | 0.714 | true | false | true |
| S02 | basic_finance | finance | true | finance | 0.507 | true | true | true |
| S03 | basic_finance | finance | true | finance | 0.775 | true | true | true |
| S04 | basic_finance | finance | false | finance | 0.650 | true | false | true |
| S05 | paraphrase | finance | false | finance | 0.708 | true | false | true |
| S06 | paraphrase | finance | false | finance | 0.609 | true | false | true |
| S07 | paraphrase | finance | false | finance | 0.705 | true | false | true |
| S08 | mfi | finance | true | finance | 0.551 | true | true | true |
| S09 | mfi | finance | true | finance | 0.404 | false | true | false |
| S10 | mfi | finance | true | finance | 0.733 | true | true | true |
| S11 | banking | finance | false | finance | 0.629 | true | false | true |
| S12 | geography | off_topic | false | off_topic | 0.354 | false | false | false |
| S13 | aviation | off_topic | false | off_topic | 0.366 | false | false | false |
| S14 | science | off_topic | false | off_topic | 0.255 | false | false | false |
| S15 | coding | off_topic | false | off_topic | 0.212 | false | false | false |
| S16 | unrelated | off_topic | false | off_topic | 0.218 | false | false | false |
| S17 | unrelated | off_topic | false | off_topic | 0.357 | false | false | false |
| S18 | mixed | mixed | true | mixed | 0.068 | false | true | false |
| S19 | mixed | mixed | true | mixed | 0.130 | false | true | false |
| S20 | stuffing | off_topic | true | off_topic | 0.165 | false | true | false |
| S21 | stuffing | off_topic | true | off_topic | 0.180 | false | true | false |
| S22 | stuffing | off_topic | true | off_topic | 0.175 | false | true | false |

Rescues if enforce: S01, S04, S05, S06, S07, S11
S0 false-allows ML would block: S20

## Verdict

**GO** for continued shadow observation / next-phase planning. **NO-GO** for enablement of `enforce` without separate approval.
