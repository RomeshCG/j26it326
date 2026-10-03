# Local PostgreSQL setup (for all teammates)

Use **local Postgres** for day-to-day work. Keep Neon for shared demos only.

IMFS needs **two databases** on your machine:

| Database | Purpose | Env var |
|----------|---------|---------|
| `imfs_central` | Institutions, users, roles, tenant routing | `CENTRAL_DATABASE_URL` |
| `imfs_tenant_apex` | Business data for one demo MFI | `TENANT_DATABASE_URL` |

---

## 1. Install PostgreSQL (Windows)

1. Download the Windows installer:  
   https://www.postgresql.org/download/windows/  
   (use the EDB installer)
2. Run the installer.
3. Remember:
   - Superuser: `postgres`
   - **Password** you set (you will need this)
   - Port: **5432** (default)
4. When **Stack Builder** opens → click **Cancel**  
   (we do not need Spatial / drivers / web add-ons)
5. Finish the install.

Optional: leave **pgAdmin 4** checked — useful GUI.

### Linux (Ubuntu/Debian example)

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'your_password';"
```

---

## 2. Check that PostgreSQL is running

### Windows

- Open **Services** (`Win + R` → `services.msc`)
- Find **postgresql-x64-XX** (version number varies)
- Status should be **Running**

Or in PowerShell:

```powershell
Get-Service -Name "*postgres*"
```

### Quick connection test (psql)

Open **SQL Shell (psql)** from the Start menu, press Enter through the prompts (host/port/user), then enter your password.

Or:

```powershell
psql -U postgres -h localhost -p 5432 -c "SELECT version();"
```

If you see a PostgreSQL version string → server is up.

---

## 3. Create the two databases

In **psql** (connected as `postgres`):

```sql
CREATE DATABASE imfs_central;
CREATE DATABASE imfs_tenant_apex;
\l
```

`\l` should list both databases.

### Using pgAdmin (GUI)

1. Open **pgAdmin 4**
2. Connect to **PostgreSQL** (enter password)
3. Right-click **Databases** → **Create** → **Database**
4. Name: `imfs_central` → Save
5. Repeat for `imfs_tenant_apex`

---

## 4. Connect the IMFS backend

```powershell
cd backend
copy .env.example .env
```

Edit `backend/.env` (use **your** password):

```env
PORT=4000
NODE_ENV=development

CENTRAL_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/imfs_central"
TENANT_DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/imfs_tenant_apex"

DEMO_INSTITUTION_NAME="Apex Microfinance Ltd"
DEMO_INSTITUTION_LICENSE="MFI-DEMO-001"
```

Important:

- File must be named **`.env`** (Prisma does not auto-load `.env.local`)
- Never commit `.env` to Git
- If the password has special characters (`@`, `#`, etc.), URL-encode them

---

## 5. Install deps, migrate, seed, run

```powershell
cd backend
npm install
npm run prisma:generate

npm run prisma:migrate:central -- --name init
npm run prisma:migrate:tenant -- --name init

# Seed central only (roles + demo institution). Skip tenant seed if you want empty branches/products.
npm run db:seed:central

npm run dev
```

---

## 6. How to check “is the DB connected?”

### A) Backend health (best check for this project)

With `npm run dev` running, open:

- http://localhost:4000/health  
  → `{ "ok": true, ... }` means API is up
- http://localhost:4000/health/db  
  → `{ "ok": true, "central": "connected", "tenantDefault": "connected" }` means **both DBs work**

If `/health/db` fails, read the error — usually wrong password, DB name, or Postgres not running.

### B) Prisma validate (reads `.env`)

```powershell
cd backend
npx prisma validate --schema prisma/central/schema.prisma
npx prisma validate --schema prisma/tenant/schema.prisma
```

You should see: `Environment variables loaded from .env` and schema valid.

### C) Prisma Studio (browse tables)

```powershell
npm run prisma:studio:central
npm run prisma:studio:tenant
```

Opens a browser UI. After central seed you should see roles / institution / admin user.

### D) psql

```powershell
psql -U postgres -h localhost -d imfs_central -c "\dt"
psql -U postgres -h localhost -d imfs_tenant_apex -c "\dt"
```

After migrate, you should see tables (`users`, `institutions`, … / `branches`, `loans`, …).

---

## 7. Keeping the team’s schema in sync

1. Pull latest git (includes `prisma/**/schema.prisma` + `migrations/`)
2. On your local DBs:

```powershell
npm run prisma:migrate:central:deploy
npm run prisma:migrate:tenant:deploy
npm run prisma:generate
```

Do **not** hand-edit tables in pgAdmin for structure changes — use Prisma migrations only.

---

## Common problems

| Problem | Fix |
|---------|-----|
| `Environment variable not found: CENTRAL_DATABASE_URL` | Create `backend/.env` (not only `.env.local`) |
| `password authentication failed` | Wrong password in `.env` |
| `database "imfs_central" does not exist` | Run the `CREATE DATABASE` steps |
| `connection refused` / `ECONNREFUSED` | Start PostgreSQL Windows service |
| Port conflict | Another app using 5432 — change Postgres port or stop the other service |
| Stack Builder confusion | Always **Cancel** — not required |

---

## Frontend work

Frontend can still run with mock login while auth is being built:

```powershell
cd frontend
npm install
npm run dev
```

Backend API default: `http://localhost:4000`
