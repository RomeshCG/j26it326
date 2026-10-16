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
| ZZ seed safety | `verify:zz-seed-safety` |
| Safe API errors | `verify:safe-api-errors` |
| Graduated Trust | `verify:graduated-trust` |

## Outputs

Written under `backend/eval-results/` (gitignored except `.keep`):

- `offline-eval-latest.json` / `.md`
- Timestamped copies of the same report

JSON does **not** embed raw suite console logs (avoids accidental secret capture).

## Excluded (later milestones)

- A3 Isolation Forest train/eval metrics
- A1 SoD/hash-gate fixtures (later)
- GT labelled fixture pack (later)
- A2 dedupe fixtures (later extension)
- Live ZZ E2E
- Live Ollama A4 gold-set evaluation
- DB-backed verifies (auth-rbac, provisioning, stub-api, …)

A1 fixture oracle: `backend/eval-fixtures/a1/SPEC.md`.  
A2 fixture oracle: `backend/eval-fixtures/a2/SPEC.md`.
