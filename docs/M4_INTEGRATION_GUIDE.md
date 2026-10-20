# IMFS — M4 Integration Guide (for M1, M2 & M3)

Welcome! This guide explains how Component 1 (Credit Risk), Component 2 (Finance Engine), and Component 3 (Loan Lifecycle & EWS) integrate with Component 4 (Multi-Tenant Routing, Auth & RBAC).

---

## 1. Golden Rules (Must Read)

1. **Database Isolation**:
   - Each microfinance institution has its own physical database (`imfs_tenant_<name>`).
   - Tables in the tenant database **never** store `institution_id` — the database itself is the tenant boundary.
   - **Never create your own PrismaClient** or connection string in route handlers. Always use `req.tenantPrisma`.
2. **Component Boundaries**:
   - Work strictly in your module's tables.
   - **Never write directly into another module's tables**. Cross-component communication must happen through APIs or events.
3. **Soft User References**:
   - Central users (`central.users`) and tenant tables live in separate physical databases.
   - Columns like `submitted_by`, `reviewed_by`, or `officer_id` are **soft references** (UUIDs without database foreign keys).
   - You must validate these user IDs in application code before saving.

---

## 2. After You Pull (Checklist & Environment Setup)

Whenever you pull changes from `main` or `m4/*`, follow this checklist in order:

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Configure your `.env`**:
   Ensure you have a `JWT_SECRET` configured in `backend/.env`.
   - Must be at least 32 characters long.
   - Generate your own secret (e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
   - **Never commit `.env` or share your secret.**
   ```dotenv
   JWT_SECRET="your-own-secure-secret-minimum-32-characters"
   JWT_EXPIRES_IN="15m"
   ```
3. **Database Port Assignment**:
   Use **your own component's dedicated database port only**:
   - **M1**: 5433
   - **M2**: 5434
   - **M3**: 5435
   - **M4**: 5436
   *(Never use 5437 or another component's port.)*
4. **Apply Tenant Database Migration**:
   Apply migration `20261013143500_graduated_trust_audit` to **your own tenant databases only**:
   Set `TENANT_DATABASE_URL` in your own shell to ONE of your own tenant databases (use your own credentials, never commit them), run `prisma migrate deploy`, then repeat for your next tenant database:
   ```bash
   npx prisma migrate deploy --schema prisma/tenant/schema.prisma
   ```
   - **Important**: Always use `prisma migrate deploy` against your own databases. Never run `prisma migrate dev` against a shared database, and never run `prisma migrate reset`.
5. **Regenerate Tenant Prisma Client**:
   Stop the backend server first, then regenerate the client:
   ```bash
   npx prisma generate --schema prisma/tenant/schema.prisma
   ```
   > [!WARNING]
   > **Consequence of Skipping Migration**:
   > The tables `agent_tier_policies`, `agent_actions` and audit_log columns `actor_type` and `details` already existed previously. This migration adds the following new columns, and agent routes fail without them:
   > - `agent_tier_policies.agent_id`
   > - `agent_actions.agent_id`, `decision_reason`, `is_override`, `model_version`, `processing_time_ms`, `prompt_version`, `tools_used`
   > - `audit_log.ip_address`, `user_agent`

---


## 3. How to Mount a Module Router (Auth & Roles)

In Express, mount your router strictly behind the M4 middleware chain in this exact order:
**`authenticate` -> `resolveTenantContext` -> `requireRole(...)`**

1. `authenticate`: Verifies JWT signature and expiry, attaching `req.user`.
2. `resolveTenantContext`: Resolves the tenant physical database connection pool, attaching `req.tenantPrisma`.
3. `requireRole(...)`: Enforces role-based permissions per endpoint.

> [!IMPORTANT]
> **Module Table Isolation**:
> Modules must **never write directly into another module's tables**. Cross-component communication must happen strictly through public module APIs or asynchronous events.

```typescript
import { Router } from "express"
import {
  authenticate,
  resolveTenantContext,
  requireRole,
} from "../middleware/auth.js"

export const myModuleRouter = Router()

// Step 1: Require authentication & resolve tenant DB client
myModuleRouter.use(authenticate, resolveTenantContext)

// Step 2: Define your routes with role protection
// Example A: Accessible by any authenticated staff member in this MFI
myModuleRouter.get("/dashboard-summary", async (req, res) => {
  // Read current user info
  const { userId, role, institutionId } = req.user!

  // Query caller's tenant database safely
  const branches = await req.tenantPrisma!.branch.findMany()
  res.json({ data: branches })
})

// Example B: Restricted to specific roles
myModuleRouter.post(
  "/loan-assessments",
  requireRole("loan_officer", "branch_manager"),
  async (req, res) => {
    // req.user!.role is guaranteed to be one of the allowed roles
  }
)
```

---

## 4. Role Catalog & Permissions Map

The 6 system-wide roles are:
- `admin`: Institution system administrator.
- `executive`: C-suite / director oversight and governance.
- `finance_officer`: Head of finance, ledger, payments, and CBSL returns.
- `hr_officer`: Staffing, branch assignments, and payroll.
- `branch_manager`: Branch-level approvals and operations.
- `loan_officer`: Field collections, borrower KYC, and loan origination.

Permissions map is available in [`src/lib/permissions.ts`](file:///d:/Projects/Git/SLIIT/Research/j26it326/backend/src/lib/permissions.ts). You can import `hasCapability(role, capability)` to check permissions dynamically.

---

## 5. Validating Soft User References (`validateUserId`)

Before saving a `user_id` to a tenant table (such as `risk_assessments.user_id` or `loans.submitted_by`):

```typescript
import { validateUserId } from "../lib/auth.js"

// In your route handler:
const check = await validateUserId(submittedByUserId, req.user!.institutionId)

if (!check.valid) {
  res.status(400).json({ error: "Invalid officer reference" })
  return
}
```

Or via HTTP endpoint:
```http
GET /api/tenant/users/:userId/validate
Authorization: Bearer <token>
```
Response:
```json
{
  "valid": true
}
```

---

## 6. Testing with Bruno

The shared Bruno collection is under `docs/bruno/IMFS`:
1. Open Bruno and open collection `docs/bruno/IMFS`.
2. Select environment **Local**.
3. Under folder `01 Auth`, run `01 Login Success`:
   - It will log in and automatically save the access token to `{{authToken}}`.
4. Subsequent requests in `02 Tenant`, `10 M1 Risk`, `20 M2 Finance`, or `30 M3 Loans` inherit or use `{{authToken}}`.

---

## 7. Frontend Integration & Mock Authentication

### Real Token Flow
When calling backend APIs from React:
```typescript
const response = await fetch("http://localhost:4000/api/tenant/info", {
  headers: {
    Authorization: `Bearer ${localStorage.getItem("imfs_access_token")}`,
  },
})
```

### Mock Auth for Early Frontend Work
If you want to test frontend screens before connecting the real login screen:
- **Apex demo:** Run `backend/scripts/seed-test-users.ts` (with user approval) for `*@apex.lk` accounts.
- **ZZ Test Org 1 (preferred for M4 E2E / A1 SoD):**
  `ALLOW_ZZ_TEST_USER_SEED=1` and `npm run seed:zz-test-users` from `backend/`.
  Creates `executive` / `branch_manager` / `finance_officer` / `hr_officer` / `loan_officer` on institution `33b6545d-…` only.
  Does **not** modify `admin@zz-test-org1.lk`. Requires `NODE_ENV !== production`.
  Credentials → local gitignored `backend/.zz-test-credentials.local` (never commit; script does not print passwords).
  Idempotent skip if accounts already valid; mismatches abort without writes.
  Disable later: set that user’s `status` to `disabled` in central.
- Or acquire a valid token once via `POST /auth/login` in Bruno, copy it, and store it in your frontend dev state:
  ```typescript
  // In development helper:
  localStorage.setItem("imfs_access_token", "<token-from-bruno-or-login>")
  ```

---

## 8. Interactive API Documentation

Interactive Swagger documentation is served by the backend:
- **Swagger UI**: `http://localhost:4000/docs`
- **Raw OpenAPI JSON**: `http://localhost:4000/openapi.json`

*(Available in development by default. In production, it is disabled unless `ENABLE_SWAGGER_DOCS=true` is set in `.env`.)*

---

## 9. Troubleshooting

| Symptom | Cause | Solution |
|---|---|---|
| **Server fails to start with "FATAL: JWT configuration error"** | `JWT_SECRET` is missing, placeholder, or < 32 characters in `.env`. | Add a secure secret with at least 32 characters to `backend/.env`. |
| **`401 Unauthorized: Missing or invalid Authorization header`** | Request has no `Authorization: Bearer <token>` header. | Add the Bearer token in your request headers. |
| **`401 Unauthorized: Invalid or expired token`** | Token has expired (15m default) or secret mismatch. | Run `01 Login Success` in Bruno to fetch a fresh token. |
| **`403 Forbidden: Access denied. Role '...' is not authorized`** | The logged-in user does not have permission for that route. | Log in with a user possessing the required role. |
| **`403 Forbidden: Token institution does not match user institution`** | Forged token or cross-tenant access attempt. | Tokens can only query the tenant database of their own institution. |
| **`Cannot find module '...'` after pulling** | New packages were introduced. | Run `npm install` inside the `backend` folder. |

---

## 10. Phase 5: Email-Domain Tenant Locking & Staff Self-Registration

Phase 5 introduces corporate email domain claims, automated email verification links, self-service staff signup, and administrator approval workflows.

### Domain Lifecycle

1. **Register Domain Claim** (`POST /api/tenant/domains`):
   - Restricted to authenticated `admin`.
   - Rejects public/disposable free-mail domains (Gmail, Yahoo, Hotmail, etc.) and public suffixes (`.lk`, `.co.uk`, etc.).
   - Rejects assigning the `admin` role as `defaultRoleId`.
   - Sends a 64-character verification token link to `<verificationMailbox>@<domain>`.
2. **Verify Claim** (`POST /auth/domains/verify`):
   - Public endpoint accepting `{ "token": "<hex-token>" }`.
   - Hashes the token with SHA-256 and matches against `verification_token_hash`.
   - Marks domain as `verified` (enforced globally unique across active verified domains via partial index).
   - > [!IMPORTANT]
     > **Frontend Notice for `/verify-domain` page**:
     > The token is single-use and consumed upon first verification. React 19 `StrictMode` (dev mode runs effects twice) runs `useEffect` twice on mount. The frontend component must guard against a double `POST` (e.g., via an `isSubmitting` ref or latch) so the user doesn't encounter a false 400 error on the second call.
3. **Resend Verification** (`POST /api/tenant/domains/:domainId/resend`):
   - Admin can request a fresh token (valid 24h) for unverified pending domains. Requires `{ "verificationMailbox": "admin" }` in the request body (validated with `^[a-z0-9._-]{1,64}$`).
4. **Revoke Domain** (`DELETE /api/tenant/domains/:domainId`):
   - Admin-only. If the domain was `verified`, atomically marks domain as `revoked` and disables all active and pending users on that domain.
   - If the domain was `pending`, marks it `revoked`, clears the verification token, and disables no users (`deactivatedUsersCount: 0`).
   - Guarded against removing the institution's last active admin (returns `409 Conflict`).
   - Evicts all affected users from the in-memory 5-second auth cache (`invalidateUserAuthCache`).

### Staff Self-Registration & Approval

1. **Staff Registration** (`POST /auth/signup`):
   - Accepts `{ "email", "password", "fullName" }`.
   - Requires email domain to match an existing `verified` domain for an active institution.
   - User is created with `status: "pending"` and the domain's `default_role_id`.
   - Returns uniform 201 timing-parity response to prevent email enumeration.
2. **Pending User Login Behavior** (`POST /auth/login`):
   - Validates password first.
   - If password is valid but user status is `"pending"`, returns `403 Forbidden`:
     ```json
     { "error": "Your account is pending administrator approval. Please contact your institution administrator." }
     ```
   - > [!IMPORTANT]
     > **Frontend Notice for Login**:
     > Frontend login components must inspect the 403 response message and display an informative notice to pending users ("Account Pending Approval") rather than treating it as an invalid username or password. Disabled users receive a generic `401 Unauthorized` to prevent account enumeration.
3. **Review & Approval** (`GET /api/tenant/pending-users`, `POST /api/tenant/pending-users/:userId/approve`, `POST /api/tenant/pending-users/:userId/reject`):
   - Admin can view pending users awaiting approval for their institution.
   - Admin can approve with default role or optionally assign a non-admin role (`{ "roleId": 3 }`). Approval re-checks domain status and immediately activates the user.
   - Admin can reject registration, setting user status to `disabled`.
   - Both actions evict the target user from `invalidateUserAuthCache`.

> [!CAUTION]
> **Production Deployment Requirement**:
> Production deployments must explicitly set `NODE_ENV=production` in environment variables. The `ConsoleEmailService` only fails closed (throwing if no production SMTP transport is configured) when `NODE_ENV` is exactly `"production"`. In any other environment, it logs verification links to stdout.

---

## 11. Institution Registration & Tenant Provisioning (Phase 6)

IMFS supports public self-service onboarding for new microfinance institutions via `POST /auth/register-institution`.

### Public Endpoint: `POST /auth/register-institution`
- **Access**: Public / Unauthenticated (controlled via abuse guards).
- **Abuse Gate**: Gated by `ENABLE_PUBLIC_TENANT_REGISTRATION=true`. In production (`NODE_ENV=production`), the `x-registration-setup-key` header matching `REGISTRATION_SETUP_KEY` is strictly required (timing-safe comparison). Returns `403 Forbidden` if disabled or invalid.
- **Concurrency Guard**: Limited to max 2 concurrent provisioning operations in-process (`MAX_CONCURRENT_PROVISIONING`), returning `503 Service Unavailable` when exceeded.

### Request Payload:
```json
{
  "institutionName": "Apex Microfinance Ltd",
  "licenseNumber": "MFI-LK-001",
  "adminFullName": "Anura Perera",
  "adminEmail": "admin@apex.lk",
  "adminPassword": "SecurePassword123!",
  "institutionType": "microfinance_ngo",
  "district": "Colombo",
  "planName": "Starter",
  "billingCycle": "monthly"
}
```

### Validation & Behavior:
1. **Institution Type**: Must be one of `licensed_finance_company | microfinance_ngo | rural_development_bank | cooperative_society`.
2. **District**: Case-insensitive match against the 25 official Sri Lankan districts.
3. **Password**: UTF-8 byte length strictly between 8 and 72 bytes (bcrypt truncation safe limit).
4. **Pre-Hijack Mitigation & Timing Parity**:
   - If `adminEmail` is already registered, or if the email domain matches an existing `verified` domain claim, registration returns a generic `400 Bad Request` (`{"error": "Registration request could not be processed"}`) after running constant-time dummy bcrypt work.
   - > [!NOTE]
     > **Known Security Gap**: Admin emails are activated immediately upon provisioning without prior email inbox verification. Email domain verification (Phase 5) remains an optional administrative step post-registration.
5. **Physical Provisioning Sequence**:
   - Creates a dedicated PostgreSQL tenant database named `imfs_tenant_<slug>_<8hex>` on port 5436.
   - Applies tenant schema migrations (`prisma/tenant/schema.prisma`) using Node's `execFile` with local Prisma CLI.
   - Bootstraps tenant data: `tenant_info` (id 1), Head Office branch with district, and admin employee.
   - Atomic rollback: If any step fails, the newly created physical database is safely dropped and all central records deleted.
6. **Response Shape (`201 Created`)**:
   - Returns only institution and admin metadata. Internal database identifiers (`dbIdentifier`, `dbHost`) are strictly excluded:
     ```json
     {
       "message": "Institution registered and provisioned successfully",
       "institution": { "id": "uuid", "name": "Apex Microfinance Ltd", "status": "active" },
       "admin": { "id": "uuid", "email": "admin@apex.lk", "fullName": "Anura Perera", "role": "admin" }
     }
     ```

> [!WARNING]
> **Provisioning Duration & Wizard Timeout (Phase 7 Notice)**:
> Physical database creation and migration deployment takes between 3 to 8 seconds. The frontend onboarding wizard must show an explicit progress/loading state and configure an HTTP client timeout of at least 30 seconds.

> [!CAUTION]
> **Prisma CLI Packaging in Production**:
> The `prisma` package is listed in `devDependencies`. In production container deployments where devDependencies are pruned (`npm install --omit=dev`), the CLI script will be absent. Production Docker images must either retain the Prisma CLI or execute migrations via a dedicated migration runner container.

---

## 12. Security Hardening A: Rate Limiting & Account Lockout

Component 4 enforces bounded in-memory sliding window rate limiters and multi-tier account lockout on all public endpoints and tenant admin surfaces.

### Architecture & Per-Process Storage Limitation
- **In-Process Memory**: Limiters utilize high-performance in-memory sliding window stores with zero external dependencies.
- > [!WARNING]
  > **Per-Process Memory Limitation**:
  > Counters and lockout states are tracked **per backend Node.js process**. When running multiple backend replicas in production behind a round-robin load balancer, an attacker's attempts could be distributed across processes. For horizontally scaled deployments, counters and lockouts must be backed by a centralized store such as **Redis** or Memcached.

### Protected Endpoints & Configurable Limits
All thresholds are configurable via environment variables in `backend/.env` (documented in `backend/.env.example`):

| Endpoint | Protection Tier | Default Limit | Window / Duration | Env Variables |
| :--- | :--- | :--- | :--- | :--- |
| `POST /auth/login` | Total IP Request Cap | 200 requests | 15 min | `RATE_LIMIT_LOGIN_IP_TOTAL_MAX`, `..._WINDOW_MS` |
| `POST /auth/login` | Failed IP Attempts | 20 failed attempts | 15 min | `RATE_LIMIT_LOGIN_IP_FAIL_MAX`, `..._WINDOW_MS` |
| `POST /auth/login` | Pair Lockout `(email\|ip)` | 5 failed attempts | 15 min lock | `LOCKOUT_PAIR_FAIL_MAX`, `..._WINDOW_MS`, `..._DURATION_MS` |
| `POST /auth/login` | Aggregate Email Lockout | 100 failed attempts | 15 min lock | `LOCKOUT_EMAIL_FAIL_MAX`, `..._WINDOW_MS`, `..._DURATION_MS` |
| `POST /auth/signup` | Staff Self-Registration | 10 requests | 1 hour | `RATE_LIMIT_SIGNUP_MAX`, `..._WINDOW_MS` |
| `POST /auth/domains/verify` | Domain Token Verify | 20 requests | 1 hour | `RATE_LIMIT_VERIFY_DOMAIN_MAX`, `..._WINDOW_MS` |
| `POST /auth/register-institution` | Tenant Onboarding | 3 requests | 1 hour | `RATE_LIMIT_REGISTER_INSTITUTION_MAX`, `..._WINDOW_MS` |
| `/api/tenant/*` (mutating) | Domain & Staff Mutations | 30 requests | 15 min / institution | `RATE_LIMIT_ADMIN_TENANT_MAX`, `..._WINDOW_MS` |

> [!WARNING]
> **Aggregate Email Lockout Trade-Off & Future Mitigations**:
> While pair lockout (`email|ip`) prevents an attacker from locking out a user from a different IP, the secondary aggregate lockout (100 failures/hour across all IPs) exists to mitigate large-scale distributed brute-force attacks. However, this creates a trade-off: a determined distributed attacker can still trigger a temporary 15-minute lockout for a known email address. Future enhancements (e.g. Agent 3 anomaly scoring, known-IP exemptions, CAPTCHA challenges, or TOTP/MFA) will be evaluated under separate approvals.

### Security Properties
1. **Timing Parity on Locked Path**:
   When an account or IP pair is locked, requests to `POST /auth/login` still execute `comparePassword(password, DUMMY_HASH)` (~80ms bcrypt) to maintain constant response timing with standard authentication checks.
2. **Oracle Prevention**:
   Every non-success login outcome (unknown email, invalid password, pending status, disabled status, provisioning/inactive institution) increments the failure counters identically. Counters reset to zero only upon a fully successful authenticated login.
   - Crucially, `clearLoginCounters()` clears the `(email|ip)` pair and aggregate email counters, but **preserves the IP failed-attempts counter**. This prevents an attacker with a valid account from alternating failures on victim accounts and successes on their own account to repeatedly wipe their IP's failure history.
3. **No Account Enumeration**:
   Responses for rate limits and lockouts return an identical generic HTTP 429 payload:
   ```json
   { "error": "Too many requests. Please try again later." }
   ```
   accompanied by a standard `Retry-After: <seconds>` HTTP response header.
4. **Bounded Memory & 3-Tier Eviction**:
   Each limiter operates within an isolated `BoundedStore` capped at `RATE_LIMIT_MAX_ENTRIES` (default 10,000 entries). When full, entries are evicted in priority order:
   - Expired entries are swept first.
   - Unlocked entries are evicted second via LRU (`lastSeen`).
   - Actively locked targets are evicted only if 100% of the store capacity consists of active locks.
5. **Reverse Proxy & Client IP (`TRUST_PROXY`)**:
   - `TRUST_PROXY=false` in local development (direct socket IP).
   - In production behind a single reverse proxy (Railway, Render, Fly.io), set `TRUST_PROXY=1`.
   - `TRUST_PROXY=true` trusts all headers and must **not** be used when the service is directly addressable from the internet.
   - The backend validates `TRUST_PROXY` at startup and fails closed to `false` on unrecognized values.
6. **Admin Mutation Limiting**:
   - The admin limiter is keyed by institution ID (`admin:inst:<institutionId>`), allowing multi-admin collaboration while shielding the tenant from runaway automation or script abuse.
   - Applies only to mutating routes (`POST /domains`, `POST /domains/:id/resend`, `DELETE /domains/:id`, approve, reject). Safe read-only `GET` endpoints remain unconstrained.
7. **Audit Trail**:
   - For registered users, `recordLoginAudit('account_locked')` is recorded in `central.login_audit` **once** when a lockout initiates (not on subsequent blocked requests).
   - Rate limit hits and blocked attempts emit structured `[security-audit]` logs to stdout with masked emails (e.g. `ad***@apex.lk`) and never passwords or tokens.

### Frontend Integration Guidance
> [!NOTE]
> Frontend changes for 429 handling will be wired in future frontend tickets. No frontend files should be modified in this backend hardening phase.

When implementing the client-side experience:
1. **`frontend/src/lib/api.js`**:
   - Enhance the global fetch/axios response interceptor to intercept `HTTP 429`.
   - Read the `Retry-After` response header (integer in seconds).
   - Propagate a structured error object containing `retryAfter` and the generic message to callers.
2. **`frontend/src/components/c4/auth/Login.jsx`**:
   - Catch 429 errors from `login()` calls.
   - Display a countdown timer (e.g., "Too many attempts. Please wait 14 minutes and 30 seconds before trying again.").
   - Disable the submit button until the countdown expires.

---

## 13. Graduated Trust & Agent Governance (Phase 9a)

Component 4 provides the Graduated Trust engine and governance APIs for AI agent action execution, policy configuration, and human-in-the-loop oversight.

### Internal / Service Dispatch
- **Phase 10 service auth**: Internal service-key dispatch is implemented for allowlisted action types (currently `volume_spike_alert` / A3). Callers still cannot supply `tier`, `agentId`, `agentName`, or `policyId`.
- **Test Dispatch Endpoint**: `POST /api/tenant/agent-actions/test-dispatch` is restricted to administrators (`admin` role) for development simulation and is **strictly blocked in production** (`NODE_ENV === "production"` returns `403 Forbidden`).

### A2 Workflow — budget threshold (v1)
- **Endpoint**: `POST /api/tenant/agent-actions/budget-threshold/evaluate`
- **Auth**: JWT + tenant context. Roles with `agents:decide_tier3` **or** `finance:manage_ledger` (admin, executive, branch_manager, finance_officer). **Not** granted by `agents:view_actions` alone.
- **Body**: `{ "metricName": string, "metricValue": number, "threshold": number, "periodKey"?: string, "source"?: "manual_api_v1", "branchId"?: uuid }`
- **Rule**: breach when `metricValue >= threshold` (equality counts). Non-breach returns `dispatched: false` without creating an action.
- **On breach**: dispatches `budget_threshold_alert`; active policy supplies **Tier 2 / A2**. Handler writes Agent Log evidence (`notified`). **No email/SMS/push** in v1.
- **Metrics**: caller-supplied only (`source` must be `manual_api_v1`). **Automatic M2 ledger/budget monitoring is a later milestone** (no M2 routes exist yet). ZZ viva demo rows created via this same evaluate path are **synthetic caller metrics for governance UI**, not proof of live M2 monitoring.
- **Soft dedupe**: within ~24h, same `dedupeKey` may return `duplicate: true` without a new row. Race possible under concurrency (no unique DB index; migration deferred). Pass `?allowDuplicate=true` to force a new dispatch for tests.
- **Offline check**: `npx tsx scripts/verify-a2-budget-threshold.ts` from `backend/`.
- **ZZ viva prep script** (M4-owned): `backend/scripts/prepare-zz-viva-demo.ps1` — opt-in write gate; records created action ids in a **gitignored** local manifest. Do not commit credentials or manifests.

### A4 NLQ — natural language (v1) + knowledge (v1.2)
- **Endpoint**: `POST /api/tenant/agent-actions/nlq/query` (same URL for count NLQ and knowledge).
- **Auth**: JWT + tenant context. Endpoint gate: `agents:query_nlq` (all six roles).
- **Body**: `{ "question": string }` (3–500 chars after trim).
- **Count NLQ flow**: optional lexical cue check → private Ollama intent JSON (`a4-intent-v2`) → Node **per-tool RBAC** → Prisma `count` on `agent_actions` → `dispatchAgentAction(nlq_query)` → Tier 1 `executed`. **Counts never come from the model.**
- **Knowledge flow** (when count NLQ unsupported / no lexical cues): grounded MicroFlow card (no Ollama) → **domain gate** → optional Ollama educational JSON → **no** `AgentAction` row. **Local MicroFlow (2026-10-21):** `A4_DOMAIN_ML_MODE=enforce`, `A4_DOMAIN_ML_POLICY=ml_tau`, `A4_DOMAIN_ML_TAU=0.45`, `A4_KNOWLEDGE_STRICT_PROMPT=1`, improve-v1 JSON. Gate refuse → `200` `{ reason: "off_topic" }` (+ `domainGate` when mode≠off). ML never grants NLQ/RBAC/live tools. Deploy state/rollback: [`DEPLOYMENT_LOCAL.md`](../agents/ml/data/a4_domain/DEPLOYMENT_LOCAL.md). Shared/cloud: keep mode `off` until artifact is packaged and promotion approved.
- **Timeout**: `OLLAMA_TIMEOUT_MS` (optional; default **30000**). Knowledge stage budget ~45s with one length-only retry. Knowledge `num_predict` default **1024** (`A4_KNOWLEDGE_NUM_PREDICT` override).
- **Supported count intents**:
  - `count_pending_tier3` — requires `agents:decide_tier3` (admin, executive, branch_manager). Mirrors `GET …/pending`.
  - `count_actions_window` — requires `agents:view_actions`; optional `agentId` A1–A4; `days` default **7**, allowed **1–30** only (out of range → `supported: false`, **no silent clamp**).
- **Fail-closed**: Ollama unset/timeout/error → `503` (no dispatch). Invalid model JSON → `422`. Unsupported intent / days → knowledge attempt or `200` `{ supported: false }`. Tool capability missing → `403`.
- **Handler**: real `nlqQueryHandler` (`stubExecuted: false`) for dispatched counts only.
- **Offline checks**: `npm run verify:a4-nlq` and `npm run verify:a4-knowledge` from `backend/`.

### A1 CBSL readiness prepare (v1)
- **Endpoint**: `POST /api/tenant/agent-actions/cbsl-report/prepare`
- **Auth**: `agents:decide_tier3` **or** `finance:manage_ledger`. Approve/reject remain `decide_tier3` only (SoD).
- **Contract**: grounded tenant aggregates + deterministic gaps → Tier 3 `pending_approval` (`generate_cbsl_report`). **Not** an official CBSL filing. Optional loan/borrower/journal **availability** slots only — M3/M2 must own real reporting data if required later.

### The 4 Tiers & Action Statuses
Actions are categorized into four trust tiers:
- **Tier 1 (Auto-Execute)**: Action executes immediately without human intervention. Final status: `executed` (or `failed` if execution encounters an error).
- **Tier 2 (Execute & Notify)**: Action executes immediately and notifies stakeholders. Final status: `notified` (or `failed`).
- **Tier 3 (Human Approval Required)**: Action halts in `pending_approval`. A human supervisor reviews the action:
  - **Approve**: Transitions to `approved`, executes handler, and reaches `executed` (or `failed`).
  - **Reject**: Transitions to `rejected` with `is_override: true`; no handler runs.
- **Tier 4 (Alert Only)**: Raises an alert without executing any automated action. Final status: `alert_only`. A human decides subsequent steps.

*(Lifecycle status `running` denotes an action currently executing its handler).*

### Policy Decision & Fallback Rule
- The tier for any action is decided **strictly by the active policy** (`is_active: true`) configured for the `actionType` in `agent_tier_policies`.
- **Fallback Rule**: Unknown action types or inactive policies automatically fall back to **Tier 4 (`alert_only`)** with `isFallback: true`.

> [!NOTE]
> **Tenant Policy Provisioning**:
> Newly provisioned tenants receive the 4 default policies automatically. Tenants created before Phase 9a may have no policies, or older policies without an agent_id; an admin should create or update them. An action type with no active policy falls back to Tier 4 alert_only.

### Existing Router Endpoints

#### Agent Actions (`/api/tenant/agent-actions` — in `backend/src/routes/agent-governance.ts`)
- `GET /api/tenant/agent-actions`: Lists agent actions with filters (`tier`, `status`, `agentId`, `from`, `to`, `page`, `limit`). Protected by `agents:view_actions` (roles: `admin`, `executive`, `finance_officer`, `hr_officer`, `branch_manager`, `loan_officer`). Strictly omits `input_payload` and `output_payload`.
- `GET /api/tenant/agent-actions/pending`: Lists pending Tier 3 actions awaiting decision. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`). Strictly omits payloads. Hard capped at 500 rows (`MAX_PENDING_TAKE`).
- `GET /api/tenant/agent-actions/metrics/override-rates`: Returns override rate metrics and tier statistics. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`). Hard capped at 500 rows (`MAX_METRICS_ROW_CAP`); returns `capped: true` when exceeded.
- `POST /api/tenant/agent-actions/nlq/query`: A4 NLQ v1 — Ollama intent + grounded M4 counts + Tier 1 `nlq_query`. Protected by `agents:query_nlq`; pending-count tool additionally requires `agents:decide_tier3`.
- `POST /api/tenant/agent-actions/test-dispatch`: Simulates dispatch across tiers in non-production environments. Admin-only (`agents:manage_policies`, role: `admin`).
- `GET /api/tenant/agent-actions/:id`: Fetches complete single action details, including full `inputPayload` and `outputPayload`. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`).
- `POST /api/tenant/agent-actions/:id/approve`: Approves a pending Tier 3 action and executes its handler. Requires `{ "reason": "..." }`. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`).
- `POST /api/tenant/agent-actions/:id/reject`: Rejects a pending Tier 3 action. Requires `{ "reason": "..." }`. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`).
- `POST /api/tenant/agent-actions/:id/override`: Human override for an executed/notified Tier 1 or Tier 2 action. Permitted once per action. Requires `{ "reason": "..." }`. Protected by `agents:decide_tier3` (roles: `admin`, `executive`, `branch_manager`).

#### Agent Policies (`/api/tenant/agent-policies` — in `backend/src/routes/agent-policies.ts`)
- `GET /api/tenant/agent-policies`: Lists all configured agent policies. Protected by `agents:view_actions` (roles: `admin`, `executive`, `finance_officer`, `hr_officer`, `branch_manager`, `loan_officer`).
- `POST /api/tenant/agent-policies`: Creates a new policy (`actionType`, `agentId`, `agentName`, `tier`, `description`). Admin-only (`agents:manage_policies`, role: `admin`). Writes audit log entry.
- `PUT /api/tenant/agent-policies/:id`: Updates an existing policy (`tier`, `description`, `isActive`). Admin-only (`agents:manage_policies`, role: `admin`). Justification `reason` (10 to 1000 characters) is required only when changing policy tier. Writes audit log entry.

### Lightweight Projection (Zero Payload Leakage)
> [!IMPORTANT]
> **Payload Privacy Guarantee**:
> List queries (`GET /api/tenant/agent-actions`) and pending queues (`GET /api/tenant/agent-actions/pending`) **never return `input_payload` or `output_payload`**. Payloads are excluded at the database projection level (`LIGHTWEIGHT_ACTION_SELECT`) to protect sensitive borrower PII and prevent memory bloat. Only single-item inspection (`GET /:id`) returns payload fields.

---

## 14. What M1 / M2 / M3 must provide to M4 (integration contracts)

M4 already ships Graduated Trust, agent governance APIs, and honest UI placeholders where peer data is missing. Peer modules connect by **owning their APIs and tables**, then optionally calling M4 governance endpoints — **never** by writing `agent_actions` directly or inventing counts in the frontend.

### 14.1 Existing vs missing (honest)

| Need | Status today | Owner |
|------|--------------|--------|
| JWT + `req.tenantPrisma` + RBAC | **Existing** | M4 |
| Agent Log / pending / policies / NLQ / A1 prepare / A2 evaluate / A3 internal dispatch | **Existing** | M4 |
| Executive / BM dashboard KPIs for loans, finance, HR | **Missing** — UI shows **Not connected** | M3 / M2 / M4 HR |
| Automatic A2 budget monitoring from ledger | **Missing** — A2 accepts `manual_api_v1` caller metrics only | M2 |
| Real PAR / portfolio risk series for A4 or dashboards | **Missing** — A4 knowledge is educational only | M1 / M2 / M3 (product decision) |
| Loan product catalog in Settings | **Not in Settings** — demo toggles removed; use M3 loan workspace | M3 |
| Branch list for admin Settings | **Existing** — `GET /api/tenant/branches` | M4 tenant |
| Cross-module async events (payroll→journal, disbursement→ledger) | **Planned / open** | Team lead (§15) |

### 14.2 How to connect data to M4 (implementation steps)

1. **Mount your router** behind `authenticate` → `resolveTenantContext` → `requireRole(...)` (§3). Use **only** `req.tenantPrisma`.
2. **Publish a read API** your dashboard or agent consumer can call (example shapes — agree exact JSON with M4 before wiring UI):
   - **M3 → BM/Exec loan tiles:** e.g. `GET /api/m3/.../branch-summary` returning `{ activeLoans, repaymentRate?, asOf }` for the caller's branch scope.
   - **M2 → Exec finance tiles / future A2:** e.g. budget utilization `{ metricName, metricValue, threshold, periodKey, branchId? }` suitable for `POST …/budget-threshold/evaluate` **or** a dedicated monitor job that calls that endpoint with `source: "manual_api_v1"` until a dedicated `m2_*` source is approved in code.
   - **M1 → risk surfaces:** keep assessments in M1 tables; if M4 should display a KPI, expose a summary GET — do not push scores into `agent_actions` unless using the internal allowlisted dispatch path.
3. **Optional governance write path:**
   - User JWT + evaluate/prepare/nlq as documented in §13.
   - Service automation (A3-style): `POST /api/internal/agent-actions/dispatch` with `AGENT_SERVICE_KEY` — **allowlist only** (`volume_spike_alert` today). Request new allowlist entries via M4 review; do not bypass policy/tier.
4. **Frontend:** M4 will replace “Not connected” tiles only when a **real tenant API** exists. Do not reintroduce Zustand demo numbers on executive/BM dashboards.
5. **Verify:** Bruno auth → your module GET → (optional) A2 evaluate or Agent Log row → confirm ZZ institution id `33b6545d-…` if using ZZ Test Org 1. Offline: `npm run verify:a2-budget` / peer module tests.

### 14.3 Tenant isolation & RBAC (non-negotiable)

- No `institution_id` column in tenant tables — the DB is the boundary.
- Soft user UUIDs must pass `validateUserId` before save (§5).
- Capabilities that matter for agents: `agents:view_actions`, `agents:decide_tier3`, `agents:query_nlq`, `finance:manage_ledger`, `agents:manage_policies`.
- List/pending endpoints **omit payloads**; only `GET …/agent-actions/:id` (decide_tier3) returns full JSON.
- Never commit `.env`, ZZ credentials, or viva manifests.

### 14.4 Relevant M4 backend files

| File | Role |
|------|------|
| `backend/src/middleware/auth.ts` | JWT + tenant resolution + `requireRole` |
| `backend/src/lib/permissions.ts` | Capability map |
| `backend/src/routes/agent-governance.ts` | Agent actions, NLQ, A1 prepare, A2 evaluate |
| `backend/src/routes/agent-policies.ts` | Policy CRUD |
| `backend/src/lib/agent-engine.ts` | `dispatchAgentAction` |
| `backend/src/lib/agent-a2-budget.ts` | Threshold contract |
| `backend/src/lib/agent-a1-compliance.ts` | Readiness package |
| `backend/src/lib/agent-a4-nlq.ts` / `agent-a4-knowledge.ts` | A4 count + knowledge |
| `backend/src/routes/internal-agent-dispatch.ts` | Service-key allowlist |

---

## 15. Open Items for Team Lead

1. **Pull Request into `main`**: Merge window for `feature/m4-dashboard-wire` / remaining M4 agent work?
2. **Cross-Module Event Format**: Agreed schema, transport, and delivery guarantee for:
   - Component 4 Payroll events → Component 2 journal entries?
   - Component 3 Loan Disbursements → Component 2 ledger entries?
3. **Dataset Status**: Standardized tenant seed datasets across developer environments (prefer ZZ Test Org 1 for M4 E2E; avoid Apex-only assumptions).
4. **A2 source evolution**: When may callers use a non-`manual_api_v1` source backed by live M2 monitoring?





