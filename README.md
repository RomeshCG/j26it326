# IMFS 

**An Intelligent Multi-Tenant Microfinance Suite**
Explainable credit risk, mission-drift intelligence, early warning and graduated-trust AI governance for Sri Lankan microfinance institutions (MFIs).

| | |
|---|---|
| **Project ID** | J26-IT-326 |
| **Programme** | SLIIT Faculty of Computing, 4th Year Research Project (2026) |
| **Type** | Research |

---

## 1. The problem

Microfinance institutions must stay financially sustainable while continuing to serve low-income borrowers. In practice:

- loan officers judge credit risk mostly by experience, and black-box scores are either not trusted or trusted too much;
- repayment distress is noticed only after a loan is already 30 or more days overdue;
- drift away from the social mission (women, rural and low-income borrowers) is not measured until it is too late;
- AI assistance is hard to trust or audit, which matters in a sector licensed and regulated by the Central Bank of Sri Lanka (Microfinance Act No. 6 of 2016).

IMFS addresses these problems on **one multi-tenant platform**. Each institution's data is kept fully isolated, and four research components share the same loans, users and audit trail.

---

## 2. Core components

| # | Component | Member | Research focus |
|---|---|---|---|
| **C1** | **Explainable Credit Risk with Officer Trust Calibration** | Gamadikari G.A.M.R.C.K. (IT23184480) | Scores a loan application, explains *why* with SHAP in plain language, and records whether the officer accepts or overrides it. These records are used to study trust calibration. |
| **C2** | **Dual-Mission Performance Intelligence and Mission Drift Index** | Perera G.R.C. (IT23172982) | A balanced double-entry ledger, financial KPIs (PAR30, OSS, OER, yield) and social KPIs. A Mission Drift Index (MDI) raises evidence-backed alerts when an institution drifts away from its target borrowers. |
| **C3** | **Loan Lifecycle Management and Early Warning System** | Herath H.P.S.P. (IT23225688) | The full loan workflow (application → approval → schedule → disbursement → collection), portfolio-at-risk buckets (PAR1/30/60/90), and ranked early-warning alerts with a reason and intervention logging. |
| **C4** | **Multi-Tenant Agentic ERP with Graduated Trust Governance** | Weerawardhana S.C.D. (IT23194762) | Tenant provisioning (one database per institution), JWT login with role-based access (6 roles), and a Graduated Trust engine that classifies every AI agent action into Tier 1–4 (execute / execute and notify / human approval / alert only), with a full audit log. |

### How the components connect

- C3 requests a **risk score from C1** for every loan application.
- C3 sends **disbursement and collection events to C2**, which posts them to the ledger.
- Every component runs behind **C4's authentication, roles and tenant routing**.
- Components communicate only through **APIs and events**. They never write into each other's tables.

---

## 3. Architecture

```text
                 React web app (6 roles)
                          │
             Express + Prisma API (:4000)
     JWT login → role check → route to the institution's DB
         │              │              │              │
     C1 risk        C2 ledger,     C3 loans,      C4 trust engine,
     service        KPIs, MDI      PAR, EWS       agents, audit
     (FastAPI       engines        (nightly       (agents service
      :8002)                        job)           :8001)
         │                                            │
   ┌──────────────┐      ┌──────────────────────────────────────┐
   │  Central DB  │      │  One PostgreSQL database per MFI     │
   │ institutions,│      │  loans, risk, ledger, EWS, agents,   │
   │ users,routing│      │  audit (isolated by design)          │
   └──────────────┘      └──────────────────────────────────────┘
```

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Tailwind CSS 4, shadcn/ui, Zustand |
| Backend API | Node.js, Express, TypeScript, Prisma ORM, JWT (HS256), node-cron |
| Databases | PostgreSQL 16: one central database plus one physical database per tenant |
| Machine learning | Python, scikit-learn, XGBoost, SHAP, pandas, FastAPI |
| AI agents | FastAPI agent runtime, Isolation Forest, TF-IDF + logistic-regression domain gate, local LLM via Ollama (intent selection only) |
| API testing | Bruno collections (`docs/bruno/`), Jest / Vitest / pytest |

---

## 4. Machine learning and evaluation

All models are explainable and evaluated with leakage-aware splits. Results are reported honestly, together with their limits.

| Component | Model | Data | Key result | Notes |
|---|---|---|---|---|
| C1 | XGBoost classifier + TreeSHAP | Partner PAR extract, 7,245 loans; label = arrears age > 1 period | ROC-AUC **0.81 ± 0.015** (baseline 0.50), PR-AUC 0.73, Brier 0.16 | 5-fold cross-validation grouped by centre. Logistic regression (0.82) is kept as a transparent baseline. Branches or products not seen in training trigger *reduced reliability → review*. |
| C2 | Mission Drift Index (weighted index of 7 trends, 3-month window vs. baseline) | Partner PAR extract + public priors + labelled synthetic ledger | PAR30 = 20.94% (real snapshot) | An exploratory XGBoost drift predictor is included; its scores are not claimed as a research result. |
| C3 | Rule-based PAR alerts (live); XGBoost distress classifier (candidate) | Partner PAR extract + labelled synthetic schedules | Centre-grouped train / validation / test split | With a single snapshot, model accuracy is an upper bound and lead time cannot be measured yet. Time-based validation will follow with further snapshots. |
| C4 | Graduated Trust rule engine; Isolation Forest (A3); domain gate + LLM (A4) | Labelled synthetic governance scenarios | Policy fixtures 12/12; Isolation Forest F1 0.68, ROC-AUC 0.95; A4 26/30 end to end | Rule fixtures show conformance to the written policy, not accuracy. Known weakness: Isolation Forest misses amount-only spikes. |

The LLM never sets numbers and never overrides a model or a human decision. Explanations and narratives are generated by templates over computed values.

---

## 5. Data and privacy

| Source | Tag | Use |
|---|---|---|
| Anonymised loan-book (PAR) extract from a Sri Lankan MFI partner, one snapshot of 7,245 loans | `par` | Primary data for C1, C2 and C3 |
| World Bank Global Findex, MIX Market, Department of Census and Statistics | `public_prior` | Social and financial benchmarks |
| Generated data (ledger, schedules, payroll, agent scenarios) | `synthetic` | Only where the partner cannot share data. Always labelled in the data and on screen. |

- **Partner data is not included in this repository.** Names, NIC numbers and phone numbers were removed, and the file is shared only privately within the team.
- Everything under `ml/**/data/private/`, `ml/**/data/raw/`, `ml/**/data/synthetic/` and `ml/**/artifacts/` is git-ignored, and so are all `.env` files and trained model binaries (`.joblib`).
- To reproduce the results, place the private dataset at `ml/m1_credit_risk/data/private/par30_clean_no_pii.csv` (plus the matching paths for M2 and M3), then run the training scripts listed below.

---

## 6. Repository structure

```text
rp-p/
├── frontend/              React web app (all four components' screens)
├── backend/               Express + Prisma API, tenant routing, C2/C3/C4 logic
│   ├── prisma/central/    Central DB schema + migrations
│   ├── prisma/tenant/     Tenant DB schema + migrations
│   └── src/               routes/, lib/ (ledger, PAR, trust engine, agents), services/
├── ml/
│   ├── m1_credit_risk/    C1: features, training, SHAP, FastAPI service, tests
│   ├── m2_mission_intel/  C2: KPI engine, MDI, drift model, narratives
│   ├── m3_ews/            C3: EWS features, training, evaluation, batch scoring
│   ├── shared/            Shared helpers
│   └── notebooks/         Research notebooks (m1/, m2/)
├── agents/                C4: agent runtime (FastAPI), Isolation Forest, A4 domain classifier
└── docs/                  API docs, evaluation reports, Bruno collections, setup guides
```

---

## 7. Running the project locally

**Prerequisites:** Node.js 18+, Python 3.11+, PostgreSQL 16.

```bash
# 1. Backend API (http://localhost:4000)
cd backend
cp .env.example .env            # set CENTRAL_DATABASE_URL, TENANT_DATABASE_URL, JWT_SECRET
npm install
npm run prisma:migrate:central:deploy
npm run prisma:migrate:tenant:deploy
npm run db:seed:central
npm run db:seed:tenant
npm run dev

# 2. Frontend (http://localhost:5173)
cd frontend
npm install
npm run dev

# 3. C1 credit-risk model service (http://127.0.0.1:8002), needs the private dataset
cd ml
python -m venv .venv && .venv\Scripts\activate      # Windows
pip install -r requirements.txt
python m1_credit_risk/train/train_xgb.py
uvicorn app:app --app-dir m1_credit_risk/serve --port 8002

# 4. C4 agents service (http://127.0.0.1:8001)
cd agents
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
```

Detailed guides:
- `docs/LOCAL_SETUP.md`
- `backend/README.md`
- `ml/README.md`
- `agents/README.md`
- `docs/M1_RISK_API.md`

---

## 8. Testing

| Area | Command |
|---|---|
| Backend unit tests | `cd backend && npm test` |
| Graduated Trust fixtures | `cd backend && npm run verify:graduated-trust` |
| C1 model and service | `cd ml && python -m pytest m1_credit_risk/tests -q` |
| C2 MDI | `cd ml && python -m pytest m2_mission_intel -q` |
| End-to-end API flows | Bruno collections in `docs/bruno/` (risk, loans lifecycle, ledger, agents) |

---

## 9. Current status and limitations

- **Working end to end:**
  - tenant provisioning, login and roles;
  - live C1 risk scoring with SHAP explanations and decision logging;
  - balanced ledger, KPIs and Mission Drift Index alerts;
  - loan lifecycle APIs, PAR buckets and early-warning inbox;
  - Graduated Trust approval queue and agent audit log.
- **Prototype screens, clearly labelled in the UI:** some financial statements, HR and payroll, the SHAP interaction matrix and the officer trust profile.
- **Main research limitation:** the partner data is a single snapshot, so time-based validation (training on one month and testing on the next) is planned when further snapshots are available.

---

## 10. Team

| Member | Student ID | Component |
|---|---|---|
| Gamadikari G.A.M.R.C.K. | IT23184480 | C1: Explainable Credit Risk |
| Perera G.R.C. | IT23172982 | C2: Mission Intelligence |
| Herath H.P.S.P. | IT23225688 | C3: Loan Lifecycle and Early Warning |
| Weerawardhana S.C.D. | IT23194762 | C4: Tenancy and AI Governance |

*Developed for academic research at SLIIT. Partner data remains confidential and is not distributed.*
