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

## 2. Environment Setup (First Time Pulling)

Whenever you pull changes from `main` or `m4/*`:

1. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
2. **Configure your `.env`**:
   Make sure you have a `JWT_SECRET` configured in `backend/.env`.
   - Must be at least 32 characters long.
   - Generate one in terminal (e.g. `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`).
   - **Never commit `.env` or share your secret.**
   ```dotenv
   JWT_SECRET="your-own-secure-secret-minimum-32-characters"
   JWT_EXPIRES_IN="15m"
   ```

---

## 3. How to Mount a Module Router

In Express, mount your router behind the M4 middleware chain:

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
- Run `backend/scripts/seed-test-users.ts` (with user approval) to generate test accounts.
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

## 11. Security Hardening A: Rate Limiting & Account Lockout

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





