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
