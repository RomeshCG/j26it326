# M4 Technical Walkthrough (study / viva)

> Companion to [`M4_AGENT_HANDOVER.md`](./M4_AGENT_HANDOVER.md).  
> **Code and Git beat this document.** Last aligned: 2026-10-16 (A1 ZZ live E2E: approve + reject + SoD; A4 UI live-verified).

This note explains how Component 4 (M4) runs Graduated Trust and agents A1–A4 in the IMFS / MicroFlow repo, with enough detail for a viva without pasting whole modules.

---

## 1. What M4 owns

IMFS is split into research components. **M4 (C4)** provides:

- Multi-tenant auth (JWT), RBAC capabilities, institution provisioning  
- Tenant DB routing (`req.tenantPrisma`)  
- Graduated Trust: policies, `dispatchAgentAction`, Agent Log, Tier 3 approve/reject, overrides  
- Agent runtimes that M4 controls: **A1** (Node readiness rules + Tier 3), **A2** (Node rules), **A3** (Python IF + Node dispatch), **A4** (Node + Ollama intent)

**Not M4:** M1 credit risk models, M2 ledger product APIs, M3 loan lifecycle / EWS (except consuming shared auth/tenant patterns).

Integration API catalog for other teams: [`M4_INTEGRATION_GUIDE.md`](./M4_INTEGRATION_GUIDE.md).

---

## 2. Graduated Trust in one page

**Policy row** (`agent_tier_policies`): maps `actionType` → `agentId`, `tier` (1–4), `isActive`.

**Defaults** ([`agent-defaults.ts`](../backend/src/lib/agent-defaults.ts)):

| actionType | Agent | Tier | Meaning |
|------------|-------|------|---------|
| `nlq_query` | A4 | 1 | Auto-execute → `executed` |
| `budget_threshold_alert` | A2 | 2 | Execute + notify → `notified` |
| `generate_cbsl_report` | A1 | 3 | Human gate → `pending_approval` |
| `volume_spike_alert` | A3 | 4 | Alert only → `alert_only` |

**Dispatch** ([`agent-engine.ts`](../backend/src/lib/agent-engine.ts)):

1. Load active policy by `actionType` (client **cannot** set tier/agentId).  
2. Missing/inactive policy → **fallback Tier 4** (`isFallback: true`).  
3. Tier 3: create `pending_approval` + audit; stop.  
4. Tier 1/2/4: create `running` + `agent_action.running` → run **handler outside** DB txn → update to terminal status + `agent_action.<status>` audit.

**Handlers** ([`agent-handlers.ts`](../backend/src/lib/agent-handlers.ts)): in-process; no Prisma in context. Unregistered types use `defaultStubHandler` (`stubExecuted: true`). Production A2/A4 register real handlers at boot via `registerDefaultAgentHandlers()`.

### Important schema fact

`agent_actions` has **no `actionType` column**. The type is stored in:

- `inputPayload.actionType` (and related payload fields), and  
- `policyId` → `agent_tier_policies.actionType`.

List/detail APIs expose agent/tier/status; full payloads only on `GET …/agent-actions/:id` (decide_tier3 roles).

---

## 3. A4 Natural Language Agent v1 — end-to-end

### 3.1 Goal

Answer **1–2 grounded M4 questions** with a real LLM for **understanding**, while **Node** owns auth, RBAC, tools, and GT. The model must **never invent counts**.

### 3.2 Frontend → backend flow

UI entry is the shared Ask Agent 4 surface — not a separate chatbot:

| Piece | Role |
|-------|------|
| [`AgentPanel.jsx`](../frontend/src/components/c4/AgentPanel.jsx) | Sidebar “Ask Agent 4” + FAB; session gate via `verifySessionOnce`; submit lock; GT meta only on success |
| [`api.js`](../frontend/src/lib/api.js) `queryNlq(question)` | `POST /api/tenant/agent-actions/nlq/query` with JWT |
| Store nlq history **v2** | Local UI thread only (`source: live_a4`); archives pre-live mock as `legacyMock` |
| Exec dashboard | CTA opens the same panel — no fabricated PAR/EPF answers |

**Per turn:** user text → `queryNlq` → JSON `{ supported, answer?, dispatch?, … }`.  
- `supported: false` → polite scope message (*outside my current scope…*); **no** Agent Log row.  
- `supported: true` + `dispatched` → show grounded `answer` + optional tier / `actionId` / status.  
- HTTP **503** → “Currently unavailable” (Ollama down).

Browser never talks to Ollama. History in localStorage is **display only** — each request is a fresh question string with **no** prior turns sent to the model (**conversational memory deferred to A4 v2**).

### 3.3 HTTP entry

`POST /api/tenant/agent-actions/nlq/query`  
JWT + `resolveTenantContext` + `agents:query_nlq`  
Body: `{ "question": string }` (3–500 chars).

Implementation: `handleNlqQuery` in [`agent-governance.ts`](../backend/src/routes/agent-governance.ts).

### 3.4 Execution flow

```mermaid
sequenceDiagram
  participant UI as AgentPanel
  participant Route as handleNlqQuery
  participant Ollama
  participant Gate as resolveNlqIntentFromModel
  participant Tool as runNlqTool
  participant GT as dispatchAgentAction
  participant DB as TenantDB

  UI->>Route: POST /nlq/query JWT
  Route->>Route: validate question; query_nlq gate
  Route->>Ollama: intent JSON only (temp 0)
  alt unavailable
    Route-->>UI: 503 no dispatch
  else parse / evidence / days reject
    Route-->>UI: 200 supported false
  else tool RBAC deny
    Route-->>UI: 403 no dispatch
  else ok
    Route->>Gate: question + model JSON (evidence check)
    Route->>Tool: Prisma count on agent_actions
    Tool->>DB: aggregate only
    Route->>GT: nlq_query + grounded inputPayload
    GT->>DB: running then executed + audits
    Route-->>UI: answer + actionId + promptVersion
  end
```

**Why tools run before GT dispatch:** `ActionHandlerContext` has no `tenantPrisma`. Same pattern as A2 (evaluate, then dispatch). GT audits the **answer action**, not each read. Failures (Ollama, unsupported, 403) **do not** create rows.

### 3.5 Ollama role + prompt v2 evidence gate

[`ollama-client.ts`](../backend/src/lib/ollama-client.ts): `POST {OLLAMA_BASE_URL}/api/chat` with `format: "json"`, `options.temperature: 0`.

- Env: `OLLAMA_BASE_URL` (required), `OLLAMA_MODEL` (default `qwen2.5:1.5b`), `OLLAMA_TIMEOUT_MS` (default **30000** — cold load exceeded 15s in lab).  
- Fail-closed → `OllamaUnavailableError` → HTTP **503**.  
- System prompt (`A4_NLQ_PROMPT_VERSION = "a4-intent-v2"`) asks for intent JSON only; **default to `unsupported`**; few-shots include greetings → unsupported; **no numeric answers**.

Intent schema ([`agent-a4-nlq.ts`](../backend/src/lib/agent-a4-nlq.ts)):

- `count_pending_tier3`  
- `count_actions_window` (+ optional `days` 1–30, `agentId` A1–A4)  
- `unsupported`  

**Post-parse evidence gate** (`resolveNlqIntentFromModel` → `questionSupportsIntent`): if the model returns a *supported* intent but the user text lacks the expected cues (pending/awaiting + approval/tier‑3, or action/agent + how‑many/count/window cues), Node **downgrades to unsupported** and does **not** dispatch. This is fail-closed validation after the LLM — **not** a greeting blacklist and **not** replacing the model with hardcoded intent matching.

Out-of-range `days` (e.g. 90) → **unsupported response**, **no clamp**.

### 3.6 Tier 1 execution vs model intent correctness

These are **different claims** — do not conflate them in a viva:

| Claim | Meaning |
|-------|---------|
| Tier 1 `executed` | GT policy for `nlq_query` auto-ran the registered handler; audits show `running` → `executed`. Counts in the answer came from Node Prisma + templates. |
| Intent correctness | Ollama (plus the evidence gate) classified the *question* appropriately before tools ran. |

A wrong classification that still passes validation would produce a grounded answer to the **wrong** question type — still Tier 1 `executed`, still no invented numbers. Conversely, a greeting that the 1.5B model labels `count_pending_tier3` is rejected by the evidence gate → `supported: false`, **no** action (live UI verified). The gate **reduces false positives**; it may also **reject unusual but valid phrasings** that lack the expected lexical cues.

Payload / Agent Activity Log fields: `modelVersion: a4-nlq-ollama-v1`, `promptVersion: a4-intent-v2`.

### 3.7 Tool-level RBAC

Endpoint gate ≠ tool gate:

| Intent | Extra capability | Roles (typical) |
|--------|------------------|-----------------|
| `count_pending_tier3` | `agents:decide_tier3` | admin, executive, branch_manager |
| `count_actions_window` | `agents:view_actions` | all six roles with query_nlq today |

Finance / HR / loan officers have `query_nlq` but **not** `decide_tier3` → **403** on pending-count questions (confirmed in E2E with Apex finance officer).

### 3.8 Handler

`nlqQueryHandler` echoes grounded `answer` / `facts` from `inputPayload`. Missing facts → handler error → status `failed`. Success output includes `handler: "nlqQueryHandler"`, `stubExecuted: false`.

### 3.9 Live evidence

**Backend ZZ E2E (window count):**

| Check | Result |
|-------|--------|
| Institution | ZZ Test Org 1 `33b6545d-7c78-4354-a017-d0717efba3b8` |
| Action | `9f5f715b-455d-4ade-97ea-3412667a2a37` |
| Outcome | A4 Tier 1 `executed`, policy linked, no fallback |
| Answer | 4 A3 actions in last 7 days |
| Independent count | 4 rows with `agentId=A3` and `createdAt >= sinceIso` |
| Audits | one `agent_action.running`, one `agent_action.executed` |
| Negative paths | unsupported + days out of range → no new action |

**Frontend UI (Agent1 screenshot review):** real AgentPanel → backend; grounded answers + Tier 1 Agent Log; live log shows `a4-intent-v2`; greetings rejected with no action; unsupported uses the employee-friendly scope message; sidebar/FAB preserved; follow-ups / memory **explicitly out of v1**.

**Git at doc time:** backend A4 base on branch `m4/phase10-ai-agents` (`dba226c`); UI + intent-v2 + docs may still be uncommitted — confirm with `git status`. **Not** on `origin/main` until merge.

### 3.10 Why not LangChain / chat memory (yet)

Leader task list mentioned LangChain for A1–A4. **Current design defers it:** GT already orchestrates tiers; A4 needs a **fixed** intent schema and Node-owned tools; a thin Ollama client is enough for v1. **Conversational memory and follow-up resolution** (e.g. “and for A2?”) are **A4 v2** — v1 sends only the current question string. Revisit LangChain if multi-step tool chains or retrieval become requirements.

### 3.11 Small Qwen limitations

`qwen2.5:1.5b` is fast on homelab but can mis-intent or return non-JSON (→ 422). Cold start can be slow (timeout raised to 30s). Prompt-only correction was **insufficient** for greeting over-fire; evidence gate + `temperature: 0` are the reliable v1 net. Remaining limits: odd valid phrasings may be rejected; no multi-turn context; aggregates only. **Safety net:** schema validation + evidence gate + grounded tools + no model numbers in answers.

---

## 4. A2 Workflow (budget threshold) v1

**Endpoint:** `POST /api/tenant/agent-actions/budget-threshold/evaluate`  
**Code:** [`agent-a2-budget.ts`](../backend/src/lib/agent-a2-budget.ts), handler `budgetThresholdAlertHandler`.

- Caller supplies `metricName`, `metricValue`, `threshold` (`source` must be `manual_api_v1`).  
- Breach iff `metricValue >= threshold` → dispatch `budget_threshold_alert` → Tier **2** → status **`notified`** (Agent Log only; no email/SMS).  
- Soft 24h dedupe on `dedupeKey`; `?allowDuplicate=true` bypasses.  
- RBAC: `decide_tier3` **or** `finance:manage_ledger`.  
- Offline: `npm run verify:a2-budget`. Merged via **PR #21**.

**Limit:** No automatic M2 ledger monitoring until M2 exposes budget APIs.

---

## 5. A3 Anomaly (Isolation Forest)

**Runtime:** FastAPI under [`agents/`](../agents/) — score with **a3-iforest-v2** (RobustScaler → Isolation Forest).  
**Dispatch:** optional POST to Node `POST /api/internal/agent-actions/dispatch` with `AGENT_SERVICE_KEY`; allowlist **`volume_spike_alert` only**, Tier 4 / A3 policy required.

- Scores are **non-probabilistic**; UI “Confidence %” can mislead.  
- Known weak recall on `amount_spike`.  
- Artifacts gitignored; train/eval under `agents/ml/`.  
- Merged via **PR #20**. Keep `ENABLE_DISPATCH_STUB=false` unless approved.

---

## 6. A1 Compliance Readiness v1

**Goal:** Grounded **CBSL readiness / data-gap package** (`reportKind: cbsl_readiness_v1`) under existing actionType `generate_cbsl_report` → policy Tier **3**. **Not** an official CBSL submission. No invented financial or regulatory figures. No LLM in v1.

**Code:** [`agent-a1-compliance.ts`](../backend/src/lib/agent-a1-compliance.ts), handler `cbslReadinessHandler`, route `POST /api/tenant/agent-actions/cbsl-report/prepare`.

### Flow

1. Validate period (default last 30 days).  
2. Collect tenant facts: `tenant_info`, branches, employees (incl. missing EPF/ETF counts), payroll counts, agent/audit aggregates, optional loan/borrower/journal counts as **availability slots**.  
3. Deterministic rules → `dataGaps` / `inferredRisks` / `recommendations` / `overallStatus` (`not_ready` | `ready_with_warnings` | `evidence_complete_for_scoped_checks`). Missing evidence is **never** “compliant.”  
4. `dispatchAgentAction(generate_cbsl_report)` → `pending_approval` + engine audit; `inputPayload` includes `report`, `proposalHash`, **`preparedByUserId`**.  
5. Extra audit **`a1_readiness.prepared`** (actor = preparer) stores the same `proposalHash` / preparer — binding **outside** the action row alone. **Not** cryptographic immutability against a DB admin who rewrites both.  
6. Human reviews A1 summary on `/tier-approval` (status, period, gaps, recommendations, preparer, disclaimer); raw JSON expandable.  
7. **Approve (A1-only gate before `decideTier3Action`):** deny if preparer missing (legacy fail-closed), approver === preparer (**SoD**), prepare audit missing, or audit/`report` hash mismatch. Then handler re-checks payload self-hash → `executed`. **Reject** unchanged (no handler). Other Tier 3 types unaffected.

**RBAC:** Prepare = `agents:decide_tier3` **or** `finance:manage_ledger`. Approve/reject = `decide_tier3` only (finance can prepare but not approve). Still use **two different users** when both have decide_tier3 (e.g. admin prepare blocked from self-approve).

**Offline:** `npm run verify:a1-compliance` (62/62). **Live ZZ E2E verified:**  
- Approve/execute: `241418c5-a85a-46b6-acdb-0212daadd390` (finance prepare → admin approve; real handler; hash match).  
- Reject: `83efcab0-5561-4954-aca9-66d8faa3c1ec` (finance → executive; no handler / no executed audit).  
- SoD: `805a063d-fca4-4572-b475-271a9b72a8f1` (BM prepare → BM approve **403** → executive reject cleanup).  

**Limits:** `cbsl_readiness_v1` only (not official CBSL); sparse tenants often `not_ready`; prepare-audit hash binding is not DB-admin-proof.

**External datasets (PAR/MIX/Findex):** not used in A1 ops (Option A).

---

## 7. Status matrix (accurate language)

| Feature | Implemented | Offline tested | Live E2E | On `origin/main` | UI |
|---------|-------------|----------------|----------|------------------|-----|
| GT engine / Agent Log | yes | yes | yes | yes | real c4 screens |
| A3 IF + dispatch | yes | yes | yes | yes | Agent Log |
| A2 budget evaluate | yes | yes | yes | yes | Agent Log |
| A4 NLQ (+ intent-v2 gate) | yes | yes (`verify:a4-nlq`) | yes (ZZ + UI) | **not yet** | **live AgentPanel** |
| A4 conversational memory | no | — | — | — | deferred **A4 v2** |
| A1 readiness (`cbsl_readiness_v1`) | yes | yes (`verify:a1-compliance`) | **yes (ZZ)** | **not yet** | Tier Approval / Agent Log |
| LangChain | no | — | — | — | deferred |

---

## 8. Tenant isolation reminder

- Each MFI has its own physical DB; tenant tables do **not** store `institution_id`.  
- Always use `req.tenantPrisma` after JWT resolution.  
- **ZZ E2E:** resolve institution `33b6545d-…` via **central** — local `TENANT_DATABASE_URL` often points at a **different** demo tenant.

---

## 9. Practical viva Q&A

**Q: Who decides the trust tier for an agent action?**  
A: Only the active `agent_tier_policies` row for that `actionType`. Clients cannot send `tier`. Missing policy → fallback Tier 4.

**Q: Why can A4 call Ollama but still not invent a “4”?**  
A: Ollama returns intent JSON. Node runs `agentAction.count` and fills a template. Model `count` fields are ignored by the parser.

**Q: Does Tier 1 `executed` prove the model understood the question?**  
A: No. It proves GT auto-ran the grounded `nlq_query` handler after Node accepted an intent and computed facts. Intent quality is a separate concern (prompt v2 + evidence gate).

**Q: What is the A4 evidence gate?**  
A: After Ollama returns a supported intent, `questionSupportsIntent` checks the user text for pending/approval or action/count cues. Missing evidence → `unsupported`, no dispatch. Cuts 1.5B false positives (e.g. “Hello”); may reject odd valid phrasings.

**Q: Does Ask Agent 4 remember prior turns?**  
A: Not in v1. The panel may show a local chat thread, but each API call sends only the current question. Multi-turn / follow-ups are A4 v2.

**Q: Where is `nlq_query` stored on the action row?**  
A: Not as a column. See `inputPayload.actionType` and `policyId` → policy.actionType. Also look for `promptVersion: a4-intent-v2` in the payload / activity log.

**Q: Why did Apex finance get 403 on “pending approvals” but can ask Agent Log counts?**  
A: Pending tool needs `agents:decide_tier3`; window count needs `agents:view_actions`. `agents:query_nlq` alone opens the endpoint, not every tool.

**Q: Why tools before `dispatchAgentAction`?**  
A: Handlers have no Prisma; A2 already evaluates then dispatches; failed intents must not create GT rows.

**Q: Difference between A2 `notified` and A4 `executed`?**  
A: Tier 2 success → `notified` (notify semantics / Agent Log). Tier 1 success → `executed`.

**Q: How does A3 reach GT without a user JWT?**  
A: Internal service key + allowlisted `volume_spike_alert` only; Node still resolves tenant and policy.

**Q: Why defer LangChain?**  
A: GT + fixed intents + Node tools already meet v1; LangChain adds weight without clear gain until multi-step agents are required.

**Q: What breaks if Ollama is down?**  
A: A4 returns 503; no action row. A2/A3 unaffected.

**Q: Soft dedupe race on A2?**  
A: Two concurrent breaches can both pass the soft check (TOCTOU); unique index deferred.

**Q: Is A1 an official CBSL report generator?**  
A: No. It produces `cbsl_readiness_v1` — facts, gaps, and recommendations from tenant evidence. Blocking gaps → `not_ready`. Never invents CBSL line items.

**Q: Why is Tier 3 valuable for A1 if the report is “just JSON”?**  
A: Prepare binds a proposal (`proposalHash` + preparer) in the payload and a prepare audit. A different user must approve; self-approve is rejected. Hash mismatches fail closed. This is workflow integrity, not absolute crypto against DB admins.

**Q: Can the preparer approve their own A1 package?**  
A: No — server returns 403 when `preparedByUserId` equals the approver.

**Q: Does A1 use an LLM?**  
A: Not in v1. Deterministic rules only (same honesty bar as A4’s grounded counts).

---

## 10. Commands (offline)

```powershell
cd backend
npm run verify:a1-compliance
npm run verify:a2-budget
npm run verify:a4-nlq
npx tsc --noEmit -p tsconfig.json
```

A3: see [`agents/README.md`](../agents/README.md).

---

## 11. Further reading

- [`M4_AGENT_HANDOVER.md`](./M4_AGENT_HANDOVER.md) — status, ADRs, next Git steps  
- [`M4_INTEGRATION_GUIDE.md`](./M4_INTEGRATION_GUIDE.md) §13 — API surface for M1–M3  
- [`agents/README.md`](../agents/README.md) — A3 ops  

When this walkthrough disagrees with the repo, fix the walkthrough.
