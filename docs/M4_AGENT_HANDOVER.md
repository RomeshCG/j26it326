# M4 Agent Handover

> **Last updated:** 2026-10-16  
> **Source of truth:** repository code and Git state **override** this file.  
> Deep dive / viva: [`M4_TECHNICAL_WALKTHROUGH.md`](./M4_TECHNICAL_WALKTHROUGH.md).  
> Do not treat [`IMFS_Task_List.md`](../IMFS_Task_List.md) as current scope (checkboxes stale vs code).

---

## 0. New Agent Startup Checklist

1. Read this file (§1–5, §7) and skim the [walkthrough](./M4_TECHNICAL_WALKTHROUGH.md) if needed.
2. `git fetch`; compare `origin/main` vs `m4/phase10-ai-agents`; `git status`.
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
| Tenant `employees` / `payroll_records` + HR/payroll APIs | **M4** (schema + `hr:*` RBAC; **product routes not built**) |
| M1 risk / M2 ledger / M3 loans+EWS | **Other modules** — impact review on shared code |

**Runtime:** Node = GT + A1/A2/A4 + Prisma tools · Python `agents/` = A3 score (+ optional service-key dispatch) · Ollama = A4 **intent only** · DBs = central + per-tenant via `req.tenantPrisma`.

**Research focus:** AI agents + Graduated Trust. HR/payroll is supporting ERP (next after A1 live E2E).

---

## 2. File index

| Concern | Files |
|---------|--------|
| Policies | [`agent-defaults.ts`](../backend/src/lib/agent-defaults.ts) |
| Engine | [`agent-engine.ts`](../backend/src/lib/agent-engine.ts), [`agent-engine-core.ts`](../backend/src/lib/agent-engine-core.ts) |
| Handlers | [`agent-handlers.ts`](../backend/src/lib/agent-handlers.ts) |
| Routes | [`agent-governance.ts`](../backend/src/routes/agent-governance.ts) |
| A1 | [`agent-a1-compliance.ts`](../backend/src/lib/agent-a1-compliance.ts) · `POST …/cbsl-report/prepare` · `npm run verify:a1-compliance` |
| A2 | [`agent-a2-budget.ts`](../backend/src/lib/agent-a2-budget.ts) · `npm run verify:a2-budget` |
| A3 | [`agents/`](../agents/) · allowlist `volume_spike_alert` only |
| A4 | [`agent-a4-nlq.ts`](../backend/src/lib/agent-a4-nlq.ts), [`ollama-client.ts`](../backend/src/lib/ollama-client.ts) · `npm run verify:a4-nlq` |
| A4 UI | [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx), [`api.js`](../frontend/src/lib/api.js) `queryNlq` |
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
| Ollama timeout default **30s** | Cold load >15s | Unbounded wait |
| A4 prompt **`a4-intent-v2`** + evidence gate | 1.5B over-fire | Prompt-only / greeting blacklist |
| A1 v1 = **`cbsl_readiness_v1`** via `generate_cbsl_report` | Grounded tenant aggregates + rules; Tier 3 | Official CBSL filing; LLM inventing figures; external PAR/MIX/Findex in ops |
| A1 deterministic rules (no LLM in v1) | Explainable readiness | LLM “to look intelligent” |
| A1 prepare: `decide_tier3` **or** `finance:manage_ledger` | Finance can prepare; approve stays Tier-3 roles | Giving finance `decide_tier3` |
| A1 SoD: `preparedByUserId` + deny self-approve | Server-side; legacy missing preparer → fail closed | UI-only SoD; shared GT engine rewrite |
| A1 prepare audit `a1_readiness.prepared` | Binds `proposalHash` outside mutable payload alone | Claiming crypto immutability vs DB admin |
| Conversational memory | Out of A4 v1 | **A4 v2** |
| Payroll → M2 journal | Needs event schema | Direct M2 table writes |

---

## 4. Delivery status

| Item | Status | Evidence |
|------|--------|----------|
| GT / Agent Log / Tier 3 / overrides / policies | **Merged** | Phase 9 on `main` |
| A3 IF + FastAPI | **Merged + E2E** | PR #20 → `origin/main` |
| A2 budget threshold v1 | **Merged + E2E** | PR #21 → `origin/main` |
| A4 NLQ + UI + intent-v2 | **On branch** (merge **on hold**) | `dba226c`, `e844e6f` |
| A1 CBSL readiness v1 | **Live E2E verified (ZZ)** | Approve `241418c5-…`; reject `83efcab0-…`; SoD 403 `805a063d-…`; offline **62/62** |
| HR / payroll product | **Incomplete** | Schema + `hr:*`; no tenant HR routes; FE mock |
| AI evaluation harness | **Not started** | After A1 live E2E |

**Defaults:** `nlq_query` A4 T1 · `budget_threshold_alert` A2 T2 · `generate_cbsl_report` A1 T3 · `volume_spike_alert` A3 T4.

---

## 5. CURRENT WORK

**Milestone:** A1 Compliance Readiness v1 — **live ZZ E2E complete** (approve + reject + SoD denial).

**Live evidence (ZZ):** Finance→Admin **approve/execute** `241418c5-a85a-46b6-acdb-0212daadd390`. Finance→Executive **reject** `83efcab0-5561-4954-aca9-66d8faa3c1ec` (no handler). BM self-approve → **403**, then Executive reject `805a063d-fca4-4572-b475-271a9b72a8f1`. Prefer seeded ZZ roles for automation (avoid putting admin password in agent env).

**API:** prepare → `preparedByUserId` + `a1_readiness.prepared` + Tier 3 pending; A1 approve gate (SoD/hash); reject skips handler; Tier UI A1 summary.

**Limits:** Readiness ≠ official CBSL; typical tenant often `not_ready`; hash binding not DB-admin-proof; legacy packages without preparer cannot approve.

**Next (chinookz):** Commit when ready; A4 merge still on hold; then HR/payroll → AI eval. Exclude `m4-lint-baseline.txt`.

---

## 6. Ops cheat sheet

```powershell
cd backend
npm run verify:a1-compliance
npm run verify:a2-budget
npm run verify:a4-nlq
npm run verify:zz-seed-safety
npx tsc --noEmit -p tsconfig.json
```

**ZZ reusable test users (dev only, never production):**  
`ALLOW_ZZ_TEST_USER_SEED=1` then `npm run seed:zz-test-users`. Creates five non-admin roles on ZZ only; **never** touches `admin@zz-test-org1.lk`. Passwords go to gitignored `backend/.zz-test-credentials.local` (not printed). Disable later: set `central.users.status='disabled'`. See integration guide §7.

**Env names (never commit values):** `JWT_SECRET`, `CENTRAL_DATABASE_URL`, `TENANT_DATABASE_URL`, `AGENT_SERVICE_KEY`, `AGENTS_LOCAL_TOKEN`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`, `ENABLE_DISPATCH_STUB`.

**ZZ resolve:** always via central institution id / `dbIdentifier` — do **not** assume `TENANT_DATABASE_URL` is ZZ.

---

## 7. Development rules

chinookz owns Git and approvals. Agents stay in approved scope. Challenge Agent1 vs repo evidence. Update this handover at milestones, not every chat.

---

## 8. Known limitations

- A3: weak `amount_spike`; scores ≠ probabilities; real txn feed pending.  
- A2: soft dedupe TOCTOU; no automatic M2 monitoring.  
- A4: intent ≠ Tier 1 correctness; evidence gate may reject odd phrasings; no multi-turn memory.  
- A1: readiness ≠ official CBSL; typical tenant `not_ready`; self-approve **403** (live); use two distinct ZZ users; hash/audit binding not DB-admin-proof.  
- HR/payroll: mock UI; payroll rows usually empty.  
- Engine: crash can leave `running`.  
- M3 still on `mock-auth` / `x-institution-id` (coordination).

---

## 9. Change history

| Date | Note |
|------|------|
| 2026-10-16 | Handover v1; A2/A3 on `origin/main`; A4 local only. |
| 2026-10-16 | A4 ZZ live E2E; walkthrough; Ask Agent 4 UI; intent-v2; docs. |
| 2026-10-16 | A4 pushed (`dba226c`, `e844e6f`); merge hold; priorities → A1 first. |
| 2026-10-16 | A1 readiness v1 + hardening; ZZ live E2E: approve, reject, SoD 403 (seeded roles). |
