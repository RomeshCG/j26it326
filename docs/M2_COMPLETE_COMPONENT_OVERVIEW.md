# Component 2 (M2): Dual-Mission Performance Intelligence & Financial Ledger
# Complete Component Overview & Implementation Audit

**Project:** IMFS (MicroFlow) — Intelligent Microfinance Suite (J26-IT-326)  
**Programme:** SLIIT 4th Year Research Project  
**Component:** Component 2 (M2) — Finance Management & Mission Intelligence  
**Document Author:** Research Team / Component 2 Lead  
**Document Version:** 1.0 (Detailed Implementation Audit)  
**Date of Audit:** October 21, 2026 (PP1 Demonstration Milestone)  
**Repository Working Branch:** `feature/m2-be` (Commit `f766a5c`)  

---

## Table of Contents
1. [Project Overview](#1-project-overview)
   - [What is Component 2?](#what-is-component-2)
   - [The Microfinance Problem: The Dual-Mission Dilemma](#the-microfinance-problem-the-dual-mission-dilemma)
   - [Core Concepts Explained in Simple English](#core-concepts-explained-in-simple-english)
2. [Component 2 Architecture & Data Flow](#2-component-2-architecture--data-flow)
   - [High-Level Architecture](#high-level-architecture)
   - [System Layers and Module Responsibilities](#system-layers-and-module-responsibilities)
   - [Data Flow Diagram](#data-flow-diagram)
   - [Verified Inter-Module Connections & Identified Gaps](#verified-inter-module-connections--identified-gaps)
3. [Feature-by-Feature Detailed Explanation](#3-feature-by-feature-detailed-explanation)
   - [Feature A: Finance Manager Dashboard](#feature-a-finance-manager-dashboard)
   - [Feature B: Financial Ledger and Journal Entries](#feature-b-financial-ledger-and-journal-entries)
   - [Feature C: Financial KPI Calculation Engine](#feature-c-financial-kpi-calculation-engine)
   - [Feature D: Mission Drift Index (MDI) Calculation](#feature-d-mission-drift-index-mdi-calculation)
   - [Feature E: Mission Drift Alerts & Resolution](#feature-e-mission-drift-alerts--resolution)
   - [Feature F: Profit & Loss (P&L) Report](#feature-f-profit--loss-pl-report)
   - [Feature G: Social Performance Dashboard](#feature-g-social-performance-dashboard)
   - [Feature H: Financial & Social KPI Visualizations](#feature-h-financial--social-kpi-visualizations)
   - [Feature I: ML Pipeline and Predictive Model Training](#feature-i-ml-pipeline-and-predictive-model-training)
   - [Feature J: M3 Loan Lifecycle Event Integration](#feature-j-m3-loan-lifecycle-event-integration)
   - [Feature K: Authentication, Authorization & Tenant Isolation](#feature-k-authentication-authorization--tenant-isolation)
   - [Feature L: Tests, Validation Scripts & Error Handling](#feature-l-tests-validation-scripts--error-handling)
4. [Financial Ledger and Accounting Logic](#4-financial-ledger-and-accounting-logic)
   - [Debit and Credit Foundations](#debit-and-credit-foundations)
   - [Chart of Accounts (Verified Implementation)](#chart-of-accounts-verified-implementation)
   - [The Accounting Equation & assertBalanced Rule](#the-accounting-equation--assertbalanced-rule)
   - [Transaction Posting Rules](#transaction-posting-rules)
   - [Deriving Accounting Ratios from General Ledger Lines](#deriving-accounting-ratios-from-general-ledger-lines)
5. [Financial KPI Engine](#5-financial-kpi-engine)
   - [Portfolio Delinquency & The PAR30 Arrears Rule](#portfolio-delinquency--the-par30-arrears-rule)
   - [Operational Self-Sufficiency (OSS)](#operational-self-sufficiency-oss)
   - [Operating Expense Ratio (OER)](#operating-expense-ratio-oer)
   - [Portfolio Yield & Contract-Implied Yield](#portfolio-yield--contract-implied-yield)
   - [Summary of KPI Formulas & Data Origins](#summary-of-kpi-formulas--data-origins)
6. [Mission Drift Index (MDI)](#6-mission-drift-index-mdi)
   - [What MDI Measures](#what-mdi-measures)
   - [Mathematical Formulation & Weights](#mathematical-formulation--weights)
   - [Rolling Window vs. Institutional Baseline](#rolling-window-vs-institutional-baseline)
   - [Score Normalization & Directionality](#score-normalization--directionality)
   - [Threshold Crossing & Score Interpretation](#threshold-crossing--score-interpretation)
   - [Formula-Based Scoring vs. Machine Learning Prediction](#formula-based-scoring-vs-machine-learning-prediction)
7. [Mission Drift Alerts](#7-mission-drift-alerts)
   - [Alert Generation Trigger](#alert-generation-trigger)
   - [Severity Levels & Structured Evidence Storage](#severity-levels--structured-evidence-storage)
   - [Alert Lifecycle & Interactive Resolution Workflow](#alert-lifecycle--interactive-resolution-workflow)
8. [Social Performance Dashboard](#8-social-performance-dashboard)
   - [Implemented Social Outreach Indicators](#implemented-social-outreach-indicators)
   - [Frontend Reality vs. Backend Reality](#frontend-reality-vs-backend-reality)
9. [Machine Learning and Data Science](#9-machine-learning-and-data-science)
   - [Trained Model Verification](#trained-model-verification)
   - [Features and Targets](#features-and-targets)
   - [Evaluation Metrics & Benchmark Results](#evaluation-metrics--benchmark-results)
   - [Current Deployment Reality (Batch vs. Live Service)](#current-deployment-reality-batch-vs-live-service)
10. [M3 Event Integration](#10-m3-event-integration)
    - [Expected Event Payloads](#expected-event-payloads)
    - [Webhook Authentication & Tenant Routing](#webhook-authentication--tenant-routing)
    - [Idempotency & Deduplication](#idempotency--deduplication)
    - [Identified Integration Gaps with Component 3](#identified-integration-gaps-with-component-3)
11. [Testing and Verification Audit](#11-testing-and-verification-audit)
    - [Automated Test Execution Results](#automated-test-execution-results)
    - [Identified Test Failures & Environment Prerequisites](#identified-test-failures--environment-prerequisites)
12. [Current Implementation Status Summary Table](#12-current-implementation-status-summary-table)
13. [Remaining Tasks and Implementation Roadmap](#13-remaining-tasks-and-implementation-roadmap)
    - [Priority 1: Core Financial and Demonstration Requirements](#priority-1-core-financial-and-demonstration-requirements)
    - [Priority 2: Integration Hardening & Correctness](#priority-2-integration-hardening--correctness)
    - [Priority 3: Advanced ML Microservice, UI Extensions & Research](#priority-3-advanced-ml-microservice-ui-extensions--research)
14. [Recommended End-to-End Verification](#14-recommended-end-to-end-verification)
15. [Final Summary & Assessment](#15-final-summary--assessment)

---

## 1. Project Overview

### What is Component 2?
Component 2 (designated as **M2** in the research group) is the **Dual-Mission Performance Intelligence and Financial Management** component of the **IMFS / MicroFlow** microfinance platform. It provides the financial backbone (an immutable double-entry money ledger) and the social oversight mechanism (the Mission Drift Index, predictive drift machine learning models, and grounded executive narratives).

### The Microfinance Problem: The Dual-Mission Dilemma
Microfinance institutions (MFIs) were founded to provide small loans, savings, and financial services to marginalized populations—predominantly poor rural women—who have no collateral and are shut out of traditional commercial banks. 

However, MFIs face a fundamental structural tension known as the **Dual-Mission Dilemma**:
1. **Financial Sustainability:** To survive without perpetual donor charity, the MFI must cover its operational costs (staff salaries, branch rent, transportation), absorb loan defaults, and service commercial borrowings.
2. **Social Outreach Mission:** To fulfill its founding purpose, the MFI must reach the poorest, most vulnerable, rural, and unbanked clients.

**What goes wrong in practice?**  
When an MFI tries to become commercially profitable, it is economically tempting to issue larger loans to wealthier, urban, lower-risk clients because administering one large loan costs less than administering ten tiny rural loans. Over time, the MFI stops serving poor rural women and looks like an ordinary commercial bank. This phenomenon is called **Mission Drift**. Traditionally, management only discovers mission drift years later when donors or evaluators conduct retrospective surveys.

Component 2 provides real-time financial tracking and proactive, automated early warning detection of mission drift.

---

### Core Concepts Explained in Simple English

| Concept | Simple Definition | Practical Microfinance Example |
|---|---|---|
| **Financial Performance** | How well the MFI manages its money, covers expenses, collects interest, and protects against bad debts. | Calculating whether interest collected from borrowers is enough to pay loan officers' salaries and office rent. |
| **Social Performance** | How effectively the MFI reaches its target vulnerable populations and improves their socio-economic lives. | Checking what percentage of active borrowers are women living below the national poverty line in rural villages. |
| **Mission Drift** | The gradual, often unconscious abandonment of an MFI's social mission in pursuit of commercial financial profit. | A branch manager stops visiting rural women's weekly savings groups to focus on granting LKR 500,000 loans to urban shop owners. |
| **Mission Drift Index (MDI)** | A mathematical formula that combines multiple social outreach indicators into a single score comparing the current 3 months against a historical baseline. | A score where 0 means "perfect mission alignment" and a score above 20 triggers an automatic alert warning that outreach is shrinking. |
| **Key Performance Indicators (KPIs)** | Standard industry measurements used by microfinance executives to evaluate institutional health. | **PAR30** measures the percentage of loans overdue by more than 30 days; **OSS** measures if revenues exceed total costs. |
| **Financial Ledger** | A permanent, tamper-resistant record of every rupee coming into and going out of the institution using debits and credits. | When a loan of LKR 50,000 is given out, cash decreases by LKR 50,000 and the loan asset account increases by LKR 50,000. |
| **Machine Learning (ML)** | Computer algorithms that learn statistical patterns from historical data to make forward-looking predictions. | An XGBoost algorithm analyzing rolling rates of change to predict if the MFI will cross the mission drift alert threshold 3 months from now. |

---

## 2. Component 2 Architecture & Data Flow

### High-Level Architecture
Component 2 uses a hybrid architecture:
- **Python ML & Analytics Engine (`ml/m2_mission_intel/`):** Pure functional engines for KPI calculations, MDI formula computation, longitudinal synthetic scenario generation, predictive XGBoost model training, and grounded narrative generation.
- **Node.js / Express Backend (`backend/src/`):** Multi-tenant database management, strict double-entry ledger postings with Prisma `Decimal`, financial statement calculations (P&L, Balance Sheet), REST APIs (`/api/m2/*`), and webhook listeners (`/api/m2/events/loan-lifecycle`).
- **PostgreSQL Database-per-Tenant:** All general ledger entries, financial snapshots, social indicators, MDI scores, and alerts are stored in dedicated tenant databases (`imfs_tenant_<slug>`).
- **React 19 Frontend (`frontend/src/components/c2/`):** User dashboards with live API data, SVG trend charts, alert management tables, and graceful mock fallbacks.

---

### System Layers and Module Responsibilities

```mermaid
flowchart TD
    subgraph Data_Inputs [1. Data Layer & Priors]
        A1[Real Partner PAR Dataset\n7,245 Loans / LKR 315.3M\nAnchor Month: July 2026]
        A2[Empirical Priors & Benchmarks\nMIX Market Sri Lanka + Census 2012\nm2_priors.toml]
        A3[Synthetic Longitudinal Generator\nfeatures/make_m2_synthetic.py\n12-Month History + Demo Drift]
    end

    subgraph Python_Analytics [2. Python Analytics & ML Service]
        B1[KPI Calculation Engine\nkpi/kpi_engine.py]
        B2[MDI Scoring Engine\nmdi/mdi.py]
        B3[Drift Feature Engineering\nfeatures/drift_features.py]
        B4[XGBoost Predictive Models\ntrain/train_drift_model.py\nClassifier: AUC 0.9493 | Regressor: R2 0.9524]
        B5[Grounded Narrative Engine\nnarrative/narrative_engine.py\nNFR-06 Compliant Evidence Text]
        B6[Batch Intelligence Service\nserve/batch_drift_score.py\n17-Branch Risk Ranking]
    end

    subgraph Backend_Node [3. Backend Express & Ledger Engine]
        C1[Double-Entry Ledger Engine\nlib/m2/ledger.ts\nassertBalanced & Chart of Accounts]
        C2[Financial Reports Engine\nlib/m2/reports.ts\nDynamic P&L & Balance Sheet]
        C3[M2 REST API Router\nroutes/m2.ts\nMounted at /api/m2]
        C4[M3 Event Webhook Router\nroutes/m2-events.ts\nPOST /api/m2/events/loan-lifecycle]
        C5[Database Seed Script\nscripts/seed-m2-demo.ts]
    end

    subgraph Database_Tenant [4. PostgreSQL Tenant Database]
        D1[(chart_of_accounts)]
        D2[(journal_entries & lines)]
        D3[(financial_kpi_snapshots)]
        D4[(social_performance_indicators)]
        D5[(mission_drift_scores)]
        D6[(mission_drift_alerts)]
    end

    subgraph Frontend_React [5. React Frontend Dashboards]
        E1[Finance Manager Dashboard\nFinanceManagerDashboard.jsx]
        E2[Mission Drift Dashboard\nMissionDriftDashboard.jsx]
        E3[Mission Drift Detail\nMissionDriftDetail.jsx]
        E4[Mission Drift Alerts Screen\nMissionDriftAlerts.jsx]
        E5[P&L Report UI\nPAndLReport.jsx - Mock Data]
        E6[Social Performance UI\nSocialPerformance.jsx - Mock Data]
    end

    A1 --> A3
    A2 --> A3
    A3 -->|CSV Files| C5
    C5 -->|Populates| Database_Tenant
    A3 --> B1
    A3 --> B2
    B2 --> B3 --> B4
    B2 --> B5
    B4 --> B6

    Database_Tenant <-->|req.tenantPrisma| C1
    C1 --> C2
    C2 --> C3
    Database_Tenant <--> C3
    C4 -->|Auto-Posts| C1

    C3 -->|JSON APIs| E1
    C3 -->|JSON APIs| E2
    C3 -->|JSON APIs| E3
    C3 -->|JSON APIs| E4
```

---

### Verified Inter-Module Connections & Identified Gaps

1. **Python $\rightarrow$ Backend:**
   - *Connected:* Python synthetic data generator writes 4 CSV files (`borrowers_m2.csv`, `kpi_monthly.csv`, `social_monthly.csv`, `journals_monthly.csv`). The backend seed script (`backend/scripts/seed-m2-demo.ts`) reads these CSVs and seeds the tenant database.
   - *Gap:* The trained XGBoost predictive models (`train_drift_model.py`) and the batch intelligence script (`batch_drift_score.py`) run as standalone Python CLI scripts. Their forward predictions are **not yet exposed as live API endpoints** in Express.
2. **Backend $\rightarrow$ Frontend:**
   - *Connected:* `FinanceManagerDashboard.jsx`, `MissionDriftDashboard.jsx`, `MissionDriftDetail.jsx`, and `MissionDriftAlerts.jsx` use `@/lib/m2-api.js` to fetch live data from `/api/m2/*`.
   - *Gap:* `PAndLReport.jsx`, `BalanceSheetReport.jsx`, and `SocialPerformance.jsx` still import static arrays from `./mock-data.js` and `./social-performance-data.js` instead of calling their corresponding backend endpoints (`/api/m2/reports/pnl`, `/api/m2/reports/balance-sheet`, `/api/m2/social`).
3. **Component 3 (Loan Lifecycle) $\rightarrow$ Component 2 (Ledger):**
   - *Connected:* The webhook endpoint `POST /api/m2/events/loan-lifecycle` is implemented and verified in [m2-events.ts](file:///d:/Component%202/j26it326/backend/src/routes/m2-events.ts).
   - *Gap:* In [backend/src/lib/m3/m2-events.ts](file:///d:/Component%202/j26it326/backend/src/lib/m3/m2-events.ts), M3 does not yet attach the `x-internal-key` header, and M3 only sends a single total `amount` for repayments without breaking it down into `principalAmount` and `interestAmount`.

---

## 3. Feature-by-Feature Detailed Explanation

---

### Feature A: Finance Manager Dashboard

1. **Purpose:** Provides executive and finance officers with a real-time summary of the MFI's cash liquidity, total assets, liabilities, equity, operational ratios (OSS, OER, PAR30), and an immediate alert if mission drift is detected.
2. **Current Status:** **Completed & Connected to Live API** (with automatic mock fallback).
3. **User Perspective:** The user navigates to `/finance-manager`. They see four summary cards (Cash Position, Assets, Liabilities, Equity), a live MDI snapshot banner (showing "Mission Drift Alert: MDI 22.4" in red if an alert is active), and key operational KPI cards. A "Synthetic demo scenario" badge appears indicating that data originates from priors.
4. **Technical Implementation:**
   - File: [frontend/src/components/c2/FinanceManagerDashboard.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/FinanceManagerDashboard.jsx)
   - API Client: `fetchFinanceDashboard()` in [frontend/src/lib/m2-api.js](file:///d:/Component%202/j26it326/frontend/src/lib/m2-api.js)
   - Backend Route: `GET /api/m2/dashboard/finance` in [backend/src/routes/m2.ts](file:///d:/Component%202/j26it326/backend/src/routes/m2.ts)
5. **How It Works:** On mount, `loadData()` calls `GET /api/m2/dashboard/finance`. The backend queries the latest `financialKpiSnapshot`, invokes `balanceSheet()` on the tenant ledger up to the end of that month, and checks the latest `missionDriftScore`. It returns cash balance from Account `1000`, balance sheet totals, and KPI ratios.
6. **Data Flow:** `Tenant PostgreSQL` $\rightarrow$ `backend/src/routes/m2.ts` $\rightarrow$ `m2-api.js` $\rightarrow$ `FinanceManagerDashboard.jsx`.
7. **Dependencies:** Seeded database with journal entries and KPI snapshots; valid JWT authentication.
8. **Limitations:** If the user is unauthenticated or the server is offline, the page falls back to static constants in `mock-data.js`.
9. **Next Action:** Add a date range picker to allow the finance manager to view historical months directly on this dashboard.

---

### Feature B: Financial Ledger and Journal Entries

1. **Purpose:** Guarantees audit-grade double-entry bookkeeping where every financial event is immutably recorded and mathematical balance ($\sum \text{Debits} = \sum \text{Credits}$) is strictly enforced.
2. **Current Status:** **Completed, Deployed & Verified with Automated Tests.**
3. **User Perspective:** Finance officers can inspect general ledger transactions, view line-by-line debits and credits, and verify account balances.
4. **Technical Implementation:**
   - File: [backend/src/lib/m2/ledger.ts](file:///d:/Component%202/j26it326/backend/src/lib/m2/ledger.ts)
   - Models: `ChartOfAccount`, `JournalEntry`, `JournalEntryLine` in [schema.prisma](file:///d:/Component%202/j26it326/backend/prisma/tenant/schema.prisma)
   - Routes: `GET /api/m2/accounts`, `GET /api/m2/journals` in [backend/src/routes/m2.ts](file:///d:/Component%202/j26it326/backend/src/routes/m2.ts)
   - Verification Script: [backend/scripts/verify-m2-ledger.ts](file:///d:/Component%202/j26it326/backend/scripts/verify-m2-ledger.ts)
5. **How It Works:** The central function `postJournalEntry(prisma, entry)` takes a transaction date, reference type, reference ID, description, and an array of debit/credit lines. It runs `assertBalanced(lines)`, checking that:
   - There are at least two lines.
   - Every debit and credit amount is non-negative and has at most 2 decimal places.
   - Total debits exactly equal total credits using Prisma `Decimal`.
   If balanced, it executes a Prisma transaction creating the header and lines.
6. **Data Flow:** Incoming transaction $\rightarrow$ `assertBalanced()` $\rightarrow$ `prisma.journalEntry.create()` $\rightarrow$ `journal_entries` & `journal_entry_lines` tables.
7. **Dependencies:** Seeded `chart_of_accounts` in the tenant database.
8. **Limitations:** Manual journal entry creation via frontend UI form is not implemented; journal entries are currently created via seed script or M3 webhooks.
9. **Next Action:** Build a manual journal entry input form in the frontend with real-time balance validation.

---

### Feature C: Financial KPI Calculation Engine

1. **Purpose:** Calculates critical microfinance performance indicators—specifically Portfolio at Risk (PAR30), Operational Self-Sufficiency (OSS), Operating Expense Ratio (OER), and Portfolio Yield.
2. **Current Status:** **Completed & Verified in both Python and TypeScript.**
3. **User Perspective:** Users see objective percentage ratios showing whether the loan portfolio is healthy and whether operational revenues cover costs.
4. **Technical Implementation:**
   - Python Engine: [ml/m2_mission_intel/kpi/kpi_engine.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/kpi/kpi_engine.py)
   - Backend Engine: [backend/src/lib/m2/reports.ts](file:///d:/Component%202/j26it326/backend/src/lib/m2/reports.ts)
   - Route: `GET /api/m2/kpis`
5. **How It Works:** 
   - **PAR30:** Evaluates loan records where `age > 4.3` weekly installments in arrears. Sums their outstanding principal balance and divides by total outstanding portfolio.
   - **OSS:** Direct from ledger lines: $\frac{\text{Interest Income (4000)}}{\text{Salary (5000)} + \text{Opex (5100)} + \text{FinEx (5200)} + \text{Provision (5300)}}$.
   - **OER:** Direct from ledger lines: $\frac{(\text{Salary} + \text{Opex}) \times 12}{\text{Average Gross Loan Portfolio}}$.
6. **Data Flow:** Partner loan records / General Ledger lines $\rightarrow$ KPI Formula $\rightarrow$ `financial_kpi_snapshots` table $\rightarrow$ Frontend.
7. **Dependencies:** Loan portfolio balances and balanced general ledger lines.
8. **Limitations:** Historical months (Aug 2025 – Jun 2026) are generated from empirical priors; only July 2026 represents real loan-level partner data.
9. **Next Action:** Ingest additional real monthly PAR extracts from the partner MFI when provided.

---

### Feature D: Mission Drift Index (MDI) Calculation

1. **Purpose:** Quantifies multidimensional social performance into a single, standardized mathematical index to detect if the institution is abandoning its target demographic.
2. **Current Status:** **Completed, Documented & Verified.** (Formula-based implementation; not ML).
3. **User Perspective:** Users observe an MDI score (0 to 100 scale). Values below 20.0 display as "Normal" (green). Values of 20.0 or higher trigger an "Alert" (red) with an itemized breakdown of which indicators caused the drift.
4. **Technical Implementation:**
   - Pure Python Engine: [ml/m2_mission_intel/mdi/mdi.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/mdi/mdi.py)
   - Settings Config: [ml/m2_mission_intel/config/mdi_settings.toml](file:///d:/Component%202/j26it326/ml/m2_mission_intel/config/mdi_settings.toml)
   - Backend Route: `GET /api/m2/mdi` & `GET /api/m2/mdi/latest`
5. **How It Works:** Compares the rolling 3-month average of 7 indicators against a fixed 3-month baseline. For each indicator, it computes relative change, multiplies by directionality (adverse changes yield positive points), normalizes against a full-scale threshold, applies weights, and sums the contributions.
6. **Data Flow:** Monthly social & financial ratios $\rightarrow$ `compute_mdi()` $\rightarrow$ `mission_drift_scores` table $\rightarrow$ `/api/m2/mdi` $\rightarrow$ UI.
7. **Dependencies:** At least 3 months of baseline data and 3 months of recent monitoring data.
8. **Limitations:** Fixed weights ($w_i$) are defined by policy; they do not automatically adapt to regional economic shocks (e.g., inflation surges).
9. **Next Action:** Enable administrative configuration of MDI weights and alert thresholds via a settings screen.

---

### Feature E: Mission Drift Alerts & Resolution

1. **Purpose:** Generates actionable alerts when the MDI crosses the threshold and provides a formal managerial workflow to review, acknowledge, and resolve alerts.
2. **Current Status:** **Completed & Connected End-to-End.**
3. **User Perspective:** When MDI $\ge 20.0$, an alert appears in the alert inbox. The user can view the narrative, expand contributing factors, click "Acknowledge", and later click "Resolve" with their user ID recorded.
4. **Technical Implementation:**
   - Frontend Screen: [frontend/src/components/c2/MissionDriftAlerts.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/MissionDriftAlerts.jsx)
   - Model: `MissionDriftAlert` in `schema.prisma`
   - Endpoints: `GET /api/m2/alerts`, `PATCH /api/m2/alerts/:id`
5. **How It Works:** The seed script creates a `MissionDriftAlert` linked to July's MDI score ($22.43$). The frontend renders the alert. Clicking "Acknowledge" sends `PATCH /api/m2/alerts/:id` with `{ status: "acknowledged" }`, which updates the status and records `reviewedBy = req.user.userId`.
6. **Data Flow:** `mission_drift_alerts` table $\rightarrow$ `GET /api/m2/alerts` $\rightarrow$ User action $\rightarrow$ `PATCH /api/m2/alerts/:id` $\rightarrow$ Database update.
7. **Dependencies:** `MissionDriftScore` record with `thresholdState == "alert"`.
8. **Limitations:** Alerts are currently created during monthly batch seeding rather than via an asynchronous real-time event trigger.
9. **Next Action:** Add a free-text resolution justification note input in the resolution modal.

---

### Feature F: Profit & Loss (P&L) Report

1. **Purpose:** Displays revenues, operating expenses, financial expenses, and net profit for any selected accounting period.
2. **Current Status:** **Backend is Completed; Frontend UI uses Mock Data.**
3. **User Perspective:** The user navigates to `/p-and-l`. They see a detailed P&L statement with revenue and expense categories, monthly comparisons, and print/export buttons.
4. **Technical Implementation:**
   - Backend Engine: `profitAndLoss()` in [backend/src/lib/m2/reports.ts](file:///d:/Component%202/j26it326/backend/src/lib/m2/reports.ts)
   - Backend Route: `GET /api/m2/reports/pnl?from=YYYY-MM-DD&to=YYYY-MM-DD`
   - Frontend File: [frontend/src/components/c2/PAndLReport.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/PAndLReport.jsx)
5. **How It Works (Backend):** Sums credit lines for Account `4000` (Revenues) and debit lines for Accounts `5000`, `5100`, `5200`, `5300` (Expenses) between the `from` and `to` dates, returning gross revenue, categorized expenses, and net surplus.
6. **Data Flow:** General ledger lines $\rightarrow$ `profitAndLoss()` $\rightarrow$ `/api/m2/reports/pnl`.
7. **Dependencies:** Balanced journal entries in the tenant database.
8. **Limitations:** `PAndLReport.jsx` currently uses local state initialized with `INITIAL_TRANSACTIONS` in USD instead of calling `fetchPAndLReport()`.
9. **Next Action:** Wire `PAndLReport.jsx` to call `fetchPAndLReport(from, to)` and display Sri Lankan Rupees (LKR) instead of mock USD.

---

### Feature G: Social Performance Dashboard

1. **Purpose:** Displays detailed trends in female outreach, poverty alleviation progress, rural outreach, and client retention.
2. **Current Status:** **Backend is Completed; Frontend UI uses Mock Data.**
3. **User Perspective:** The user navigates to `/social-performance`. They see summary cards for female borrower percentage, poverty score, rural percentage, and charts displaying outreach trends.
4. **Technical Implementation:**
   - Backend Route: `GET /api/m2/social` in `m2.ts`
   - Frontend File: [frontend/src/components/c2/SocialPerformance.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/SocialPerformance.jsx)
   - Mock Data File: [frontend/src/components/c2/social-performance-data.js](file:///d:/Component%202/j26it326/frontend/src/components/c2/social-performance-data.js)
5. **How It Works (Backend):** Queries `social_performance_indicators` ordered by period and returns 12 months of outreach metrics.
6. **Data Flow:** `social_performance_indicators` table $\rightarrow$ `GET /api/m2/social`.
7. **Dependencies:** Seeded `social_performance_indicators` rows.
8. **Limitations:** `SocialPerformance.jsx` directly imports `SOCIAL_DASHBOARD_METRICS` from `social-performance-data.js` and does not invoke `fetchSocialIndicators()`.
9. **Next Action:** Refactor `SocialPerformance.jsx` to fetch live data using `fetchSocialIndicators()` from `m2-api.js`.

---

### Feature H: Financial and Social KPI Visualizations

1. **Purpose:** Renders longitudinal SVG charts displaying the 12-month MDI trajectory, velocity indicators, and trade-off comparison charts.
2. **Current Status:** **Completed & Connected.**
3. **User Perspective:** On `/mission-drift-detail`, users see a custom SVG chart scaled from $-10$ to $+40$, with a red dashed horizontal threshold line at $20$, and a bar chart showing top adverse contributing factors.
4. **Technical Implementation:**
   - File: [frontend/src/components/c2/MissionDriftDetail.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/MissionDriftDetail.jsx)
   - Sub-component: `MdiTrendChart` rendering pure SVG paths.
5. **How It Works:** Fetches 12 months of scores via `fetchMdiHistory()`. Maps data points to SVG coordinates `(x, y)` dynamically, rendering smooth connecting paths and interactive data dots.
6. **Data Flow:** `GET /api/m2/mdi` $\rightarrow$ `points` array $\rightarrow$ SVG `<path d="..." />`.
7. **Dependencies:** Populated `mission_drift_scores` table.
8. **Limitations:** Hover tooltips are basic HTML title attributes rather than rich interactive popovers.
9. **Next Action:** Add animated hover cards displaying the top two drivers for each past month on the timeline.

---

### Feature I: ML Pipeline and Predictive Model Training

1. **Purpose:** Provides predictive early warning capability by forecasting drift probability and numerical MDI score trajectory 3 months in advance.
2. **Current Status:** **Completed in Python; Models Trained & Artifacts Saved.** (Runs via offline/batch CLI, not yet served via live backend microservice).
3. **User Perspective:** Currently executed by researchers/engineers in Python. Generates `m2_intelligence_report.json` with branch rankings and forward probabilities.
4. **Technical Implementation:**
   - Feature Engineering: [ml/m2_mission_intel/features/drift_features.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/features/drift_features.py)
   - Training Script: [ml/m2_mission_intel/train/train_drift_model.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/train/train_drift_model.py)
   - Saved Models: `drift_xgb_classifier.joblib`, `drift_xgb_regressor.joblib`
   - Evaluation Notebook: `ml/notebooks/m2/01_mission_intelligence_and_drift_model.ipynb`
5. **How It Works:** Extracts 16 longitudinal features (rolling velocities, rate-of-change deltas). Trains an XGBoost Classifier (predicting whether MDI $\ge 20$ in next 3 months) and an XGBoost Regressor (predicting exact forward MDI score).
6. **Data Flow:** `kpi_monthly.csv` + `social_monthly.csv` $\rightarrow$ `compute_velocity_features()` $\rightarrow$ XGBoost `fit()` $\rightarrow$ Joblib artifacts.
7. **Dependencies:** Python virtual environment with `xgboost`, `scikit-learn`, `pandas`, `joblib`.
8. **Limitations:** The models are not yet deployed behind an Express route or FastAPI daemon; frontend cannot query them in real time without running the Python script.
9. **Next Action:** Build a lightweight FastAPI wrapper or Express child process runner to serve model predictions to the frontend.

---

### Feature J: M3 Loan Lifecycle Event Integration

1. **Purpose:** Enables event-driven accounting by subscribing to Component 3's loan disbursement and collection events.
2. **Current Status:** **M2 Webhook is Completed; M3 Caller Needs Header Update.**
3. **User Perspective:** When a field loan officer approves a disbursement or records a repayment in M3, a journal entry automatically appears in M2's ledger without manual entry.
4. **Technical Implementation:**
   - Webhook: [backend/src/routes/m2-events.ts](file:///d:/Component%202/j26it326/backend/src/routes/m2-events.ts)
   - M3 Sender: [backend/src/lib/m3/m2-events.ts](file:///d:/Component%202/j26it326/backend/src/lib/m3/m2-events.ts)
5. **How It Works:** M2 exposes `POST /api/m2/events/loan-lifecycle`. It verifies `x-internal-key`, resolves the tenant database using `payload.institutionId`, checks if `referenceId` (`disbursementId` or `collectionId`) has already been posted (idempotency), and executes `postJournalEntry()`.
6. **Data Flow:** Component 3 Action $\rightarrow$ HTTP POST $\rightarrow$ `m2-events.ts` $\rightarrow$ `ledger.ts` $\rightarrow$ `journal_entries`.
7. **Dependencies:** `M2_INTERNAL_KEY` set in `backend/.env`.
8. **Limitations:** M3 does not send `principalAmount` and `interestAmount` separately; all collections currently post 100% to principal reduction. M3 sender currently lacks the `x-internal-key` header in its HTTP request.
9. **Next Action:** Update `backend/src/lib/m3/m2-events.ts` to include `'x-internal-key': process.env.M2_INTERNAL_KEY`.

---

### Feature K: Authentication, Authorization & Tenant Isolation

1. **Purpose:** Ensures strict multi-tenant isolation and restricts financial actions to authorized roles.
2. **Current Status:** **Completed & Verified.**
3. **User Perspective:** Only users logged in as `finance_officer`, `executive`, or `admin` can access M2 routes. Unauthorized requests receive HTTP 401 or 403.
4. **Technical Implementation:**
   - Middleware: `authenticate`, `resolveTenantContext`, `requireRole` in [backend/src/middleware/auth.ts](file:///d:/Component%202/j26it326/backend/src/middleware/auth.ts)
   - Route Guard: Line 16 of [backend/src/routes/m2.ts](file:///d:/Component%202/j26it326/backend/src/routes/m2.ts)
5. **How It Works:** Every request extracts the JWT from `Authorization: Bearer <token>`, validates HS256 signature against `JWT_SECRET`, resolves the user's institution, connects to `req.tenantPrisma`, and checks role permissions before reaching handler logic.
6. **Data Flow:** HTTP Request $\rightarrow$ `authenticate` $\rightarrow$ `resolveTenantContext` $\rightarrow$ `requireRole` $\rightarrow$ `m2Router`.
7. **Dependencies:** Central database user and role tables.
8. **Limitations:** Audit logs in `audit_log` table currently record authentication events and agent actions, but do not yet record read-only views of P&L statements.
9. **Next Action:** Add audit log writes when financial statements are exported.

---

### Feature L: Tests, Validation Scripts & Error Handling

1. **Purpose:** Guarantees code correctness, prevents mathematical errors in financial calculations, and provides reproducible verification.
2. **Current Status:** **Substantially Completed** (Python ML test suite and 2 of 3 backend scripts pass; 1 backend test script has an import bug).
3. **User Perspective:** Developers run test commands to verify system integrity before demonstrations and grading.
4. **Technical Implementation:**
   - Python Suite: [ml/m2_mission_intel/tests/test_m2_ml.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/tests/test_m2_ml.py)
   - Ledger Verification: [backend/scripts/verify-m2-ledger.ts](file:///d:/Component%202/j26it326/backend/scripts/verify-m2-ledger.ts)
   - Seed Verification: [backend/scripts/verify-m2-seed.ts](file:///d:/Component%202/j26it326/backend/scripts/verify-m2-seed.ts)
   - API Verification: [backend/scripts/verify-m2-api.ts](file:///d:/Component%202/j26it326/backend/scripts/verify-m2-api.ts)
5. **How It Works:** Tests assert balanced debit/credit equality, verify MDI score shifts under adverse scenarios, validate XGBoost prediction bounds, and check REST API responses.
6. **Data Flow:** Test script $\rightarrow$ Mock / Seed Data $\rightarrow$ Asserts $\rightarrow$ Console PASS/FAIL.
7. **Dependencies:** Node.js v20+, Python venv with dependencies, active PostgreSQL database.
8. **Limitations:** `verify-m2-api.ts` currently fails with a SyntaxError because it attempts to import `generateAccessToken` instead of `signAccessToken` from `backend/src/lib/auth.js`.
9. **Next Action:** Update line 15 of `verify-m2-api.ts` to `import { signAccessToken } from "../src/lib/auth.js"`.

---

## 4. Financial Ledger and Accounting Logic

### Debit and Credit Foundations
Double-entry bookkeeping is based on the principle that every financial transaction has two equal and opposite effects:
- **Debit (Dr):** Increases Assets and Expenses; Decreases Liabilities, Equity, and Revenue.
- **Credit (Cr):** Increases Liabilities, Equity, and Revenue; Decreases Assets and Expenses.

### Chart of Accounts (Verified Implementation)
Component 2 uses 10 standardized accounts configured in `backend/src/lib/m2/ledger.ts`:

| Account Code | Account Name | Category | Normal Balance | Purpose in Microfinance |
|:---:|---|:---:|:---:|---|
| **1000** | Cash and Bank | Asset | Debit | Physical cash held in branch vaults and commercial bank accounts. |
| **1200** | Loan Portfolio Outstanding | Asset | Debit | Principal money owed to the MFI by active microfinance borrowers. |
| **1250** | Loan-Loss Allowance | Contra-Asset | Credit | Estimated reserve for delinquent loans that may default. |
| **2000** | Commercial Borrowings | Liability | Credit | Debt owed by the MFI to apex commercial banks or social investors. |
| **3000** | Retained Earnings & Equity | Equity | Credit | Net accumulated earnings and institutional reserve capital. |
| **4000** | Interest and Fee Income | Revenue | Credit | Interest, loan processing fees, and documentation charges earned. |
| **5000** | Staff Salary Expense | Expense | Debit | Remuneration for loan officers, branch managers, and head office staff. |
| **5100** | Other Operating Expenses | Expense | Debit | Office rent, motorcycle fuel for field collection, utilities, audits. |
| **5200** | Interest Expense / Funding Cost | Expense | Debit | Interest paid to commercial banks on borrowed capital. |
| **5300** | Loan-Loss Provision Expense | Expense | Debit | Monthly expense charged to P&L to replenish the loan-loss allowance. |

---

### The Accounting Equation & assertBalanced Rule
The fundamental accounting equation is enforced at all times:
$$\text{Total Assets} = \text{Total Liabilities} + \text{Total Equity}$$

The function `assertBalanced(lines)` in `backend/src/lib/m2/ledger.ts` guarantees this by validating:
$$\sum_{i} \text{DebitAmount}_i = \sum_{i} \text{CreditAmount}_i$$
If debits do not equal credits, or if any amount has more than 2 decimal places, or if any amount is negative, the function throws `LedgerError` and refuses to write to the database.

---

### Transaction Posting Rules

```
1. Loan Disbursement:
   Debit:   1200 Loan Portfolio Outstanding     (Asset increases)
   Credit:  1000 Cash and Bank                  (Asset decreases)

2. Loan Repayment Collection (Principal + Interest):
   Debit:   1000 Cash and Bank                  (Asset increases with collected cash)
   Credit:  1200 Loan Portfolio Outstanding     (Asset decreases by principal repaid)
   Credit:  4000 Interest and Fee Income        (Revenue increases by interest earned)

3. Monthly Staff Payroll:
   Debit:   5000 Staff Salary Expense           (Expense increases)
   Credit:  1000 Cash and Bank                  (Asset decreases)

4. Operating Costs (Rent, Fuel, Utilities):
   Debit:   5100 Other Operating Expenses       (Expense increases)
   Credit:  1000 Cash and Bank                  (Asset decreases)

5. Commercial Debt Service (Financing Cost):
   Debit:   5200 Interest Expense               (Expense increases)
   Credit:  1000 Cash and Bank                  (Asset decreases)

6. Loan Loss Provisioning:
   Debit:   5300 Provision Expense              (Expense increases on P&L)
   Credit:  1250 Loan-Loss Allowance            (Contra-asset increases, reducing net book value)
```

---

### Deriving Accounting Ratios from General Ledger Lines
In `backend/src/lib/m2/reports.ts`, ratios are calculated dynamically by aggregating lines:
- **Operating Revenue:** $\sum \text{Credits on Account 4000}$
- **Operating Expenses:** $\sum \text{Debits on Accounts 5000 and 5100}$
- **Total Operating Costs:** $\text{Opex} + \text{Interest Expense (5200)} + \text{Provision Expense (5300)}$
- **Operational Self-Sufficiency (OSS):**
  $$\text{OSS} = \frac{\text{Operating Revenue}}{\text{Total Operating Costs}}$$
  *Verified July 2026 value:* **1.0875** (Revenues cover 108.75% of all operational, funding, and loss costs).

---

## 5. Financial KPI Engine

### Portfolio Delinquency & The PAR30 Arrears Rule
In traditional banking, delinquency is measured in calendar days. In Sri Lankan microfinance, 99% of microloans use **weekly repayment schedules**. 

In the partner dataset (`data/private/par30_clean_no_pii.csv`), the column `age` represents the **number of overdue weekly installments**.
- **Rule Formulation:** Since 1 month has approximately 4.33 weeks, a loan is defined as overdue by more than 30 days if:
  $$\text{age} > 4.3 \text{ installments late}$$
- **July 2026 Real Partner Findings:**
  - Total Active Loans: **7,245**
  - Gross Outstanding Principal: **LKR 315,274,380.00**
  - Delinquent Loans ($> 4.3$ weeks late): **1,569 loans** (21.66% by loan count)
  - Delinquent Balance: **LKR 66,018,450.00**
  - **PAR30 by Balance:** **20.94%**

---

### Operational Self-Sufficiency (OSS)
- **Meaning:** Indicates whether the institution generates enough revenue to cover all operating expenses, financing costs, and loan default provisions without requiring grants or donor funding.
- **Formula:** $\text{OSS} = \frac{\text{Financial Revenue}}{\text{Operating Expense} + \text{Financial Expense} + \text{Loan Loss Provisions}}$
- **Benchmark:** MIX Market Sri Lanka median is $\approx 1.05$. Component 2 baseline is calibrated to **1.09**.

---

### Operating Expense Ratio (OER)
- **Meaning:** Measures the institutional efficiency of administering the loan book.
- **Formula:** $\text{OER} = \frac{\text{Annualized Operating Expenses}}{\text{Average Gross Loan Portfolio}}$
- **Benchmark:** MIX Market Sri Lanka 10-year median is **12.90%**. Component 2 baseline is calibrated to **12.90%**.

---

### Portfolio Yield & Contract-Implied Yield
- **Earned Portfolio Yield:** $\frac{\text{Annualized Cash Interest Income}}{\text{Average Loan Portfolio Outstanding}} \approx \mathbf{26.0\%}$.
- **Contract-Implied Flat Yield:** Median nominal interest stated on client contracts is $\approx \mathbf{59.8\%}$ per year flat. (This is high because microloans are uncollateralized weekly door-to-door loans; Component 2 records earned yield, not flat rate).

---

### Summary of KPI Formulas & Data Origins

| KPI Name | Standard Formula | Input Source | July 2026 Baseline | Data Status |
|---|---|---|:---:|:---:|
| **PAR30 (Balance)** | $\frac{\text{Balance of loans with age} > 4.3}{\text{Total Outstanding Principal}}$ | Real Partner PAR Extract | **20.94%** | Real Partner Data |
| **PAR30 (Count)** | $\frac{\text{Number of loans with age} > 4.3}{\text{Total Number of Loans}}$ | Real Partner PAR Extract | **21.66%** | Real Partner Data |
| **Gross Portfolio** | $\sum \text{Principal Balance of Active Loans}$ | Real Partner PAR Extract | **LKR 315.27M** | Real Partner Data |
| **Average Loan Size** | $\frac{\text{Total Contract Amount}}{\text{Total Number of Loans}}$ | Real Partner PAR Extract | **LKR 85,420** | Real Partner Data |
| **OSS** | $\frac{\text{Income (4000)}}{\text{Expenses (5000+5100+5200+5300)}}$ | General Ledger Lines | **1.0875** | Derived from GL |
| **OER** | $\frac{\text{Operating Expenses} \times 12}{\text{Average Gross Portfolio}}$ | General Ledger Lines | **12.90%** | Derived from GL |
| **Portfolio Yield** | $\frac{\text{Interest Income} \times 12}{\text{Average Gross Portfolio}}$ | General Ledger Lines | **26.00%** | Derived from GL |

---

## 6. Mission Drift Index (MDI)

### What MDI Measures
The Mission Drift Index (MDI) is a novel quantitative metric designed specifically for this research project. It measures the degree to which an MFI's client portfolio has shifted away from underserved demographics (poor households, women, rural communities, first-time borrowers) towards wealthier, larger, or urban borrowers over time.

---

### Mathematical Formulation & Weights
The MDI evaluates 7 dimensions configured in [ml/m2_mission_intel/config/mdi_settings.toml](file:///d:/Component%202/j26it326/ml/m2_mission_intel/config/mdi_settings.toml):

| Indicator ($i$) | Meaning | Weight ($w_i$) | Adverse Direction | Full Scale ($\text{FS}_i$) |
|---|---|:---:|:---:|:---:|
| **female** | Share of female borrowers | **0.25** | Decrease ($\downarrow$) | $20\%$ drop |
| **poverty** | Share of clients below poverty line | **0.20** | Decrease ($\downarrow$) | $20\%$ drop |
| **rural** | Share of rural borrowers | **0.15** | Decrease ($\downarrow$) | $15\%$ drop |
| **low_income** | Share of bottom-40% income clients | **0.15** | Decrease ($\downarrow$) | $15\%$ drop |
| **avg_loan_size** | Average contracted loan size | **0.15** | Increase ($\uparrow$) | $20\%$ expansion |
| **new_to_banking** | Share of first-time formal borrowers | **0.10** | Decrease ($\downarrow$) | $20\%$ drop |
| **dropout** | Monthly client exit / dropout rate | **0.10** | Increase ($\uparrow$) | $50\%$ surge |
| **Total Weight** | | **1.10** | | |

---

### Rolling Window vs. Institutional Baseline
To prevent temporary seasonal spikes (such as harvest cycles or holiday expenses) from triggering false alarms, the MDI compares:
1. **Institutional Baseline:** The 3-month rolling mean of the initial observation period ($t_0, t_1, t_2$).
2. **Current Period:** The 3-month rolling mean of the most recent observation period ($t-2, t-1, t$).

$$\text{Baseline}_i = \frac{1}{3} \sum_{k=0}^{2} X_{i, k}, \quad \text{Current}_i = \frac{1}{3} \sum_{k=0}^{2} X_{i, t-k}$$

---

### Score Normalization & Directionality
For each indicator:
1. **Relative Change:**
   $$\text{RelChange}_i = \frac{\text{Current}_i - \text{Baseline}_i}{\text{Baseline}_i}$$
2. **Adverse Change Directionality:**
   $$\text{AdverseChange}_i = \begin{cases} -\text{RelChange}_i & \text{if adverse direction is decrease} \\ +\text{RelChange}_i & \text{if adverse direction is increase} \end{cases}$$
3. **Bounded Indicator Contribution:**
   $$\text{Contribution}_i = w_i \times \min\left(1.0, \max\left(-1.0, \frac{\text{AdverseChange}_i}{\text{FullScale}_i}\right)\right) \times 100$$
4. **Total MDI Score:**
   $$\text{MDI} = \sum_{i=1}^{7} \text{Contribution}_i$$

---

### Threshold Crossing & Score Interpretation

```
MDI Score Range:
  < 0.0:        Mission Deepening  (Outreach to poor, women, and rural clients is improving)
  0.0 - 15.0:   Stable Alignment   (Minor normal operational variance)
  15.0 - 19.9:  Watch Zone         (Early warning signs; monitoring recommended)
  >= 20.0:      ALERT TRIGGERED    (Significant mission drift; managerial review required)
```

**July 2026 Demo Finding:**
- Score: **22.43 (ALERT)**
- Top Contributing Drivers:
  1. *Below Poverty Line Share:* fell by $6.8\%$ (Contributed $+6.8$ points)
  2. *Female Outreach Share:* fell by $5.2\%$ (Contributed $+6.5$ points)
  3. *Average Loan Size:* expanded by $8.6\%$ (Contributed $+6.4$ points)
  4. *Rural Outreach Share:* fell by $4.8\%$ (Contributed $+4.8$ points)

---

### Formula-Based Scoring vs. Machine Learning Prediction
- **Important Distinction:** The retrospective MDI score calculation in `mdi/mdi.py` is a **deterministic, formula-based scoring engine**. It uses exact mathematical weights and rules. It is **NOT** a machine learning model.
- The **Machine Learning (ML)** component in Component 2 consists of separate forward-looking predictive models (XGBoost) described in [Section 9](#9-machine-learning-and-data-science).

---

## 7. Mission Drift Alerts

### Alert Generation Trigger
An alert is generated when:
$$\text{MDI Score} \ge \text{Threshold (20.0)}$$
When this condition is met, the backend inserts a row into `mission_drift_alerts` linked to the corresponding `mission_drift_scores` record.

### Severity Levels & Structured Evidence Storage
Alerts are classified into three operational severities based on score magnitude and velocity ($\Delta \text{MDI} / \Delta t$):
1. **CRITICAL:** $\text{MDI} \ge 30.0$ (Score is $1.5\times$ threshold).
2. **ALERT:** $20.0 \le \text{MDI} < 30.0$ (Threshold crossed).
3. **WATCH:** $15.0 \le \text{MDI} < 20.0$ OR Monthly Velocity $\ge +5.0$ points/month.

**Structured Evidence Attached:**  
The alert record does not store arbitrary text; it links directly to `contributingTrends` JSON containing:
- Baseline value, Current value, Relative % change, and Points contributed for all 7 indicators.

---

### Alert Lifecycle & Interactive Resolution Workflow
The alert management screen implements a three-stage lifecycle:
1. **Status `new`:** The alert has been triggered and is unreviewed. Displayed with a red badge.
2. **Status `acknowledged`:** The finance officer has opened the alert, reviewed the contributing trends, and clicked "Acknowledge".
3. **Status `resolved`:** The management committee has decided on corrective action (e.g., reallocating loan caps to rural branches) and clicked "Resolve".

The API endpoint `PATCH /api/m2/alerts/:id` updates the status and records `reviewedBy` using the authenticated user's ID.

---

## 8. Social Performance Dashboard

### Implemented Social Outreach Indicators

| Indicator | Meaning & Research Definition | Calibration Source | July 2026 Baseline | Implemented Engine |
|---|---|---|:---:|:---:|
| **Female Borrower Ratio** | Proportion of total active borrowers who identify as female. | MIX Market Sri Lanka median prior (78%) | **72.7%** | `kpi/kpi_engine.py` |
| **Rural Outreach Share** | Proportion of borrowers residing in rural or estate sectors. | Sri Lanka Census 2012 prior (77.4% rural, 4.4% estate) | **73.8%** | `kpi/kpi_engine.py` |
| **Poverty Proxy Score** | Proportion of borrower households living below national poverty line ($\text{income} / (\text{dependants}+1) < \text{threshold}$). | DCS basic needs poverty line prior (LKR 17,000) | **48.3%** | `kpi/kpi_engine.py` |
| **Low-Income Share** | Share of borrowers in the bottom 40th national income deciles. | World Bank Findex Sri Lanka benchmark | **65.4%** | `kpi/kpi_engine.py` |
| **New-to-Banking Ratio** | Proportion of first-time borrowers entering the formal financial system. | M1 expert prior proxy (`first_time_borrower`) | **20.2%** | `kpi/kpi_engine.py` |
| **Client Dropout Rate** | Proportion of borrowers leaving the MFI each month. | Annualized prior (3.0% monthly exit) | **3.0%** | `kpi/kpi_engine.py` |

---

### Frontend Reality vs. Backend Reality
- **Backend Reality:** The database table `social_performance_indicators` contains 12 months of longitudinal outreach data, served via `GET /api/m2/social`.
- **Frontend Reality:** The screen [SocialPerformance.jsx](file:///d:/Component%202/j26it326/frontend/src/components/c2/SocialPerformance.jsx) currently imports static mock data from `social-performance-data.js`. The page displays visually rich metric cards, but is **not yet wired** to consume the live `/api/m2/social` endpoint.

---

## 9. Machine Learning and Data Science

### Trained Model Verification
Component 2 has trained, evaluated, and serialized two machine learning models located in `ml/m2_mission_intel/artifacts/`:
1. **Classifier:** `drift_xgb_classifier.joblib` (118.7 KB)
2. **Regressor:** `drift_xgb_regressor.joblib` (188.3 KB)
3. **Metadata File:** [drift_model_metadata.json](file:///d:/Component%202/j26it326/ml/m2_mission_intel/artifacts/drift_model_metadata.json)

---

### Features and Targets
- **Dataset:** 420 longitudinal monthly observation windows generated across institutional and branch scenarios (315 training samples, 105 holdout test samples).
- **Feature Set (16 Features Engineered in `drift_features.py`):**
  1. `current_mdi`: Current period retrospective MDI score
  2. `mdi_velocity_1m`: 1-month MDI change velocity
  3. `avg_loan_size`: Current average loan size
  4. `loan_size_growth_3m`: 3-month rolling growth rate in loan size
  5. `female_borrower_ratio`: Current female borrower share
  6. `female_ratio_change_3m`: 3-month shift in female outreach
  7. `poverty_proxy_score`: Current poverty cohort share
  8. `poverty_change_3m`: 3-month shift in poverty outreach
  9. `rural_borrower_ratio`: Current rural borrower share
  10. `rural_change_3m`: 3-month shift in rural outreach
  11. `par30_ratio`: Current portfolio delinquency ratio
  12. `par30_change_3m`: 3-month shift in PAR30
  13. `portfolio_yield`: Current earned portfolio yield
  14. `oer_ratio`: Current operating expense ratio
  15. `oss_ratio`: Current operational self-sufficiency
  16. `new_to_banking_ratio`: Current new-to-banking borrower share
- **Targets:**
  - *Classifier Target:* Binary indicator ($0$ or $1$) of whether MDI will cross the alert threshold ($\ge 20.0$) within the next 3 months.
  - *Regressor Target:* Continuous numerical value of the MDI score 3 months in the future.

---

### Evaluation Metrics & Benchmark Results
From verified metadata in `drift_model_metadata.json`:

| Model | Primary Metric | Score | Additional Metrics |
|---|---|:---:|---|
| **XGBoost Early Warning Classifier** | **ROC-AUC** | **0.9493** | Accuracy: 91.43% \| Precision: 1.0000 \| Recall: 0.7500 \| F1: 0.8571 \| 5-Fold CV Mean: 0.9638 |
| **XGBoost Trajectory Regressor** | **R² Score** | **0.9524** | Mean Absolute Error (MAE): 2.7911 points |

**Top 5 Most Important Features (Feature Importance):**
1. `current_mdi`: **33.26%**
2. `mdi_velocity_1m`: **19.01%**
3. `loan_size_growth_3m`: **5.87%**
4. `poverty_proxy_score`: **5.38%**
5. `par30_ratio`: **5.01%**

---

### Current Deployment Reality (Batch vs. Live Service)
- **What is working:** The Python batch script [batch_drift_score.py](file:///d:/Component%202/j26it326/ml/m2_mission_intel/serve/batch_drift_score.py) loads both models, scores the institution, evaluates all 17 branches, generates grounded narratives, and outputs `data/processed/m2_intelligence_report.json`.
- **What is NOT working yet:** The backend Express server does not currently expose a route to trigger model inference on demand. Forward predictive scores are not currently displayed in the React frontend.

---

## 10. M3 Event Integration

### Expected Event Payloads
Component 3 (Loan Lifecycle) emits two events over HTTP to Component 2:

```json
// Event 1: Loan Disbursed
{
  "event": "loan_disbursed",
  "payload": {
    "loanId": "a0000000-0000-0000-0000-000000000001",
    "disbursementId": "b0000000-0000-0000-0000-000000000001",
    "amount": 50000.00,
    "date": "2026-07-15",
    "institutionId": "c0000000-0000-0000-0000-000000000001"
  }
}

// Event 2: Payment Collected
{
  "event": "payment_collected",
  "payload": {
    "loanId": "a0000000-0000-0000-0000-000000000001",
    "collectionId": "d0000000-0000-0000-0000-000000000001",
    "amount": 2500.00,
    "date": "2026-07-22",
    "institutionId": "c0000000-0000-0000-0000-000000000001",
    "principalAmount": 2000.00,   // Optional
    "interestAmount": 500.00      // Optional
  }
}
```

---

### Webhook Authentication & Tenant Routing
1. **Authentication:** The webhook checks the request header `x-internal-key` against `process.env.M2_INTERNAL_KEY` using timing-safe buffer comparison. If the key is missing or shorter than 16 characters, it returns HTTP 503; if incorrect, it returns HTTP 401.
2. **Tenant Routing:** The webhook extracts `payload.institutionId` and calls `resolveTenantByInstitutionId()`, obtaining the dedicated Prisma client for that specific MFI.

---

### Idempotency & Deduplication
Network retries often cause duplicate event delivery. To prevent double-posting:
- The webhook stores `payload.disbursementId` or `payload.collectionId` in the `referenceId` column of `journal_entries`.
- `postJournalEntry()` queries whether a journal entry with that `referenceId` already exists.
- If it exists, it skips creation and returns HTTP 200 with `{ duplicate: true }`.

---

### Identified Integration Gaps with Component 3
1. **Missing Authentication Header in M3:** In `backend/src/lib/m3/m2-events.ts`, M3's `postEvent()` function currently sends `headers: { "Content-Type": "application/json" }` without the required `x-internal-key` header.
2. **Lack of Principal/Interest Split:** M3's collection schedule emits only total `amount`. Until M3 passes `principalAmount` and `interestAmount`, M2 posts 100% of collected money to principal reduction (Account `1200`), under-reporting interest income.

---

## 11. Testing and Verification Audit

### Automated Test Execution Results

| Test Suite / Script | Command | Result | What It Verifies |
|---|---|:---:|---|
| **Python ML & Analytics Test Suite** | `python ml/m2_mission_intel/tests/test_m2_ml.py` | **100% PASSED** (6/6 tests) | PAR30 4.3 rule, social formulas, pure MDI calculation, feature engineering, XGBoost inference, grounded narrative engine, and 17-branch ranking. |
| **Backend Ledger Test** | `npx tsx scripts/verify-m2-ledger.ts` | **PASSED** | Validates balanced multi-line entries and asserts that unbalanced entries throw `LedgerError`. |
| **Backend Seed Test** | `npx tsx scripts/verify-m2-seed.ts` | **PASSED** | Verifies 73 balanced journal entries, P&L net surplus, Balance Sheet equality, July PAR30 20.94%, and July MDI 22.43 alert. |
| **Backend API Route Test** | `npx tsx scripts/verify-m2-api.ts` | **FAILED** (SyntaxError) | Failed due to an export mismatch in test code (`generateAccessToken` vs `signAccessToken`). |

---

### Identified Test Failures & Environment Prerequisites
- **The Bug in `verify-m2-api.ts`:**
  Line 15 of `backend/scripts/verify-m2-api.ts` imports `{ generateAccessToken }` from `../src/lib/auth.js`. However, `auth.js` exports `{ signAccessToken }`. Changing the import name resolves the error.
- **Environment Prerequisites:**
  - Node.js v20+ with `npx tsx`.
  - Active PostgreSQL server with tenant database migrated.
  - Python 3.11+ virtual environment (`ml/m2_mission_intel/.venv`) with packages in `pyproject.toml` or `requirements.txt`.

---

## 12. Current Implementation Status Summary Table

| Feature / Subsystem | Implementation Status | Evidence / Key Files | Main Missing Work | Priority |
|---|:---:|---|---|:---:|
| **Double-Entry Ledger** | **Completed** | `lib/m2/ledger.ts`, `schema.prisma` | Frontend manual journal posting form | Medium |
| **P&L and Balance Sheet Engine** | **Completed** | `lib/m2/reports.ts`, `/api/m2/reports/*` | Connect `PAndLReport.jsx` to live API | High |
| **KPI Calculation Engine** | **Completed** | `kpi/kpi_engine.py`, `reports.ts` | Historical real PAR data ingestion | Low |
| **Retrospective MDI Engine** | **Completed** | `mdi/mdi.py`, `mdi_settings.toml` | UI weight configuration modal | Low |
| **MDI Alerts & Resolution** | **Completed** | `MissionDriftAlerts.jsx`, `m2.ts` | Free-text resolution note field | Low |
| **Finance Manager Dashboard** | **Completed** | `FinanceManagerDashboard.jsx` | Historical month selector dropdown | Medium |
| **Mission Drift Dashboard & Detail** | **Completed** | `MissionDriftDashboard.jsx`, `Detail.jsx` | Rich hover cards on SVG chart | Low |
| **Social Performance Dashboard** | **Partial (Mock UI)** | `SocialPerformance.jsx`, `/api/m2/social` | Wire React page to call `/api/m2/social` | High |
| **P&L Report Screen** | **Partial (Mock UI)** | `PAndLReport.jsx`, `/api/m2/reports/pnl` | Wire React page to call `/api/m2/reports/pnl` | High |
| **Predictive ML (XGBoost)** | **Completed (Offline)** | `train_drift_model.py`, `artifacts/` | Expose predictions via live REST API | Medium |
| **Grounded Narrative Engine** | **Completed** | `narrative_engine.py`, `test_m2_ml.py` | Direct integration with LLM API | Low |
| **Branch Risk Ranking (17 Branches)** | **Completed (CLI)** | `batch_drift_score.py`, `report.json` | Build Branch Comparison screen in UI | Medium |
| **M3 Lifecycle Webhook** | **Completed (M2)** | `routes/m2-events.ts` | M3 must add header & principal split | High |
| **API Automated Verification** | **Fix Needed** | `scripts/verify-m2-api.ts` | Fix import name to `signAccessToken` | Critical |

---

## 13. Remaining Tasks and Implementation Roadmap

### Priority 1: Core Financial and Demonstration Requirements
*Must be completed to eliminate mock data and ensure seamless presentation.*

1. **Fix API Verification Script (`backend/scripts/verify-m2-api.ts`):**
   - *Why:* Ensures continuous automated testing of all M2 REST endpoints.
   - *Files:* `backend/scripts/verify-m2-api.ts`
   - *Action:* Change line 15 import from `generateAccessToken` to `signAccessToken`.
   - *Definition of Done:* `npx tsx scripts/verify-m2-api.ts` exits with code 0.

2. **Wire `SocialPerformance.jsx` to Live Backend API:**
   - *Why:* Replaces hardcoded mock data in `social-performance-data.js` with live database snapshots.
   - *Files:* `frontend/src/components/c2/SocialPerformance.jsx`, `frontend/src/lib/m2-api.js`
   - *Action:* Use `useEffect` to call `fetchSocialIndicators()` and populate metrics state.
   - *Definition of Done:* Social performance cards update dynamically from the tenant database.

3. **Wire `PAndLReport.jsx` to Live Backend API:**
   - *Why:* Replaces static USD mock transactions with actual general ledger P&L calculations.
   - *Files:* `frontend/src/components/c2/PAndLReport.jsx`
   - *Action:* Call `fetchPAndLReport(from, to)` and render income/expenses in LKR.
   - *Definition of Done:* P&L reflects ledger accounts `4000` through `5300`.

---

### Priority 2: Integration Hardening & Correctness
*Required for full multi-component integration with M3 and M4.*

4. **Align M3 Webhook Caller Header:**
   - *Why:* Prevents HTTP 401 Unauthorized errors when M3 dispatches real loan lifecycle events.
   - *Files:* `backend/src/lib/m3/m2-events.ts`
   - *Action:* Attach `'x-internal-key': process.env.M2_INTERNAL_KEY` in `postEvent()`.
   - *Definition of Done:* Disbursing a loan in M3 automatically generates a journal entry in M2.

5. **Request Principal & Interest Split from M3:**
   - *Why:* Enables exact revenue recognition for microfinance collections.
   - *Files:* `backend/src/lib/m3/m2-events.ts`, `backend/src/routes/m2-events.ts`
   - *Action:* Update M3 repayment schedule to supply `principalAmount` and `interestAmount`.
   - *Definition of Done:* Repayments credit both Account `1200` (Principal) and Account `4000` (Interest).

6. **Update Poverty Line to Official DCS Value:**
   - *Why:* Replaces placeholder threshold (LKR 17,000) with official government statistical data.
   - *Files:* `ml/m2_mission_intel/config/m2_priors.toml`
   - *Action:* Look up Department of Census and Statistics latest poverty threshold and rerun `make_m2_synthetic.py`.
   - *Definition of Done:* Updated poverty line recorded in metadata and reflected in MDI.

---

### Priority 3: Advanced ML Microservice, UI Extensions & Research
*For PP2, comprehensive multi-branch intelligence, and final academic thesis evaluation.*

7. **Deploy Live Model Inference Microservice:**
   - *Why:* Displays forward predictive drift risk directly on executive web dashboards.
   - *Files:* `backend/src/routes/m2.ts`, `ml/m2_mission_intel/serve/batch_drift_score.py`
   - *Action:* Add Express endpoint `GET /api/m2/predictive-drift` returning forward probabilities from XGBoost.
   - *Definition of Done:* Dashboard displays "Predicted 90-Day Drift Probability: 12% (Low Risk)".

8. **Build Branch Comparison UI View:**
   - *Why:* Allows management to compare drift risk across all 17 branches.
   - *Files:* `frontend/src/components/c2/BranchComparison.jsx` (New)
   - *Action:* Render the 17-branch ranking table generated by `batch_drift_score.py`.
   - *Definition of Done:* Interactive sortable table ranking branches by portfolio drift.

9. **Conduct Formal SUS Usability Evaluation:**
   - *Why:* Required for SLIIT final dissertation research evaluation.
   - *Files:* `docs/SUS_Evaluation_Instrument_M2.md`
   - *Action:* Survey 10 microfinance loan officers and branch managers using a 10-item System Usability Scale questionnaire.
   - *Definition of Done:* Documented SUS score $\ge 68$ in Chapter 5 of the dissertation.

---

## 14. Recommended End-to-End Verification

Follow these step-by-step instructions to verify the entire Component 2 implementation:

### Step 1: Python Virtual Environment & Test Suite
```bash
# 1. Navigate to workspace root
cd "d:\Component 2\j26it326"

# 2. Run the full Python ML & Analytics test suite
ml\m2_mission_intel\.venv\Scripts\python ml\m2_mission_intel\tests\test_m2_ml.py
```
*Expected Output:*
```text
[PASS] test_kpi_engine_par_and_social
[PASS] test_mdi_pure_computation
[PASS] test_drift_feature_engineering
[PASS] test_xgboost_model_artifacts (prob=98.63%, pred_score=29.10)
[PASS] test_grounded_narrative_nfr06
[PASS] test_batch_drift_score_pipeline (17 branches ranked)
ALL M2 ML TESTS PASSED SUCCESSFULLY!
```

---

### Step 2: Database Ledger Verification
```bash
# 1. Navigate to backend directory
cd backend

# 2. Verify double-entry ledger rules
npx tsx scripts/verify-m2-ledger.ts
```
*Expected Output:*
```text
verify-m2-ledger: all posting rules balance; unbalanced/invalid entries are refused
```

---

### Step 3: Seed Demonstration Data & Check Ratios
```bash
# 1. Run M2 demo seeder
npx tsx scripts/seed-m2-demo.ts

# 2. Verify seeded tenant ledger
npx tsx scripts/verify-m2-seed.ts
```
*Expected Output:*
```text
journal entries: 73, all balanced
balance sheet 2026-07-31: assets 355,879,034.42 = liabilities 175,022,030.43 + equity 180,857,003.99
P&L Jul 2026: income 6,840,950.07, expenses 6,290,737.74, net 550,212.33
KPI Jul 2026 (par): PAR30 20.94%, OSS 1.0875, OER 0.13, yield 0.26, portfolio 315,268,701.82
MDI Jul 2026: 22.43 (alert), alerts linked: 1
verify-m2-seed: OK
```

---

### Step 4: Start Applications & Review Dashboards
```bash
# Terminal 1: Launch Backend API (Port 4000)
cd backend
npm run dev

# Terminal 2: Launch Frontend App (Port 5173)
cd frontend
npm run dev
```
Open a browser and navigate to:
1. `http://localhost:5173/finance` — Check that live liquidity, balance sheet, and MDI alert banner appear.
2. `http://localhost:5173/mission-drift` — Verify that the MDI gauge displays $22.4$ with the Alert badge.
3. `http://localhost:5173/mission-drift-detail` — Inspect the longitudinal SVG timeline and threshold line at $20$.
4. `http://localhost:5173/mission-drift-alerts` — Test clicking "Acknowledge" and "Resolve" on the July alert.

---

## 15. Final Summary & Assessment

### What Component 2 Currently Does
Component 2 successfully unites the two opposing halves of microfinance:
1. It maintains an audit-grade **double-entry ledger** that ensures no rupee goes unaccounted for and enforces mathematical balance on all transactions.
2. It tracks **social outreach metrics** and computes the **Mission Drift Index (MDI)**, alerting management the moment lending policy drifts away from poor, rural female borrowers.
3. It features trained **predictive XGBoost models** capable of forecasting drift 90 days in advance with high accuracy (**ROC-AUC: 0.9493**).

### What is Genuinely Implemented
- The **double-entry money ledger** (`ledger.ts`, `reports.ts`) is fully implemented and tested.
- The **KPI calculation engine** (`kpi_engine.py`) with the $>4.3$ weekly arrears rule is fully implemented.
- The **MDI mathematical formula** (`mdi.py`) and threshold alert triggers are fully implemented.
- The **predictive XGBoost models** (`train_drift_model.py`, saved `.joblib` artifacts) are trained and validated.
- The **grounded narrative engine** (`narrative_engine.py`) generates structured explanations compliant with NFR-06.
- The **finance dashboard, drift dashboard, detail view, and alerts triage screen** in React are connected to live backend APIs.

### What is Incomplete
- `SocialPerformance.jsx` and `PAndLReport.jsx` currently display mock data because they are not yet wired to call their live backend endpoints.
- Predictive XGBoost model inference runs in Python CLI/batch mode and is not yet served over a live REST endpoint.
- Component 3's event dispatcher needs the `x-internal-key` header added to complete automated webhook posting.
- One backend test script (`verify-m2-api.ts`) requires a one-line import correction.

### Demonstration Readiness Assessment
- **Status for PP1 Demonstration (October 21, 2026):** **DEMO READY.**  
  The core workflow required for the PP1 milestone—Finance Dashboard $\rightarrow$ Mission Drift Dashboard $\rightarrow$ Mission Drift Alerts Screen & Resolution—is fully functional, backed by live general ledger calculations and real partner anchor data.
- **Status for PP2 & Final Submission:** Requires connecting the remaining two frontend screens (`SocialPerformance.jsx` and `PAndLReport.jsx`), serving predictive models via API, and completing the SLIIT dissertation chapters.
