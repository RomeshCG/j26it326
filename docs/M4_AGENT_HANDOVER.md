# M4 Agent Handover

> **Last updated:** 2026-10-20
> **Active branch:** `feature/m4-dashboard-wire` (uncommitted work present — see §5).
> **Source of truth:** repository code and Git state **override** this file.
> Deep dive / viva: [`M4_TECHNICAL_WALKTHROUGH.md`](./M4_TECHNICAL_WALKTHROUGH.md).
> Integration for M1/M2/M3: [`M4_INTEGRATION_GUIDE.md`](./M4_INTEGRATION_GUIDE.md).
> Do not treat [`IMFS_Task_List.md`](../IMFS_Task_List.md) as current scope (checkboxes stale vs code).

---

## 0. New Agent Startup Checklist

1. Read this file (§1–5, §7–8) and skim the [walkthrough](./M4_TECHNICAL_WALKTHROUGH.md) if needed.
2. `git fetch`; compare `origin/main` vs `feature/m4-dashboard-wire`; `git status` (expect untracked A4 knowledge + local `.a4-*` results).
3. Link out: [`M4_INTEGRATION_GUIDE.md`](./M4_INTEGRATION_GUIDE.md), [`agents/README.md`](../agents/README.md).
4. Ask chinookz before DB writes, migrations, live dispatch, commits/pushes, or M1–M3 edits.
5. After a milestone, update §5 and §9 (rewrite current work — don’t append forever).
6. **Never commit:** `m4-lint-baseline.txt`, `backend/.zz-test-credentials.local`, `.zz-viva-prep-manifest.local.json`, `backend/scripts/.a4-*-*.json` live result dumps (not yet gitignored — leave untracked).

---

## 1. Ownership map

**M4 = Component 4:** multi-tenant auth/RBAC, tenant routing, HR/payroll surfaces, Graduated Trust, AI agents.

| Area | Owner |
|------|--------|
| `backend/src/lib/agent-*.ts`, `routes/agent-*.ts`, `internal-agent-dispatch.ts` | **M4** |
| Auth, tenant routing, provisioning | **M4** |
| `agents/` FastAPI (A3 IF) | **M4** |
| `frontend/src/components/c4/` (Ask Agent 4, dashboards, Settings, Tier Approvals) | **M4** |
| Tenant `employees` / `payroll_records` + HR/payroll APIs | **M4** (schema + `hr:*` RBAC; **product routes not built**) |
| M1 risk / M2 ledger / M3 loans+EWS | **Other modules** — impact review on shared code |

**Runtime:** Node = GT + A1/A2/A4 + Prisma tools · Python `agents/` = A3 score (+ optional service-key dispatch) · Ollama = A4 **intent + knowledge JSON** · DBs = central + per-tenant via `req.tenantPrisma`.

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
| A4 NLQ | [`agent-a4-nlq.ts`](../backend/src/lib/agent-a4-nlq.ts) · `npm run verify:a4-nlq` |
| A4 Knowledge | [`agent-a4-knowledge.ts`](../backend/src/lib/agent-a4-knowledge.ts) · fixtures `eval-fixtures/a4/a4-knowledge-cases.v1.json` · `npm run verify:a4-knowledge` |
| Ollama | [`ollama-client.ts`](../backend/src/lib/ollama-client.ts) — typed `OllamaUnavailableError` codes; optional `num_predict` |
| A4 UI | [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx), [`api.js`](../frontend/src/lib/api.js) `queryNlq` |
| Role homes | [`roles.js`](../frontend/src/lib/roles.js) `getRoleRedirect` · sidebar + Access Denied |
| ZZ viva prep | [`prepare-zz-viva-demo.ps1`](../backend/scripts/prepare-zz-viva-demo.ps1) · `npm run verify:zz-viva-prep-offline` |
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
| A4 knowledge after unsupported (v1.2) | Education without fake DB counts | Claiming knowledge = trained model proof of audit rows |
| Lexical skip of intent Ollama when no count cues | Saves latency; fail-closed to knowledge/unsupported | Always calling Ollama for greetings |
| Knowledge `num_predict` **default 1024** (env override) | A/B: 512 cut timeouts but hurt long-form JSON; restored 1024 | Shipping 512 as production default |
| Knowledge length-only retry (45s stage budget) | Truncation recovery without inventing facts | Unlimited retries / timeout-as-success |
| A1 v1 = **`cbsl_readiness_v1`** via `generate_cbsl_report` | Grounded tenant aggregates + rules; Tier 3 | Official CBSL filing; LLM inventing figures |
| A1 SoD: `preparedByUserId` + deny self-approve | Server-side | UI-only SoD |
| Sidebar / Access Denied → `getRoleRedirect` | BM “Dashboard” wrongly opened executive shell | Role-gating `/dashboard` (broader product change deferred) |
| Remove BM Graduated Trust banner + Settings demo sections | Viva UI honesty | Replacement decorative banners |
| ZZ viva: reuse history; additive A2 pack only | Avoid bulk fake audit rows; preserve pending A1 | Apex `db:seed:tenant`; admin test-dispatch as model proof |

---

## 4. Delivery status

| Item | Status | Evidence |
|------|--------|----------|
| GT / Agent Log / Tier 3 / overrides / policies | **Merged** | Phase 9 on `main` |
| A3 IF + FastAPI | **Merged + E2E** | PR #20 → `origin/main` |
| A2 budget threshold v1 | **Merged + E2E** | PR #21 → `origin/main` |
| A4 NLQ + UI + intent-v2 | **On branch / prior commits** | Live ZZ + AgentPanel |
| A4 Knowledge v1.2 + reliability | **Local uncommitted** | `agent-a4-knowledge.ts`; `verify:a4-knowledge` **202/202** offline |
| A1 CBSL readiness v1 | **Live E2E verified (ZZ)** | Historical approve/reject/SoD; current viva pending preserved |
| Exec / BM dashboards (honest KPIs) | **On branch** | Live pending + Agent feed; M2/M3/HR “Not connected” |
| Role-based dashboard nav | **Local uncommitted** | `getRoleRedirect` in sidebar + Access Denied |
| Settings viva cleanup | **Local uncommitted** | Live institution/branches; demo loan/onboarding CTA removed |
| HR / payroll product | **Incomplete** | Schema + `hr:*`; no tenant HR routes |
| AI evaluation harness (frozen accuracy) | **Separate report** | Do not overwrite baselines without new evidence |

**Defaults:** `nlq_query` A4 T1 · `budget_threshold_alert` A2 T2 · `generate_cbsl_report` A1 T3 · `volume_spike_alert` A3 T4.

---

## 5. CURRENT WORK

**Branch:** `feature/m4-dashboard-wire`.

**Milestone:** ZZ viva readiness — UI honesty + A4 knowledge reliability + **A2 additive prep executed** on ZZ Test Org 1.

### Completed on this branch (code / UI)

- A4 knowledge path (glossary, soft 900-char budget, length-only retry, typed Ollama errors, `num_predict` default **1024**).
- Lexical NLQ cue gate (`questionSuggestsNlqCountIntent`) before intent Ollama.
- Role-home navigation (`getRoleRedirect`) for Dashboard link, logo, Access Denied.
- Branch Manager: removed technical Graduated Trust info banner; live pending KPI retained.
- Tier Approvals: `min-w-0` / `break-words` / wrap long JSON (overflow fix).
- Settings: removed disabled Onboarding review CTA + demo Loan Products toggles; softened copy; kept live institution/branches + admin locks.
- ZZ viva prep script + **write-mode run** (see dataset below).

### ZZ viva dataset

**Why the extra A2 rows exist:** Viva needed a few clear Tier 2 `notified` examples from the **genuine** `POST …/budget-threshold/evaluate` path (caller-supplied metrics, `source: manual_api_v1`) — **not** Apex bulk seed, **not** admin `test-dispatch`, and **not** automatic M2 ledger monitoring.

**Verified historical write** (`prepare-zz-viva-demo.ps1 -Write`, recorded in local gitignored manifest `backend/scripts/.zz-viva-prep-manifest.local.json`, `updatedAt` ≈ `2026-10-20T14:34:14Z`):

| Scenario | Result | Action id (if any) |
|----------|--------|-------------------|
| **N-A2-1** | T2 breach created | `dbc08d85-ab3d-49b9-8be6-48ae1ecb59ec` |
| **N-A2-2** | T2 breach created | `5f005608-3ee8-4e68-b338-4fdf65ccf9d7` |
| **N-A2-NB** | below threshold → **no** `AgentAction` | — |
| Protected A1 | still pending | `c68649d1-eed9-4724-a187-d57c0617ab2c` |

**Counts at that write** (team + UI verification): A2 `notified` **4 → 6**; tenant `agent_actions` total **45 → 47**. Executive feed / Agent Log / Graduated Trust visually checked afterward.

**Do not treat these totals as frozen.** Later NLQ, approvals, or evaluate calls can change counts. Prefer action ids + Agent Log filters over assuming “always 47.”

| Agent | Role in viva | Notes |
|-------|--------------|------|
| A4 | many T1 `executed` | Reuse; knowledge turns add **no** rows |
| A2 | includes prep rows above | `manual_api_v1` synthetic metrics |
| A1 | **1 pending** `c68649d1-…` | **Preserve** for SoD until human decides |
| A1 | historical executed/rejected | Reuse |
| A3 | T4 `alert_only` | Reuse; no fake IF via test-dispatch |

**Honest labels:** A2 prep = genuine threshold **rules** + caller metrics (`manual_api_v1`), **not** M2 monitoring. Knowledge answers ≠ audit proof of a “trained model run.”

### A4 reliability findings (lab)

| Setting | Observation |
|---------|-------------|
| `num_predict=1024` (default) | Better long-form JSON; some timeouts/token-repeat on hard cases |
| `num_predict=512` (A/B) | Fewer timeouts; more non-JSON / unsupported on long education answers |
| **Chosen** | Keep **1024** as default; env `A4_KNOWLEDGE_NUM_PREDICT` for experiments |

### Next (chinookz)

1. Review uncommitted grouping and stage **explicit paths** (never `git add .`).
2. A2 viva prep write is **done** — re-run only if ids missing or chinookz requests a refresh (idempotent skips via markers/dedupe).
3. Exclude lint baseline + `.a4-*.json` live dumps + credentials/manifests from any commit (scripts dumps now gitignored).
4. Do **not** overwrite frozen research eval baselines without new measured evidence.

---

## 6. Ops cheat sheet

```powershell
cd backend
npm run verify:a1-compliance
npm run verify:a2-budget
npm run verify:a4-nlq
npm run verify:a4-knowledge
npm run verify:zz-viva-prep-offline
npm run verify:zz-seed-safety
npx tsc --noEmit -p tsconfig.json

# ZZ A2 additive prep — dry-run (default). Write already executed for viva 2026-10-20;
# re-run -Write only with approval (ALLOW_ZZ_VIVA_PREP_WRITE=1).
powershell -NoProfile -File .\scripts\prepare-zz-viva-demo.ps1
```

**ZZ reusable test users (dev only, never production):**
`ALLOW_ZZ_TEST_USER_SEED=1` then `npm run seed:zz-test-users`. Creates five non-admin roles on ZZ only; **never** touches `admin@zz-test-org1.lk`. Passwords → gitignored `backend/.zz-test-credentials.local`.

**Env names (never commit values):** `JWT_SECRET`, `CENTRAL_DATABASE_URL`, `TENANT_DATABASE_URL`, `AGENT_SERVICE_KEY`, `AGENTS_LOCAL_TOKEN`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_MS`, `A4_KNOWLEDGE_NUM_PREDICT`, `ENABLE_DISPATCH_STUB`, `ALLOW_ZZ_VIVA_PREP_WRITE`.

**ZZ resolve:** always via central institution id / `dbIdentifier` — do **not** assume `TENANT_DATABASE_URL` is ZZ.

---

## 7. Development rules

chinookz owns Git and approvals. Agents stay in approved scope. Challenge Agent1 vs repo evidence. Update this handover at milestones, not every chat.

---

## 8. Known limitations

- A3: weak `amount_spike`; scores ≠ probabilities; real txn feed pending.
- A2: soft dedupe TOCTOU; no automatic M2 monitoring; viva prep uses synthetic caller metrics.
- A4 NLQ: intent ≠ Tier 1 correctness; evidence gate may reject odd phrasings; no multi-turn memory.
- A4 Knowledge: 1.5B long-form limits; educational only; **no** `AgentAction` on knowledge turns; not a substitute for M2 PAR/EPF facts.
- A1: readiness ≠ official CBSL; preserve pending viva row until human decides.
- `/dashboard` still reachable by any authenticated role by URL (nav fixed; route not re-gated).
- HR/payroll: mock UI; payroll rows usually empty.
- Engine: crash can leave `running`.
- M3 may still use parallel auth patterns in places — coordinate before shared middleware edits.

---

## 9. Change history

| Date | Note |
|------|------|
| 2026-10-16 | Handover v1; A2/A3 on `origin/main`; A4 local only. |
| 2026-10-16 | A4 ZZ live E2E; walkthrough; Ask Agent 4 UI; intent-v2; docs. |
| 2026-10-16 | A4 pushed; merge hold; priorities → A1 first. |
| 2026-10-16 | A1 readiness v1 + hardening; ZZ live E2E: approve, reject, SoD 403. |
| 2026-10-20 | `feature/m4-dashboard-wire`: A4 knowledge v1.2 + 1024 default; ZZ viva prep script; role-home nav; BM/Settings/Tier UI cleanup; docs refresh. |
