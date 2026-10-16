# M4 Technical Walkthrough (study / viva)

> Companion to [`M4_AGENT_HANDOVER.md`](./M4_AGENT_HANDOVER.md).  
> **Code and Git beat this document.** Last aligned: 2026-10-16 (A4 ZZ E2E verified).

This note explains how Component 4 (M4) runs Graduated Trust and agents A1–A4 in the IMFS / MicroFlow repo, with enough detail for a viva without pasting whole modules.

---

## 1. What M4 owns

IMFS is split into research components. **M4 (C4)** provides:

- Multi-tenant auth (JWT), RBAC capabilities, institution provisioning  
- Tenant DB routing (`req.tenantPrisma`)  
- Graduated Trust: policies, `dispatchAgentAction`, Agent Log, Tier 3 approve/reject, overrides  
- Agent runtimes that M4 controls: **A2** (Node rules), **A3** (Python IF + Node dispatch), **A4** (Node + Ollama intent), **A1** (policy reserved; not implemented)

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

### 3.2 HTTP entry

`POST /api/tenant/agent-actions/nlq/query`  
JWT + `resolveTenantContext` + `agents:query_nlq`  
Body: `{ "question": string }` (3–500 chars).

Implementation: `handleNlqQuery` in [`agent-governance.ts`](../backend/src/routes/agent-governance.ts).

### 3.3 Execution flow

```mermaid
sequenceDiagram
  participant Client
  participant Route as handleNlqQuery
  participant Ollama
  participant Tool as runNlqTool
  participant GT as dispatchAgentAction
  participant DB as TenantDB

  Client->>Route: POST /nlq/query JWT
  Route->>Route: validate question; query_nlq gate
  Route->>Ollama: intent JSON only
  alt unavailable
    Route-->>Client: 503 no dispatch
  else unsupported or days out of range
    Route-->>Client: 200 supported false
  else tool RBAC deny
    Route-->>Client: 403 no dispatch
  else ok
    Route->>Tool: Prisma count on agent_actions
    Tool->>DB: aggregate only
    Route->>GT: nlq_query + grounded inputPayload
    GT->>DB: running then executed + audits
    Route-->>Client: answer + actionId
  end
```

**Why tools run before GT dispatch:** `ActionHandlerContext` has no `tenantPrisma`. Same pattern as A2 (evaluate, then dispatch). GT audits the **answer action**, not each read. Failures (Ollama, unsupported, 403) **do not** create rows.

### 3.4 Ollama role

[`ollama-client.ts`](../backend/src/lib/ollama-client.ts): `POST {OLLAMA_BASE_URL}/api/chat` with `format: "json"`.

- Env: `OLLAMA_BASE_URL` (required), `OLLAMA_MODEL` (default `qwen2.5:1.5b`), `OLLAMA_TIMEOUT_MS` (default **30000** — cold load exceeded 15s in lab).  
- Fail-closed → `OllamaUnavailableError` → HTTP **503**.  
- System prompt asks for intent JSON only; **no numeric answers**.

Intent schema ([`agent-a4-nlq.ts`](../backend/src/lib/agent-a4-nlq.ts)):

- `count_pending_tier3`  
- `count_actions_window` (+ optional `days` 1–30, `agentId` A1–A4)  
- `unsupported`  

Out-of-range `days` (e.g. 90) → **unsupported response**, **no clamp**.

### 3.5 Tool-level RBAC

Endpoint gate ≠ tool gate:

| Intent | Extra capability | Roles (typical) |
|--------|------------------|-----------------|
| `count_pending_tier3` | `agents:decide_tier3` | admin, executive, branch_manager |
| `count_actions_window` | `agents:view_actions` | all six roles with query_nlq today |

Finance / HR / loan officers have `query_nlq` but **not** `decide_tier3` → **403** on pending-count questions (confirmed in E2E with Apex finance officer).

### 3.6 Handler

`nlqQueryHandler` echoes grounded `answer` / `facts` from `inputPayload`. Missing facts → handler error → status `failed`. Success output includes `handler: "nlqQueryHandler"`, `stubExecuted: false`.

### 3.7 Live E2E evidence (ZZ)

| Check | Result |
|-------|--------|
| Institution | ZZ Test Org 1 `33b6545d-7c78-4354-a017-d0717efba3b8` |
| Action | `9f5f715b-455d-4ade-97ea-3412667a2a37` |
| Outcome | A4 Tier 1 `executed`, policy linked, no fallback |
| Answer | 4 A3 actions in last 7 days |
| Independent count | 4 rows with `agentId=A3` and `createdAt >= sinceIso` |
| Audits | one `agent_action.running`, one `agent_action.executed` |
| Negative paths | unsupported + days out of range → no new action |

**Git status at doc time:** A4 source is in the **working tree**, not yet on `origin/main` — treat as “E2E proven, pending commit/PR”.

### 3.8 Why not LangChain (yet)

Leader task list mentioned LangChain for A1–A4. **Current design defers it:** GT already orchestrates tiers; A4 needs a **fixed** intent schema and Node-owned tools; a thin Ollama client is enough for v1. Revisit if multi-step tool chains or retrieval become requirements.

### 3.9 Small Qwen limitations

`qwen2.5:1.5b` is fast on homelab but can mis-intent or return non-JSON (→ 422). Cold start can be slow (timeout raised to 30s). **Safety net:** schema validation + grounded tools + no model numbers in answers.

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

## 6. A1 Compliance (planned)

Policy `generate_cbsl_report` → A1 Tier **3** exists in defaults/seed. **No real report handler or evaluate route yet** — would stay `pending_approval` until humans approve and a handler is registered. Do not describe A1 as implemented.

---

## 7. Status matrix (accurate language)

| Feature | Implemented | Offline tested | Live E2E | On `origin/main` | UI |
|---------|-------------|----------------|----------|------------------|-----|
| GT engine / Agent Log | yes | yes | yes | yes | real c4 screens |
| A3 IF + dispatch | yes | yes | yes | yes | Agent Log |
| A2 budget evaluate | yes | yes | yes | yes | Agent Log |
| A4 NLQ | yes | yes (`verify:a4-nlq`) | yes (ZZ) | **not yet** | exec NLQ still **mock** |
| A1 CBSL | policy only | n/a | no | policy defaults | n/a |
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

**Q: Where is `nlq_query` stored on the action row?**  
A: Not as a column. See `inputPayload.actionType` and `policyId` → policy.actionType.

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

---

## 10. Commands (offline)

```powershell
cd backend
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
