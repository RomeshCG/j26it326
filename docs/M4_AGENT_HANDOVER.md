# M4 Agent Handover

> **Last updated:** 2026-10-16  
> **Source of truth:** repository code and Git state **override** this file.  
> Deep dive / viva: [`M4_TECHNICAL_WALKTHROUGH.md`](./M4_TECHNICAL_WALKTHROUGH.md).  
> Do not treat [`IMFS_Task_List.md`](../IMFS_Task_List.md) as current scope.

---

## 0. New Agent Startup Checklist

1. Read this file (§1–5, §7) and skim the [walkthrough](./M4_TECHNICAL_WALKTHROUGH.md) if needed.
2. `git fetch`; compare `origin/main` vs branch; `git status` (A4 UI + intent-v2 may still be **uncommitted**).
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
| `frontend/src/components/c4/` (incl. live Ask Agent 4 panel) | **M4** |
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
| A4 UI | [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx), [`api.js`](../frontend/src/lib/api.js) `queryNlq`, store nlq history v2 |
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
| A4 prompt **`a4-intent-v2`** + post-parse evidence gate | 1.5B over-fires (e.g. “Hello” → pending) | Prompt-only; greeting keyword blacklist; hardcoded intent matching |
| Reuse shared AgentPanel (sidebar + FAB) | One Ask Agent 4 surface | New chatbot widget |
| Conversational memory / follow-ups | Out of v1 scope | **A4 v2** |

---

## 4. Delivery status

| Item | Status | Evidence |
|------|--------|----------|
| GT engine / Agent Log / policies | **Merged** | Phase 9a on `main` |
| Phase 10 service dispatch | **Merged** | `fe18f60` / PR #19 lineage |
| A3 IF + FastAPI | **Merged + E2E** | `4390886`; **PR #20** → `origin/main` |
| A2 budget threshold v1 | **Merged + E2E** | `83e293d`; **PR #21** → `origin/main` (`73923d3`) |
| A4 NLQ v1 backend | **On branch** `m4/phase10-ai-agents` (`dba226c`) + intent-v2 in working tree | ZZ action `9f5f715b-…`; prompt `a4-intent-v2` |
| A4 Ask Agent 4 UI | **Live UI verified** (Agent1 screenshots) | [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx) → `queryNlq` |
| A1 CBSL | **Planned** | Policy Tier 3 only; stub handler |
| LangChain / A4 chat memory | **Deferred (A4 v2)** | Per-turn questions only |

**Defaults:** `nlq_query` A4 T1 · `budget_threshold_alert` A2 T2 · `generate_cbsl_report` A1 T3 · `volume_spike_alert` A3 T4.

---

## 5. CURRENT WORK

**Milestone:** A4 Ask Agent 4 UI — **frontend finalize** (docs + pending commit).

**UI status (Agent1 live review):** Shared sidebar + FAB [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx) calls real `POST …/nlq/query`. Supported questions return grounded template answers and create Tier 1 Agent Log rows. Live Agent Activity Log shows `promptVersion: a4-intent-v2`. Greetings → unsupported, **no** action. Unsupported copy is employee-friendly (outside current scope). Exec dashboard opens the same panel (no fabricated PAR/EPF box). Chat history is local UI persistence only — **not** model conversational memory (deferred to A4 v2).

**Completed testing:** Backend ZZ E2E (`9f5f715b-…`); offline `verify:a4-nlq` (incl. evidence-gate regressions); live UI smoke (supported + greeting + unsupported + GT meta).

**Next (chinookz):** Commit/PR remaining A4 UI + intent-v2 + docs when ready; merge to `main`. Exclude `m4-lint-baseline.txt`. No further A4 scope in this milestone.

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
- A4: Tier 1 `executed` means GT ran the grounded handler — **not** that Ollama intent was correct; evidence gate cuts false positives but may reject unusual valid phrasings; cold start; aggregates only; **no** multi-turn memory (A4 v2).  
- Engine: crash can leave `running` (documented).

---

## 9. Change history

| Date | Note |
|------|------|
| 2026-10-16 | Handover v1; A2/A3 on `origin/main`; A4 local only. |
| 2026-10-16 | A4 ZZ live E2E PASS (`9f5f715b-…`); walkthrough doc added. |
| 2026-10-16 | Ask Agent 4 UI wired to live NLQ API; exec-dashboard mock → panel CTA; history schema v2. |
| 2026-10-16 | Intent `a4-intent-v2` + evidence gate; Agent1 live UI review PASS; A4 frontend milestone docs finalized. |
