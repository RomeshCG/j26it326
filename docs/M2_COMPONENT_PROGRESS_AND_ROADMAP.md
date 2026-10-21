# Component 2 (M2): Dual-Mission Performance Intelligence & Financial Ledger
## Comprehensive Progress Report & Future Roadmap

**Project:** IMFS (MicroFlow) — Intelligent Microfinance Suite (J26-IT-326)  
**Programme:** SLIIT 4th Year Research Project  
**Component Owner:** Member 2 (M2) — Finance & Mission Intelligence  
**Document Version:** 1.0  
**Status Date:** October 21, 2026 (PP1 Demo Milestone)  

---

## Executive Summary

Component 2 (M2) bridges **commercial financial sustainability** and **social mission outreach** in microfinance institutions (MFIs). It provides:
1. An immutable, balanced **double-entry general ledger** with real-time financial reporting (P&L, Balance Sheet, OSS, OER, Yield).
2. The **Mission Drift Index (MDI)**: a mathematical formulation that quantifies adverse shifts away from target underserved populations.
3. An **XGBoost Predictive Drift Risk Prototype**: forward-looking early warning classification and trajectory regression (exploratory prototype evaluating leading operational velocity indicators; clearly separated from real longitudinal partner claims).
4. A **Grounded Narrative Engine**: strictly compliant with **NFR-06** (zero hallucinated figures, 100% structured evidence-grounded managerial summaries).
5. Inter-module event ingestion for automated posting of loan disbursements and collections.
6. Executive and operational web interfaces for finance managers and executive leadership.

As of the **PP1 Demo (October 21, 2026)**, the core requirements for Component 2 have been completed, verified with automated tests, and integrated end-to-end. Advanced research components (XGBoost early warning prototype and grounded narratives) have also been implemented ahead of schedule.

---

## 1. What Has Been Completed

### 1.1 Data Engineering & Domain Prior Calibration

| # | Item | Details & Findings | Source / Artifact |
|---|------|--------------------|-------------------|
| 1 | **Real Partner Portfolio Ingestion** | Ingested and cleaned July 2026 real loan extract: **7,245 loans**, outstanding portfolio of **LKR 315.27 Million**. | `data/private/par30_clean_no_pii.csv` |
| 2 | **PAR30 Arrears Rule Standardization** | Formulated and verified the microfinance arrears rule: `age > 4.3` weekly installments in arrears (≈ 30 days delinquency), yielding a verified **July PAR30 of 20.94% by balance** (21.66% by loan count). | `kpi/kpi_engine.py` |
| 3 | **Empirical Prior Configuration** | Calibrated financial and demographic priors from **MIX Market Sri Lanka** (134 MFI-years) and **Department of Census and Statistics 2012**: 78% female outreach, 77.4% rural / 18.2% urban / 4.4% estate distribution, 13% OER, 26% earned yield prior. | `config/m2_priors.toml`, `make_benchmarks.py` |
| 4 | **Longitudinal Synthetic Scenario Generator** | Generated 12-month synthetic history (Aug 2025 – Jul 2026) anchored to the real July 2026 snapshot. Programmed a controlled demo drift scenario (stable Aug–Apr, emerging drift May–Jul). Every record carries explicit provenance tagging (`data_source: par`, `synthetic`, `par+synthetic`). | `features/make_m2_synthetic.py` |

---

### 1.2 Core Financial Ledger & Backend Architecture

| # | Item | Details & Findings | Source / Artifact |
|---|------|--------------------|-------------------|
| 5 | **Database-per-Tenant Schema Migration** | Deployed migration `20261017120000_m2_data_source` adding `data_source`, `portfolio_outstanding`, and `avg_loan_size` to tenant tables without breaking cross-tenant isolation. | `backend/prisma/tenant/schema.prisma` |
| 6 | **Strict Double-Entry Ledger Engine** | Implemented chart of 10 standard accounts (`1000` Cash to `5300` Provision Expense). Built `assertBalanced` enforcing debit == credit equality, strict Decimal precision (preventing float rounding bugs), and non-negative entries. | `backend/src/lib/m2/ledger.ts` |
| 7 | **Financial Statement Generator** | Implemented dynamic **Profit & Loss (P&L)** for date ranges and **Balance Sheet** (`Net Assets = Liabilities + Equity`). Computes operational ratios directly from general ledger lines: **OSS = 1.09**, **OER = 12.9% p.a.** | `backend/src/lib/m2/reports.ts` |
| 8 | **M2 Seed & Verification Scripts** | Ingests 73 balanced journal entries (160 balanced lines), 12 monthly financial snapshots, 12 social snapshots, and MDI scores. Includes comprehensive assert-based verification suites (`verify-m2-ledger.ts`, `verify-m2-seed.ts`, `verify-m2-api.ts`). | `backend/scripts/` |
| 9 | **Tenant-Aware REST API** | Implemented routes under `/api/m2`: `/accounts`, `/journals`, `/reports/pnl`, `/reports/balance-sheet`, `/kpis`, `/social`, `/mdi`, `/alerts`, `/dashboard/finance`, `/dashboard/drift`. Protected with RBAC: `finance_officer`, `executive`, `admin`. | `backend/src/routes/m2.ts` |
| 10 | **C3 Loan Lifecycle Webhook Ingestion** | Endpoint `POST /api/m2/events/loan-lifecycle` receiving `loan_disbursed` and `payment_collected` events from Component 3 with `x-internal-key` auth and idempotent deduplication by `referenceId`. | `backend/src/routes/m2-events.ts` |

---

### 1.3 Frontend Dashboards & User Experience

| # | Screen / Module | Implementation & Key Features | File |
|---|-----------------|-------------------------------|------|
| 11 | **Finance Manager Dashboard** | Live KPI summary cards (Portfolio LKR 315.3M, PAR30 20.9%, OSS 1.09, OER 12.9%), Cash Position, Balance Sheet summaries, and integrated MDI alert banner. | `frontend/src/components/c2/FinanceManagerDashboard.jsx` |
| 12 | **Mission Drift Dashboard** | Executive view featuring live MDI gauge (July score 22.4, threshold 20.0), Dual-Mission Trade-Off radar/cards, and "Synthetic Demo Scenario" provenance badges. | `frontend/src/components/c2/MissionDriftDashboard.jsx` |
| 13 | **Mission Drift Detail Screen** | 12-month MDI trajectory (-10 to 40 scale), change velocity indicator (+12.0 pts/mo), and bar-chart breakdown of top adverse contributing trends. | `frontend/src/components/c2/MissionDriftDetail.jsx` |
| 14 | **Mission Drift Alerts Screen** | Alert triage table with severity tags (CRITICAL, ALERT, WATCH), grounded evidence drawers, and interactive **Acknowledge** and **Resolve** action modals. | `frontend/src/components/c2/MissionDriftAlerts.jsx` |
| 15 | **M2 Frontend API Client** | Clean asynchronous client wrapper fetching backend endpoints, handling JWT bearer headers, and providing graceful fallbacks. | `frontend/src/lib/m2-api.js` |

---

### 1.4 Machine Learning & Intelligence Pipeline (Advanced / PP2-Ready)

| # | Module | Implementation & Scientific Performance | File |
|---|--------|-----------------------------------------|------|
| 16 | **Standalone KPI Engine** | Pure functional calculation of microfinance delinquency, outreach metrics, and accounting ratios following CGAP/MIX Market standards. | `ml/m2_mission_intel/kpi/kpi_engine.py` |
| 17 | **Retrospective MDI Engine** | Mathematical formulation combining 7 weighted indicators across a rolling 3-month window vs. institutional baseline. Threshold = 20.0. July demo outputs score **22.4 (Alert)**. | `ml/m2_mission_intel/mdi/mdi.py` |
| 18 | **Predictive Feature Engineering** | Rolling 3-month velocity extraction, relative rate-of-change, and longitudinal feature pipeline. | `ml/m2_mission_intel/features/drift_features.py` |
| 19 | **XGBoost Drift Early Warning Classifier (Prototype)** | Predicts probability of crossing drift threshold in next 3 months. Default training: 17 real PAR branches anchored to 12-month series; scenario stress-testing gated behind `--demo-scenarios`. | `ml/m2_mission_intel/train/train_drift_model.py` |
| 20 | **XGBoost MDI Trajectory Regressor (Prototype)** | Forecasts continuous MDI score forward. Exploratory prototype evaluating velocity signals (not claimed as multi-year longitudinal partner validation). | `ml/m2_mission_intel/train/train_drift_model.py` |
| 21 | **Grounded Narrative Engine (NFR-06)** | Algorithmic narrative generation adhering strictly to NFR-06: zero hallucinated figures; strictly grounded on computed MDI and financial KPIs. Explains financial shifts, social outreach contraction, and governance recommendations. | `ml/m2_mission_intel/narrative/narrative_engine.py` |
| 22 | **Batch Intelligence & Branch Ranking Service** | Computes retrospective MDI, predictive forward risk, and ranks **all 17 branches** by drift risk index. Outputs `m2_intelligence_report.json`. | `ml/m2_mission_intel/serve/batch_drift_score.py` |
| 23 | **Unit & Integration Test Suite** | 100% passing tests across 6 suites (KPI engine, pure MDI, feature engineering, model inference, narrative engine, batch intelligence). | `ml/m2_mission_intel/tests/test_m2_ml.py` |
| 24 | **Research Evaluation Notebook** | Jupyter notebook documenting methodology, training curves, baseline comparisons, and ablation experiments for academic thesis evaluation. | `ml/notebooks/m2/01_mission_intelligence_and_drift_model.ipynb` |

---

## 2. Summary of Key Metrics & Experimental Results

```
================================================================================
M2 RESEARCH & IMPLEMENTATION BENCHMARK SUMMARY
================================================================================
Dataset Scale:              7,245 Active Borrower Loans (Real July 2026 Anchor)
Gross Portfolio:            LKR 315,274,380.00
Real PAR30 Rate:            20.94% (by balance), 21.66% (by loan count)
Operational Ratios (GL):    OSS = 1.09, OER = 12.90% p.a., Portfolio Yield = 26.0%

MDI Formulation:            7 Indicators, Baseline Window = 3 mo, Rolling Window = 3 mo
July 2026 MDI Score:        22.40 (ALERT, Threshold = 20.00, Velocity = +12.0 pts/mo)
Top Drift Drivers:          Poverty Share (-6.8%), Female Share (-5.2%), Avg Loan Size (+8.6%)

Predictive ML Performance (Exploratory Prototype):
  [NOTE: Metrics on simulated branch scenarios and PAR-anchored series — exploratory method
   exploration only; NOT validated on multi-year longitudinal partner history.]
  • Default Path (Real 17-Branch PAR Cross-Section Anchored):
      - Drift Risk Classifier: ROC-AUC = 0.9892 | Precision = 1.0000 | Recall = 0.9286 | F1 = 0.9630
      - Trajectory Regressor:  R² = 0.9173 | MAE = 2.5051 pts
  • Scenario Demo Mode (--demo-scenarios flag for stress-testing):
      - Drift Risk Classifier: ROC-AUC = 0.9493 (simulated branch scenarios only)
      - Trajectory Regressor:  R² = 0.9524 (simulated branch scenarios only)

Test Suite Verification:    6/6 Test Suites Passing (100% coverage on core ML logic)
Backend Verification:       3/3 Verification Scripts Passing (Ledger, Seed, API Routes)
================================================================================
```

---

## 3. What Is Left To Do (Roadmap & Next Steps)

While the PP1 objectives and primary machine learning pipelines are fully completed, the following enhancements are planned for **PP2, System Integration, and Final Academic Submission**:

### 3.1 Data & Domain Refinements
- [ ] **Official Poverty Line Update**: Replace the placeholder poverty threshold (LKR 17,000) in `config/m2_priors.toml` with the official Department of Census and Statistics (DCS) latest monthly basic-needs poverty line once released, and re-execute `make_m2_synthetic.py`.
- [ ] **Multi-Period Real PAR Ingestion**: Currently, July 2026 is real partner data while prior months (Aug 2025 – Jun 2026) are synthetic. If the partner MFI provides additional historical month extracts, replace synthetic rows with actual multi-period data.
- [ ] **CRIB / Credit Bureau Indicator**: Transition the `new_to_banking` indicator from the proxy (`first_time_borrower`) to formal credit bureau inquiry flags when integration/field survey data is available.

### 3.2 Inter-Component Integration Hardening
- [ ] **C3 Repayment Breakdown Contract**: Currently, Component 3's `payment_collected` event sends only a total `amount`, forcing M2 to post 100% to principal. Coordinate with M3 to pass `{ principalAmount, interestAmount }` in the payload for exact general ledger interest recognition.
- [ ] **C4 Payroll Journal Integration**: Subscribe to Component 4's `payroll_approved` event to auto-post EPF/ETF and staff salary journal entries into M2's `5000 Salary Expense` account.
- [ ] **Webhook Reliability & DLQ**: Introduce asynchronous retry handling and a dead-letter queue (DLQ) for webhook ingestion to handle intermittent server downtime in multi-tenant production.

### 3.3 Microservice & Automated Model Serving
- [ ] **Automated ML Serving Pipeline**: Currently, `batch_drift_score.py` is executed via CLI/batch. Wrap the inference pipeline into an automated cron worker or Python FastAPI sidecar so forward predictive drift risk updates automatically whenever monthly snapshots are taken.
- [ ] **LLM API Narrative Generator**: Currently, `narrative_engine.py` generates deterministic, grounded structured narratives. Connect this evidence payload to an external LLM API (e.g., Gemini 1.5 Pro with temperature 0.0 and strict system instructions) to produce formal narrative executive briefing memos.

### 3.4 Frontend & Reporting Enhancements
- [ ] **Branch Comparison UI Screen**: Build a dedicated Branch Comparison page in the frontend UI to display the 17-branch drift ranking already computed by `batch_drift_score.py`.
- [ ] **Complete Social Performance Screen Wiring**: Connect `frontend/src/components/c2/SocialPerformance.jsx` fully to live `/api/m2/social` endpoints (replacing remaining static arrays).
- [ ] **Full Statement of Cash Flows**: Extend `frontend/src/components/c2/CashFlowReport.jsx` with full operating, financing, and investing cash flow schedules derived from the ledger.

### 3.5 Academic Research & Evaluation (SLIIT Requirements)
- [ ] **Dissertation Chapter 3 (Methodology)**: Formulate the mathematical MDI theorem, objective function, and longitudinal XGBoost feature derivation.
- [ ] **Dissertation Chapter 4 & 5 (Evaluation & Results)**: Document ROC-AUC curves, confusion matrices, SHAP feature importance for drift prediction, and comparison against baseline moving averages.
- [ ] **Human-in-the-Loop Usability Evaluation (SUS)**: Conduct structured System Usability Scale (SUS) interviews with microfinance branch managers and finance officers to assess trust, clarity, and actionability of MDI alerts and grounded narratives.

---

## 4. Work Tracking & Milestone Matrix

| Task Category | Scope Item | PP1 Status | Target Completion |
|---|---|:---:|:---:|
| **ML Engine** | Retrospective MDI Algorithm | **Completed** | PP1 |
| **ML Engine** | KPI Engine (PAR30, OSS, OER) | **Completed** | PP1 |
| **ML Engine** | XGBoost Predictive Drift Prototype | **Completed** | PP1 (Early) |
| **ML Engine** | Grounded Narrative Engine (NFR-06) | **Completed** | PP1 (Early) |
| **ML Engine** | Automated FastAPI/Cron Serving | *Pending* | PP2 |
| **Backend** | Double-Entry General Ledger | **Completed** | PP1 |
| **Backend** | P&L & Balance Sheet Generators | **Completed** | PP1 |
| **Backend** | REST API (`/api/m2/*`) | **Completed** | PP1 |
| **Backend** | Bruno API Collection (`docs/bruno/IMFS/20 M2 Finance/`) | **Completed** | PP1 |
| **Backend** | C3 Webhook (`/api/m2/events/loan-lifecycle`) | **Completed** | PP1 |
| **Backend** | C4 Payroll Event Ingestion | *Pending* | PP2 |
| **Frontend** | Finance Manager Dashboard | **Completed** | PP1 |
| **Frontend** | Mission Drift Dashboard & Detail | **Completed** | PP1 |
| **Frontend** | Mission Drift Alerts & Resolution | **Completed** | PP1 |
| **Frontend** | Branch Comparison Screen | *Pending* | PP2 |
| **Frontend** | Full Cash Flow Statement | *Pending* | PP2 |
| **Research** | Evaluation Notebook & Benchmarks | **Completed** | PP1 |
| **Research** | SUS Usability Study & Paper Chapters | *Pending* | Final Submission |

---

## 5. How to Run & Verify Component 2

### 5.1 Run Python ML & Analytics Suite
```bash
# Navigate to repo root
cd "d:\Component 2\j26it326"

# Activate Python virtual environment and run the pipeline
ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\features\make_m2_synthetic.py
ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\mdi\run_mdi.py

# Train drift model: default uses real 17-branch PAR cross-section + PAR-anchored series
ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\train\train_drift_model.py

# Optional: run with synthetic scenario generator for demo stress-testing
# ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\train\train_drift_model.py --demo-scenarios

ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\serve\batch_drift_score.py
ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\tests\test_m2_ml.py
```

### 5.2 Verify Backend Ledger & API
```bash
cd backend
npx tsx scripts/verify-m2-ledger.ts
npx tsx scripts/seed-m2-demo.ts
npx tsx scripts/verify-m2-seed.ts
npx tsx scripts/verify-m2-api.ts
```

### 5.3 Launch Development Servers
```bash
# Terminal 1: Backend API (port 4000)
cd backend && npm run dev

# Terminal 2: Frontend App (port 5173)
cd frontend && npm run dev
```
Navigate to:
- Finance Dashboard: `http://localhost:5173/finance`
- Mission Drift Dashboard: `http://localhost:5173/mission-drift`
- Mission Drift Alerts: `http://localhost:5173/mission-drift-alerts`
