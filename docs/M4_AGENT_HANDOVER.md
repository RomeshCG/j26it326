# M4 Agent Handover

> **Last updated:** 2026-10-16  
> **Source of truth:** repository code and Git state **override** this file.  
> Deep dive / viva: [`M4_TECHNICAL_WALKTHROUGH.md`](./M4_TECHNICAL_WALKTHROUGH.md).  
> Do not treat [`IMFS_Task_List.md`](../IMFS_Task_List.md) as current scope.

---

## 0. New Agent Startup Checklist

1. Read this file (§1–5, §7) and skim the [walkthrough](./M4_TECHNICAL_WALKTHROUGH.md) if needed.
2. `git fetch`; compare `origin/main` vs branch; `git status` (A4 may still be **local / uncommitted**).
3. Link out: [`M4_INTEGRATION_GUIDE.md`](./M4_INTEGRATION_GUIDE.md), [`agents/README.md`](../agents/README.md).
4. Ask chinookz before DB writes, migrations, live dispatch, commits/pushes, or M1–M3 edits.
5. After a milestone, update §5 and §9 (rewrite current work — don’t append forever).

---

## 1. Ownership map

**M4 = Component 4:** multi-tenant auth/RBAC, tenant routing, HR/payroll surfaces, Graduated Trust, AI agents.

| Area | Owner |
|------|--------|
| `backend/src/lib/agent-*.ts`, `routes/agent-*.ts`, `internal-agent-dispatch.ts` | **M4** |
| Auth, tenant routing, provisioning | **M4** |
| `agents/` FastAPI (A3 IF) | **M4** |
| `frontend/src/components/c4/` | **M4** (exec-dashboard NLQ still **mock**) |
| M1 risk / M2 ledger / M3 loans+EWS | **Other modules** — impact review on shared code |

**Runtime:** Node = GT + A2/A4 + Prisma tools · Python `agents/` = A3 score (+ optional service-key dispatch) · Ollama = A4 **intent only** · DBs = central + per-tenant via `req.tenantPrisma`.

---

## 2. File index

| Concern | Files |
|---------|--------|
| Policies | [`agent-defaults.ts`](../backend/src/lib/agent-defaults.ts) |
| Engine | [`agent-engine.ts`](../backend/src/lib/agent-engine.ts), [`agent-engine-core.ts`](../backend/src/lib/agent-engine-core.ts) |
| Handlers | [`agent-handlers.ts`](../backend/src/lib/agent-handlers.ts) |
| Routes | [`agent-governance.ts`](../backend/src/routes/agent-governance.ts) |
| A2 | [`agent-a2-budget.ts`](../backend/src/lib/agent-a2-budget.ts) · `npm run verify:a2-budget` |
| A3 | [`agents/`](../agents/) · allowlist `volume_spike_alert` only |
| A4 | [`agent-a4-nlq.ts`](../backend/src/lib/agent-a4-nlq.ts), [`ollama-client.ts`](../backend/src/lib/ollama-client.ts) · `npm run verify:a4-nlq` |
| RBAC | [`permissions.ts`](../backend/src/lib/permissions.ts) |

**Schema note:** `agent_actions` has **no** `actionType` column. Type lives in `inputPayload.actionType` and the linked `agent_tier_policies` row.

---

## 3. Decision log (ADR-lite)

| Decision | Why | Deferred / rejected |
|----------|-----|---------------------|
| Node owns GT/tools/RBAC; Python owns A3 IF | Tenant auth + no Python DB | LangChain as orchestrator |
| Service-key allowlist = A3 only | Least privilege | A2/A4 on service key |
| A2 caller metrics (`manual_api_v1`) | No M2 budget APIs | Fake M2 sources |
| A2 soft 24h dedupe | No migration | Unique index |
| A3 synthetic IF v2; non-probabilistic scores | Research prototype | Score×100 as fraud % |
| A4: Ollama intent → tools → then dispatch | Handler has no Prisma; no invented counts | Tools inside handler |
| A4 tool RBAC (`decide_tier3` / `view_actions`) | Mirrors pending vs Agent Log | `query_nlq` alone for all metrics |
| A4 days 1–30; no silent clamp | Explicit unsupported | Clamp 90→30 |
| Ollama timeout default **30s** (`OLLAMA_TIMEOUT_MS`) | Cold load >15s observed | Unbounded wait |
| Frontend NLQ mock stays | Avoid inventing PAR/EPF | Wire UI after commit |

---

## 4. Delivery status

| Item | Status | Evidence |
|------|--------|----------|
| GT engine / Agent Log / policies | **Merged** | Phase 9a on `main` |
| Phase 10 service dispatch | **Merged** | `fe18f60` / PR #19 lineage |
| A3 IF + FastAPI | **Merged + E2E** | `4390886`; **PR #20** → `origin/main` |
| A2 budget threshold v1 | **Merged + E2E** | `83e293d`; **PR #21** → `origin/main` (`73923d3`) |
| A4 NLQ v1 | **Implemented + offline tests + ZZ live E2E; not on `origin/main` yet** | Working tree; action `9f5f715b-455d-4ade-97ea-3412667a2a37` |
| A1 CBSL | **Planned** | Policy Tier 3 only; stub handler |
| LangChain / real NLQ UI | **Deferred / mock** | Exec dashboard keyword mock |

**Defaults:** `nlq_query` A4 T1 · `budget_threshold_alert` A2 T2 · `generate_cbsl_report` A1 T3 · `volume_spike_alert` A3 T4.

---

## 5. CURRENT WORK

**Milestone:** A4 v1 — **live E2E complete** (ZZ). Code still needs **Git commit / PR** by chinookz.

**Verified live (ZZ `33b6545d-…`):**  
Tier 1 `executed`, `nlqQueryHandler` / `stubExecuted=false`, facts count=4 A3 in 7d window, independent Prisma count=4, audits `running`+`executed`, unsupported + out-of-range days → no action, finance officer → 403 on pending Tier 3 tool.

**Next:** Commit A4 (+ docs); exclude `m4-lint-baseline.txt`; PR to `main`; optional UI wire later.

**Commit candidates:**  
`agent-a4-nlq.ts`, `ollama-client.ts`, `agent-handlers.ts`, `agent-governance.ts`, `verify-a4-nlq.ts`, `package.json`, `.env.example`, `M4_INTEGRATION_GUIDE.md`, `M4_AGENT_HANDOVER.md`, `M4_TECHNICAL_WALKTHROUGH.md`.

---

## 6. Ops cheat sheet

```powershell
cd backend
npm run verify:a2-budget
npm run verify:a4-nlq
npx tsc --noEmit -p tsconfig.json
```

**Env names (never commit values):** `JWT_SECRET`, `CENTRAL_DATABASE_URL`, `TENANT_DATABASE_URL`, `AGENT_SERVICE_KEY`, `AGENTS_LOCAL_TOKEN`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`, `ENABLE_DISPATCH_STUB`.

**ZZ resolve:** always via central institution id / `dbIdentifier` — do **not** assume `TENANT_DATABASE_URL` is ZZ.

---

## 7. Development rules

chinookz owns Git and approvals. Agents stay in approved scope. Challenge Agent1 vs repo evidence. Update this handover at milestones, not every chat.

---

## 8. Known limitations

- A3: weak `amount_spike`; scores ≠ probabilities.  
- A2: soft dedupe TOCTOU; `allowDuplicate=true`.  
- A4: small Qwen may mis-intent; cold start; aggregates only.  
- Engine: crash can leave `running` (documented).

---

## 9. Change history

| Date | Note |
|------|------|
| 2026-10-16 | Handover v1; A2/A3 on `origin/main`; A4 local only. |
| 2026-10-16 | A4 ZZ live E2E PASS (`9f5f715b-…`); walkthrough doc added; A4 still uncommitted. |
