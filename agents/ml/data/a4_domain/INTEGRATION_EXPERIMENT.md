# A4 domain ML — integration experiment

**Date:** 2026-10-21  
**Status:** Implemented behind flags.  
**Local MicroFlow stack (deployed 2026-10-21):** frontend `localhost:5173` → backend `localhost:4000` with `enforce` + `ml_tau`@0.45 + strict + improve-v1 JSON. Evidence: [`DEPLOYMENT_LOCAL.md`](./DEPLOYMENT_LOCAL.md).  
**Shared/cloud production:** still **not** promoted.

---

## What changed

| Piece | Detail |
|-------|--------|
| JSON artifact | `agents/artifacts/a4_domain/a4-domain-clf-improve-v1-lr_mindf1.json` (from joblib) |
| Node inference | `backend/src/lib/a4-domain-clf.ts` |
| Gate | `backend/src/lib/a4-domain-gate.ts` — modes `off` \| `shadow` \| `enforce` |
| Route | `handleNlqQuery` generative branch uses gate (after hardRefuse / NLQ / grounded) |
| Strict prompt | `A4_KNOWLEDGE_STRICT_PROMPT=1` appends rules to knowledge **system** message only |
| Verify | `npm run verify:a4-domain-clf` |

## Challenge Agent1 → final policy

Stage-0-then-ML-filter **rejected**. Enforce default policy is **`ml_tau`**: allow knowledge iff `pred==finance && pFinance >= τ` with **τ=0.45** (val-only).

| Policy (val n=39) | FA | FR | Finance recall | Rescued Stage-0 misses |
|-------------------|----|----|----------------|------------------------|
| Stage-0 only | 7 | 12 | 0.40 | 0 |
| **ml_tau @ 0.45** | **3** | **4** | **0.80** | **11** |
| hybrid_v1 rescue0.45/veto0.50 | 7 | 1 | 0.95 | 11 |

`hybrid_v1` kept as `A4_DOMAIN_ML_POLICY=hybrid_v1` for A/B — higher FA on val.

## Flags

```powershell
# Default — Stage-0 only (unchanged behavior)
$env:A4_DOMAIN_ML_MODE='off'

# Shadow — log ML; responses still Stage-0
$env:A4_DOMAIN_ML_MODE='shadow'
$env:A4_DOMAIN_CLF_JSON='..\agents\artifacts\a4_domain\a4-domain-clf-improve-v1-lr_mindf1.json'

# Enforce — NOT for production until approved
$env:A4_DOMAIN_ML_MODE='enforce'
$env:A4_DOMAIN_ML_POLICY='ml_tau'   # or hybrid_v1
$env:A4_DOMAIN_ML_TAU='0.45'

# Stricter Qwen system rules (separate)
$env:A4_KNOWLEDGE_STRICT_PROMPT='1'
```

## Rollback

Unset `A4_DOMAIN_ML_MODE` / set `off`; unset `A4_KNOWLEDGE_STRICT_PROMPT`. Re-run `npm run verify:a4-knowledge` and `npm run verify:a4-domain-clf`.

## Parity

Python/Node max \|Δp\| ≈ **1e-15** on 49 fixtures (`verify:a4-domain-clf`).

## Limitations

- Val n=39 only; not research-final; test/vault unused for τ.
- Wave-2 labels partly author-only.
- `enforce` fail-closed on load/predict errors (knowledge path only).
- Strict prompt does not replace Stage-0/ML.
- Artifact path must be set or default monorepo relative path must exist.

## Shadow verification (2026-10-21)

Ran `npm run verify:a4-domain-shadow` (same `resolveA4KnowledgeDomainGate` as the route; **no** HTTP/DB/Ollama/Docker).

- JSON load OK (~10 ms); **22/22** cases: shadow `allowKnowledge` ≡ Stage-0 / mode=`off`
- Gate+predict latency: mean **~0.55 ms**, p95 **~1.7 ms**
- If enforce were on: would rescue **6** Stage-0 finance misses in the set; would block stuffing **S20** Stage-0 false-allow
- Report: [`SHADOW_MODE_VERIFY.md`](./SHADOW_MODE_VERIFY.md)

**HTTP E2E** with a live API process was **not** run (would need backend up; not required for gate proof).

## Strict prompt A/B (2026-10-21, live Qwen)

Prompt-only A/B (`eval-a4-knowledge-prompt-ab.ts`): FA **5→2**, FR **1→0**, finance ok **5/6→6/6**; strict still FA on Portugal/photosynthesis; 2× HTTP 500 repeat-limit on strict arm. See [`STRICT_PROMPT_AB.md`](./STRICT_PROMPT_AB.md). **Keep strict flag default off.**

## Combined ML enforce + strict (2026-10-21, isolated)

`eval-a4-combined-ml-strict.ts` — Stage-0+base vs `enforce`+`ml_tau@0.45`+strict on 18 synthetic cases (same routing helpers; no DB/NLQ dispatch; process env only).

| Metric | Stage-0 + base | ML + strict |
|--------|----------------|-------------|
| Correct | 14/18 | **17/18** |
| FA / FR | 0 / 4 | 0 / **1** |
| Rescues | — | C04–C07 |
| New FR | — | **C08** (pFin 0.404) |
| Repeat-limit | 0 | 0 (ML blocked prior offenders) |

Fail-closed: missing clf JSON → `enforce_fail_closed` on knowledge only (gate now reads `A4_DOMAIN_CLF_JSON` from injected env). NLQ count cues / cooking hardRefuse unchanged. Full write-up: [`COMBINED_ML_STRICT_EVAL.md`](./COMBINED_ML_STRICT_EVAL.md).

**Verdict: NO-GO** default-on for both flags. Metrics favor combined on this set; residual FR + prior repeat-limit risk + unproven complementarity → keep production off; optional shadow soak only.

## Activation verdict

**Local MicroFlow: DEPLOYED** (API 11/11; PAR30 FR known). See [`DEPLOYMENT_LOCAL.md`](./DEPLOYMENT_LOCAL.md).  
**Shared/cloud: NO-GO** until artifact packaging + explicit promotion. Rollback: set mode `off`, strict `0`, restart local backend.
