# MicroFlow

**Group ID:** `j26it326`  
**Programme:** SLIIT — 4th Year Research Project

AI-assisted microfinance operations platform prototype. MicroFlow helps institutions manage borrowers, assess credit risk, monitor mission drift, support field loan officers, and govern AI agent actions through a graduated trust model.

---

## Overview

The system is organised into four research components:

| Component | Focus | Key screens |
|-----------|--------|-------------|
| **C1** | Adaptive credit risk & trust | Risk report, adaptive explanations, officer trust profile, A/B experiment |
| **C2** | Finance & mission intelligence | Finance dashboard, mission drift index, social performance, P&L / balance sheet / cash flow |
| **C3** | Loan officer field operations | Applications, disbursement, collection, early warning (EWS), temporal signal fusion, branch portfolio |
| **C4** | Admin / HR & AI governance | Onboarding, executive dashboard, HR & payroll, agent activity log, graduated trust, tier approvals |

The current demo centre of gravity is the **React frontend** (Vite + mock/localStorage data). Backend and ML folders are reserved for API and model work as the project evolves.

---

## Tech stack

**Frontend**

- React 19 + Vite
- React Router
- Tailwind CSS 4 + shadcn/ui
- Zustand
- Lucide icons

**Backend / ML (scaffold)**

- FastAPI, SQLAlchemy, PostgreSQL-oriented stack (`backend/`)
- Python ML ecosystem (`backend/requirements.txt`, `ml/`)

---

## Repository structure

```
rp-p/
├── frontend/     # Main UI prototype (run this for demos)
├── backend/      # API / services scaffold
├── ml/           # Model experiments
├── docs/         # Project documentation (incl. SHARED_DATASETS.md)
└── README.md
```

**Datasets for all members:** see [`docs/SHARED_DATASETS.md`](docs/SHARED_DATASETS.md) (PAR primary + public downloads for M2/M3/M4).

---

## Getting started (frontend)

### Prerequisites

- Node.js 18+ (recommended: current LTS)
- npm

### Install & run

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Build

```bash
cd frontend
npm run build
npm run preview
```

---

## Getting started (backend)

Node + **Prisma** API with **database-per-tenant** (Neon).

Full instructions: [`backend/README.md`](backend/README.md)

```bash
cd backend
cp .env.example .env
# set CENTRAL_DATABASE_URL and TENANT_DATABASE_URL from Neon

npm install
npm run prisma:migrate:central -- --name init
npm run prisma:migrate:tenant -- --name init
npm run db:seed:central
npm run db:seed:tenant
npm run dev
```

API default: `http://localhost:4000`

---

## Demo login

Use any of these accounts on `/login`. Password for all demo users:

```text
demo-password
```

| Role | Email |
|------|--------|
| Institution Admin | `admin@microflow.lk` |
| Finance Officer | `finance@microflow.lk` |
| HR Officer | `hr@microflow.lk` |
| Manager | `manager@microflow.lk` |
| Loan Officer | `loan@microflow.lk` |

Suggested viva paths:

1. **C1** — Loan Officer → borrower / application → risk report & trust profile
2. **C2** — Finance Manager → mission drift → social performance
3. **C3** — Loan Officer → early warning alerts → temporal signal fusion
4. **C4** — Graduated Trust → Tier Approvals (CBSL report Approve / Reject)

---

## Notable routes

| Route | Description |
|-------|-------------|
| `/dashboard` | Executive dashboard |
| `/graduated-trust` | AI action governance tiers |
| `/tier-approval` | Tier 3 human approval queue |
| `/agent-log` | Agent activity log |
| `/finance-manager` | Finance overview |
| `/alerts` | Mission drift dashboard |
| `/social-performance` | Social indicators deep-dive |
| `/loan-officer` | Loan officer home |
| `/loan-officer/alerts` | Early warning dashboard |
| `/loan-officer/risk-report` | Credit risk report |
| `/loan-officer/trust-profile` | Officer trust / explanation style |
| `/research/ab-experiment` | A/B experiment UI |

---

## Notes

- Current frontend demo data uses **mock / localStorage**; backend and live integrations can replace this over time.
- Theme supports light and dark mode via the header toggle.
- Role-based sidebar navigation changes after login.


