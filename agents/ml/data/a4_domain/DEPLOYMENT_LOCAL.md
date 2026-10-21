# A4 — Deployed to MicroFlow (local stack)

**Date:** 2026-10-21  
**Approval:** User explicitly approved deploying the tested ML + strict configuration to the actual MicroFlow system.

## Target environment

| Item | Value |
|------|--------|
| Kind | **Local development** (not Docker, not remote PaaS) |
| Backend | `http://localhost:4000` — `backend/` Node (`tsx watch` / `npm run dev`) |
| Frontend | `http://localhost:5173` — Vite; `VITE_API_URL=http://localhost:4000` |
| Config file | `backend/.env` (gitignored) |
| Artifact | `agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.json` (**gitignored**; present on this machine) |
| Shared/cloud | **Not deployed** — no Railway/Render/Fly change |

There is no separate shared MicroFlow API in this repo workflow: the frontend default and `.env` both target **this local backend**.

## Active flags (unchanged from tested config)

```
A4_DOMAIN_ML_MODE=enforce
A4_DOMAIN_ML_POLICY=ml_tau
A4_DOMAIN_ML_TAU=0.45
A4_DOMAIN_CLF_JSON=<absolute path to improve-v1-lr_mindf1.json>
A4_KNOWLEDGE_STRICT_PROMPT=1
```

Backup of A4/Ollama/PORT/NODE_ENV lines: `backend/.a4-deploy-env-backup.local`  
Prior rollback notes: `backend/.a4-ml-strict-activation-rollback.local`

## Process load proof

Running backend returned live `domainGate.mode=enforce` and `knowledgeStrictPrompt:true` on knowledge answers. **No shared-service restart** was required (local process already loaded `.env` from prior activation).

## Deploy verification (API) — 11/11 PASS

Script: `backend/scripts/deploy-verify-a4-ml-strict.ts` → `a4-deploy-verify.json`

| ID | Check | Result |
|----|--------|--------|
| D01 | ROI → knowledge | PASS (Qwen, strict, enforce) |
| D02 | loan → knowledge | PASS |
| D03 | finance paraphrase → knowledge | PASS (**Stage-0 rescue**) |
| D04 | Graduated Trust → grounded | PASS |
| D05–D08 | aviation/geo/science/programming → refuse | PASS |
| D09 | mixed → refuse | PASS |
| D10 | keyword stuffing → refuse | PASS |
| D11 | NLQ pending count | PASS (read-only) |

**Known limitation (unchanged):** PAR30-class phrases can still false-reject under `ml_tau`@0.45. Threshold **not** lowered.

## Frontend wiring

- `frontend/.env` created from example with `VITE_API_URL="http://localhost:4000"`.
- Frontend responds `200` at `http://localhost:5173/`.
- API client: `frontend/src/lib/api.js` → same base URL.

## Rollback

```powershell
# backend/.env
A4_DOMAIN_ML_MODE=off
A4_KNOWLEDGE_STRICT_PROMPT=0
# restart local: stop npm run dev in backend, start again
```

Confirm refuse responses no longer show `domainGate.mode=enforce` and knowledge omits `knowledgeStrictPrompt`.

## Challenge Agent1

- “Deploy to actual MicroFlow” here means the **local** frontend↔backend pair, not a cloud replica (none configured in-repo).
- Artifact must exist on disk for any host; gitignore means CI/cloud copies need an explicit artifact step before enforce.
- Flags sit only on the generative knowledge path after hardRefuse / NLQ / grounded — RBAC, tenant isolation, A1/A2/A3, GT dispatch unchanged by this deploy.
- Local 11/11 ≠ production readiness.

## Status

**DEPLOYMENT COMPLETE** for the local MicroFlow stack. Shared/cloud promotion **not** done.
