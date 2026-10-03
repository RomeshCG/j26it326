# IMFS Backend

Node.js + **Prisma** API for MicroFlow / IMFS (J26-IT-326).

## Architecture

**Database-per-tenant** (matches Neon + ERD):

| Database | Env var | Contents |
|----------|---------|----------|
| Central | `CENTRAL_DATABASE_URL` | Institutions, users, roles, tenant routing |
| Tenant (per MFI) | `TENANT_DATABASE_URL` (+ more via routing) | Branches, loans, risk, ledger, MDI, agents |

Prisma schemas (committed — **source of truth for the whole group**):

- `prisma/central/schema.prisma`
- `prisma/tenant/schema.prisma`

Everyone applies the same migrations so table structure stays identical.

## Neon setup (you create this)

1. Create a Neon **project** for central, e.g. `imfs-central`
2. Create a Neon **project** for the first tenant, e.g. `imfs-tenant-apex`
3. Copy both connection strings (prefer the **pooled** URL) into `.env`

Optional later: more tenant projects → register them in `institution_databases.connection_url`.

## Local setup

```bash
cd backend
cp .env.example .env
# paste CENTRAL_DATABASE_URL and TENANT_DATABASE_URL into `.env`
# Prisma only auto-loads `.env` (not `.env.local`)

npm install
npm run prisma:generate

# Create tables on Neon (run once per DB, or after schema changes)
npm run prisma:migrate:central -- --name init
npm run prisma:migrate:tenant -- --name init

# Seed demo roles / products / policies
npm run db:seed:central
npm run db:seed:tenant

npm run dev
```

API: `http://localhost:4000`

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Service up |
| `GET /health/db` | Central + default tenant connectivity |
| `GET /api/institutions` | List institutions + DB routing |
| `GET /api/tenants/:dbIdentifier/info` | Tenant info + counts |
| `GET /api/institutions/:id/tenant-health` | Resolve tenant and ping DB |

## Team rules (keep schema in sync)

1. Change tables only in `prisma/**/schema.prisma`
2. Create a migration on your machine → **commit** the `migrations/` folder
3. Teammates pull and run:
   - `npm run prisma:migrate:central:deploy`
   - `npm run prisma:migrate:tenant:deploy`
4. Never commit `.env`
5. Prefer one shared Neon account for the group (or share connection strings privately)

## Scripts

```bash
npm run prisma:studio:central   # browse central tables
npm run prisma:studio:tenant    # browse tenant tables
npm run prisma:generate         # regenerate both clients
```

## Provisioning a new MFI later

1. Create a new Neon project (empty DB)
2. Point `TENANT_DATABASE_URL` at it temporarily **or** use deploy with that URL
3. `npm run prisma:migrate:tenant:deploy`
4. `npm run db:seed:tenant` (optional)
5. Insert/update `institution_databases` in central with `connection_url` + `db_identifier` (e.g. `tenant_esoft`)
