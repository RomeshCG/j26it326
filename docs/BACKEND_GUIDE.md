# Backend guide (for teammates & AI agents)

This doc explains **what the IMFS backend is**, **how folders are organised**, and **how to work in it safely**.

For Postgres install + connection checks, use:

- [LOCAL_SETUP.md](./LOCAL_SETUP.md)

ERD source of truth:

- `internalDocs/IMFS_ERD.dbml` (or ask the schema owner / M4)

---

## What is the backend?

The backend is the **Node.js + Prisma API** under `/backend`.

It is the shared server that:

1. Talks to **PostgreSQL** (central + tenant databases)
2. Will expose **REST APIs** for frontend and other modules (M1/M2/M3/M4)
3. Keeps **one Prisma schema + migrations in git** so every teammate has the same tables

Tech:

| Piece | Choice |
|-------|--------|
| Runtime | Node.js + TypeScript |
| ORM | Prisma |
| API framework | Express (starter in `src/index.ts`) |
| Auth (planned) | JWT + RBAC (6 roles) — still being built |

Default URL when running locally:

```text
http://localhost:4000
```

Quick checks:

| URL | Meaning |
|-----|---------|
| `GET /health` | API process is up |
| `GET /health/db` | Central + tenant DB connections work |
| `GET /api/institutions` | Sample central query |

---

## Database architecture (must understand)

We use **database-per-tenant**:

```text
CENTRAL DB                    TENANT DB (one per MFI)
-----------                   ------------------------
institutions                  branches, borrowers, loans
users, roles                  risk_assessments, ews_*, ledger
institution_databases  -----> connection URL for that MFI
subscriptions                 agent_actions, payroll, MDI, ...
```

| Env var | DB |
|---------|----|
| `CENTRAL_DATABASE_URL` | Shared system DB |
| `TENANT_DATABASE_URL` | Default/demo MFI business DB |

Rules:

- Tenant tables do **not** repeat `institution_id` — the whole DB is the tenant boundary
- `user_id` on tenant tables is a **soft ref** to central `users` (validate in app code, not as a cross-DB foreign key)
- Do **not** invent a third parallel schema — change Prisma schemas + migrations only

---

## Folder map

```text
backend/
  .env.example          # template for local env (committed)
  .env                  # your secrets (NEVER commit)
  package.json          # scripts + dependencies
  tsconfig.json         # TypeScript config
  README.md             # short backend readme

  prisma/
    central/
      schema.prisma     # CENTRAL tables (M4 system)
      seed.ts           # demo roles / institution / admin user
      migrations/       # committed history — do not hand-edit casually
    tenant/
      schema.prisma     # TENANT tables (M1/M2/M3/M4 business)
      seed.ts           # optional demo products/branches (prefer empty for onboarding)
      migrations/
    tsconfig.json       # so seed files get Node types in the IDE

  src/
    index.ts            # Express app entry (routes start here)
    lib/
      prisma-central.ts # Prisma client for central DB
      prisma-tenant.ts  # default tenant client + per-URL client cache
      tenant-context.ts # resolve institution → correct tenant DB
```

Related repo folders (not inside backend, but agents should know):

| Folder | Purpose |
|--------|---------|
| `frontend/` | React UI (can use mock auth until JWT is ready) |
| `ml/` | M1/M2/M3 ML code (`m1_credit_risk`, `m2_mission_intel`, `m3_ews`) |
| `agents/` | M4 LangChain / Graduated Trust agents |
| `docs/` | Team guides (this file, local setup) |

---

## Who owns what in the tenant schema?

Ownership convention (even though tables sit in one tenant DB):

| Module | Typical tables |
|--------|----------------|
| M4 | `branches`, `employees`, `payroll_*`, `agent_*`, `audit_log`, onboarding |
| M1 | `risk_assessments`, `shap_*`, `reliance_profiles`, `decision_log` |
| M2 | `chart_of_accounts`, `journal_*`, KPI / social / `mission_drift_*` |
| M3 | `borrowers`, `loans`, `collections`, `ews_*`, applications |

**Do not write into another module’s tables directly.** Call that module’s API / emit an event.

---

## How teammates start work

### 1) One-time machine setup

Follow [LOCAL_SETUP.md](./LOCAL_SETUP.md):

1. Install PostgreSQL locally  
2. Create `imfs_central` + `imfs_tenant_apex`  
3. Copy `backend/.env.example` → `backend/.env`  
4. Set both database URLs  

### 2) Every day / after git pull

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate:central:deploy
npm run prisma:migrate:tenant:deploy
npm run dev
```

Confirm:

- http://localhost:4000/health  
- http://localhost:4000/health/db  

### 3) Useful scripts

| Command | What it does |
|---------|----------------|
| `npm run dev` | Start API with hot reload |
| `npm run prisma:studio:central` | Browse central tables |
| `npm run prisma:studio:tenant` | Browse tenant tables |
| `npm run db:seed:central` | Seed roles + demo institution + admin |
| `npm run db:seed:tenant` | Optional demo branches/products (skip if you want empty onboarding) |

---

## How to change the database (important)

1. Edit the correct schema:
   - Central → `prisma/central/schema.prisma`
   - Tenant → `prisma/tenant/schema.prisma`
2. Create a migration on your machine:

```powershell
npm run prisma:migrate:central -- --name describe_your_change
# or
npm run prisma:migrate:tenant -- --name describe_your_change
```

3. **Commit** the schema + `migrations/` folder  
4. Teammates pull and run `*:deploy`  

Never “fix production/shared Neon casually” for experiments — use **local Postgres**.

---

## Instructions for AI coding agents

When helping on this repo, agents should:

1. **Read this file + LOCAL_SETUP.md** before inventing a new backend layout  
2. Prefer existing patterns in `src/lib/*` (two Prisma clients, tenant resolver)  
3. Put new HTTP routes in / next to `src/index.ts` (or a clear `src/routes/` if creating one)  
4. Use Prisma models from the generated clients — do not add a second ORM  
5. Keep secrets in `.env` only; never commit connection strings  
6. Respect module ownership (M1/M2/M3/M4 table boundaries)  
7. For ML work, put code under `/ml/...`, not inside `/backend` unless wiring an HTTP proxy  
8. For agent orchestration, prefer `/agents`, not mixing into Prisma schemas without M4 review  
9. Synthetic datasets stay local (`ml/**/data/synthetic` is gitignored)  

Suggested agent prompt snippet teammates can paste:

```text
You are working on IMFS (J26-IT-326).
Read docs/BACKEND_GUIDE.md and docs/LOCAL_SETUP.md.
Backend is Node + Prisma with central + tenant DBs.
Do not invent a new DB layout; extend prisma/central or prisma/tenant schemas with migrations.
Do not commit .env or synthetic datasets.
```

---

## Roles (auth target)

JWT + RBAC will use these 6 roles (central `roles` table):

| DB name | Meaning |
|---------|---------|
| `admin` | Institution Admin |
| `executive` | Executive / manager dashboards |
| `finance_officer` | Finance / MDI / approvals |
| `hr_officer` | HR / payroll |
| `branch_manager` | Approvals / branch portfolio |
| `loan_officer` | Applications / collection / risk / EWS |

Until real JWT exists, frontend may still use mock login.

---

## Current starter status (honest)

Already in place:

- Prisma central + tenant schemas  
- Migrations folder structure  
- Express health / institutions / tenant probe routes  
- Tenant resolution helpers  

Still to build (typical next work):

- Real JWT login + RBAC middleware  
- Onboarding → provision new tenant DB  
- Module APIs (`/assess-risk`, loans, ledger posts, agents, …)  

---

## Need help?

1. DB won’t connect → [LOCAL_SETUP.md](./LOCAL_SETUP.md) troubleshooting  
2. Schema questions → ERD + M4  
3. Which folder for my feature? → ownership table above  
