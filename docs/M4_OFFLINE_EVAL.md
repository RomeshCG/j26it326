# M4 Offline Evaluation Runner (Stage 1 Slice 1)

## Purpose

One command runs existing **offline** M4 verification scripts and writes a
machine-readable summary.

**These results are functional regression checks only.** They are **not** AI
research accuracy metrics (no A3 P/R/F1, no A4 intent confusion matrix, no live
ZZ governance rates).

## Prerequisites

- Node.js + backend dependencies already installed (`backend/node_modules`)
- Run from a clone of this repository (Git SHA is recorded when available)
- No database, Ollama, Python agents service, or credentials required

## Command

```powershell
cd backend
npm run eval:offline
```

Exit code is **nonzero** if any required suite fails.

## Suites included

| Suite | npm script |
|-------|------------|
| A1 compliance | `verify:a1-compliance` |
| A1 fixtures (rule agreement) | `verify:a1-fixtures` |
| A1 fixture guards | `verify:a1-fixture-guards` |
| A2 budget | `verify:a2-budget` |
| A2 fixtures (rule agreement) | `verify:a2-fixtures` |
| A2 fixture guards | `verify:a2-fixture-guards` |
| A4 NLQ (offline) | `verify:a4-nlq` |
| A4 intent gold corpus (structure) | `verify:a4-intent-corpus` |
| A4 lexical-gate diagnostic (offline) | `verify:a4-gate-diagnostic` |
| ZZ seed safety | `verify:zz-seed-safety` |
| Safe API errors | `verify:safe-api-errors` |
| Graduated Trust | `verify:graduated-trust` |
| GT fixtures (rule agreement) | `verify:gt-fixtures` |
| GT fixture guards | `verify:gt-fixture-guards` |

## Outputs

Written under `backend/eval-results/` (gitignored except `.keep`):

- `offline-eval-latest.json` / `.md`
- Timestamped copies of the same report

JSON does **not** embed raw suite console logs (avoids accidental secret capture).

## Excluded from `eval:offline` (separate tracks)

- A3 Isolation Forest train/eval metrics (sanitized summary tracked separately)
- A2 dedupe fixtures (later extension)
- Live ZZ E2E
- Live Ollama A4 gold-set intent accuracy (not part of offline suites; see research summary below)
- DB-backed verifies (auth-rbac, provisioning, stub-api, …)

A1 fixture oracle: `backend/eval-fixtures/a1/SPEC.md`.  
A2 fixture oracle: `backend/eval-fixtures/a2/SPEC.md`.  
GT fixture oracle: `backend/eval-fixtures/gt/SPEC.md` (includes A1 SoD/hash approve-gate scenarios as pure governance checks).  
A4 intent gold / capability oracle: `backend/eval-fixtures/a4/SPEC.md` (corpus validation ≠ model accuracy).  
A4 gate diagnostic JSON (gitignored): `backend/eval-results/a4-gate-diagnostic-latest.json` — lexical eligibility only, not Ollama accuracy.

## A4 live Ollama baseline (research summary)

Sanitized headline metrics from the authorized single live baseline (no question text, no endpoints):  
[`docs/M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json`](./M4_A4_INTENT_OLLAMA_BASELINE_SUMMARY.json)

Full per-question artifact remains gitignored:  
`backend/eval-results/a4-intent-ollama-2026-10-16T16-42-27-284Z.json`  
Runner: `npm run eval:a4-intent-ollama` (homelab Ollama; not invoked by `eval:offline`).
