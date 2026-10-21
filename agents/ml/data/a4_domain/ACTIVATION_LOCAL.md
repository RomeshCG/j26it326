# A4 — Local activation: ML enforce + strict Qwen

**Date:** 2026-10-21  
**Scope:** Local development `backend/.env` only. **Not** shared/production deployment.  
**Approval:** User + Agent1 for local activation.

## Configuration (active)

| Variable | Value |
|----------|--------|
| `A4_DOMAIN_ML_MODE` | `enforce` |
| `A4_DOMAIN_ML_POLICY` | `ml_tau` |
| `A4_DOMAIN_ML_TAU` | `0.45` |
| `A4_DOMAIN_CLF_JSON` | absolute path → `a4-domain-clf-improve-v1-lr_mindf1.json` |
| `A4_KNOWLEDGE_STRICT_PROMPT` | `1` |

Baseline before activation: all A4 flags **unset** (Stage-0 + base prompt). Snapshot: `backend/.a4-ml-strict-activation-rollback.local`.

## Activation proof (live process)

Local `npm run dev` on port **4000** (was free; no shared process disrupted).

API probe (`POST /api/tenant/agent-actions/nlq/query`, geography refuse):

- `domainGate.mode` = **`enforce`**
- `domainGate.policy` = **`ml_tau`**
- `domainGate.tau` = **0.45**
- Finance knowledge responses include **`knowledgeStrictPrompt: true`** and `ollamaModel: qwen2.5:1.5b`

Dotenv self-check (same `.env`): mode=enforce, policy=ml_tau, tau=0.45, strict=true, clf readable.

## E2E results (15 cases)

Auth: ZZ `branch_manager` (read-only NLQ + knowledge; no A1 approve/create).  
Script: `backend/scripts/e2e-a4-ml-strict-activation.ts` → `a4-ml-strict-activation-e2e.json`.

| ID | Expect | Result | Notes |
|----|--------|--------|-------|
| T01 ROI | knowledge | **PASS** | Qwen; gate finance pFin≈0.60; strict |
| T02 loan | knowledge | **PASS** | Qwen; pFin≈0.51; strict |
| T03 PAR30 | knowledge | **FAIL** | Stage-0 would allow; ML `off_topic` pFin≈0.41 → `enforce_ml_refuse` |
| T04 late repayment paraphrase | knowledge | **PASS** | **Rescue** stage0Allow=false → allow |
| T05 progressive paraphrase | knowledge | **PASS** | **Rescue** stage0Allow=false → allow |
| T06 Graduated Trust | grounded | **PASS** | No Ollama; grounded card |
| T07–T11 off-topic | unsupported | **PASS** | ML refuse; no Qwen |
| T12 mixed | unsupported | **PASS** | hardRefuse path (no gate meta) |
| T13 stuffing | unsupported | **PASS** | Stage-0 true but ML refuse |
| T14 injection | unsupported | **PASS** | ML refuse |
| T15 pending Tier 3 count | nlq | **PASS** | Read-only count; domain gate not on NLQ path |

**Score: 14/15 PASS.** Enforce + strict **genuinely active**.

### Failures / severity

| Issue | Severity | Action |
|-------|----------|--------|
| T03 PAR30 false reject (ML pred off_topic / pFin&lt;τ) | **Medium** — demo risk on common term | Do not retune mid-demo; prefer “What is a loan?” / ROI paraphrases |
| Residual FR class (same family as eval C08) | Known limitation | Documented; no threshold change this task |
| Repeat-limit | None observed on this run | Off-topic blocked before Ollama |

No rollback triggered (no serious outage / NLQ break / auth break).

## Regression verifies

| Suite | Result |
|-------|--------|
| `verify:a4-knowledge` | 226/0 |
| `verify:a4-domain-clf` | 238/0 |
| `verify:a4-domain-shadow` | PASS |
| `verify:a4-nlq` | 99/0 |

## Challenge Agent1

- `.env` alone is insufficient — proved via **live** `domainGate` + `knowledgeStrictPrompt` on the running process.
- Combined stack is **not** production-ready: T03 shows Stage-0∩ML can **increase** FR on legitimate finance.
- Suitable for a **controlled local demo** with curated questions; not a blanket “always better than Stage-0” claim.

## Rollback

```powershell
# Edit backend/.env:
A4_DOMAIN_ML_MODE=off
# remove or:
A4_KNOWLEDGE_STRICT_PROMPT=0
# optionally remove A4_DOMAIN_ML_POLICY / A4_DOMAIN_ML_TAU / A4_DOMAIN_CLF_JSON

# Restart local backend (tsx watch picks up .env on restart)
# Confirm: refuse responses omit mode=enforce; knowledge omits knowledgeStrictPrompt
```

## Demo suitability

**YES — controlled local demonstration** with scripted questions (ROI, loan, paraphrases, off-topic, NLQ count).  
**NO — shared/production** without further soak and product sign-off on FR risk (PAR30-class).
