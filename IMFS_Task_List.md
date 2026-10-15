# IMFS (J26-IT-326) — Task List: M1, M2, M3 & M4

**Database architecture:** PostgreSQL, **database-per-tenant**. One central database (institutions, auth/users, tenant metadata, DB connection info, subscriptions, system config) owned by M4, plus one separate physical database per institution/MFI, provisioned from a shared tenant schema. Full table design: see `IMFS_ERD.dbml` (paste into dbdiagram.io).

---

## 0. Shared setup (do together, before solo coding starts)

- [ ] Agree the tenant-DB schema together (one database per institution, provisioned identically each time) — every component's tables live in it
- [ ] M4 builds the tenant-provisioning flow: create a new Postgres database for a new institution, run migrations, register it in the central DB's `institution_databases` table
- [ ] M4 builds the request-routing layer: every API request resolves `institution_id` → correct tenant DB connection before touching any business table
- [ ] Decide where cross-database `user_id` validation happens (e.g. a shared auth-check helper every backend service calls) — needed because `users` lives in the central DB but almost every tenant table references a user
- [ ] Lock the monorepo folder structure:
  ```
  /backend      → FastAPI, shared + all components' routes
  /frontend     → React app, shared design system + per-component pages
  /ml           → M1's Python/XGBoost/SHAP service
  /agents       → M4's LangChain agents
  /db
    /central    → central DB schema/migrations
    /tenant     → tenant DB schema/migrations (provisioned per institution)
  /docs         → diagrams, API contracts
  ```
- [ ] M4 exposes a stub/mock auth + tenant-routing API early so M1/M2/M3 aren't blocked waiting for the full backend
- [ ] Agree API contract format (e.g. OpenAPI/Swagger) for endpoints each component will consume from another

---

## 1. M1 — Explainable Credit Risk Assessment

### ML
- [ ] Synthetic dataset generator (3,000–5,000 records) matching the agreed tenant schema
- [ ] Feature engineering: repayment history, household cash flow, income stability, debt burden, savings behaviour, loan-to-cash-flow ratio, group/guarantee strength, verification indicators
- [ ] Train/tune XGBoost baseline model
- [ ] Evaluate: Accuracy, Precision, Recall, F1-score, ROC-AUC, confusion matrix
- [ ] Implement SHAP local explanations
- [ ] Implement SHAP interaction-value analysis (pairwise feature effects → Compensatory / Compounding / Independent)
- [ ] Build reliance-adaptive prompt logic (tracks officer's correct-follow / incorrect-follow / unnecessary-override history → selects explanation mode)
- [ ] GenAI narrative generation via LLM API — must be grounded strictly in risk score + SHAP + interaction evidence, and must never alter the underlying score

### BE
- [ ] `risk_assessments`, `shap_explanations`, `shap_interactions`, `reliance_profiles`, `decision_log` tables in the tenant DB (columns coordinated with M4, the schema owner)
- [ ] `/assess-risk` endpoint(s) — consumed by the loan-application module (M3); confirm the request/response contract with M3 directly
- [ ] Endpoint to record the loan officer's final decision → write to `decision_log`
- [ ] Validate `user_id` (loan officer) against the central DB before writing `reliance_profiles`/`decision_log` rows
- [ ] Wire all endpoints through M4's auth/RBAC once available (restrict to loan-officer role)

### FE
- [ ] Risk Report screen: risk score, classification, risk contributors, interaction matrix, plain-language explanation, Accept / Override actions (build to the Appendix H mockup)
- [ ] Officer Trust Calibration Profile screen: historical decisions, reliance %, explanation-style toggle
- [ ] Use M4's shared design system/components rather than styling independently

### PP1 target (realistic, ~1 month out)
- [ ] Dataset generator working
- [ ] Baseline XGBoost trained and evaluated on synthetic data
- [ ] Basic SHAP output working end-to-end (interaction analysis + adaptive layer can come after)

---

## 2. M2 — Dual-Mission Performance Intelligence Dashboard

### BE / Financial Engine
- [ ] `chart_of_accounts` table + seed standard account list (cash, loan portfolio, interest income, salary expense, loan loss provision, etc.)
- [ ] `journal_entries` + `journal_entry_lines` tables — every posting must balance (sum of debits = sum of credits)
- [ ] Posting rules for each supported event: disbursement, principal repayment, interest received, salary, write-off
- [ ] Subscribe to **C3's events** (disbursement, each recorded collection) and **C4's events** (approved payroll) to auto-post journal entries — do not write directly into C3/C4's tables
- [ ] Generate P&L, balance sheet, cash-flow views from the ledger
- [ ] Unit tests: every posting rule balances; independently-calculated reference P&L matches system output

### BE / KPI & Social Analytics
- [ ] Financial KPI calculations: PAR30, OSS, OER, Portfolio Yield, Cost per Borrower, Write-Off Ratio → `financial_kpi_snapshots` (one row per period)
- [ ] Social indicator calculations: female borrower ratio, new-to-banking ratio, dropout rate, poverty proxy score, literacy progress, group solidarity score → `social_performance_indicators`
- [ ] Monthly snapshot job so each period's values are retained as history (needed for the MDI's rolling window)

### BE / Mission Drift Index (the core novelty)
- [ ] Implement `MDI = w1·female_ratio_trend + w2·new_to_banking_trend + w3·poverty_proxy_trend + w4·dropout_rate_trend + w5·avg_loan_size_trend`, rolling 3-month window vs. institution-specific baseline → `mission_drift_scores`
- [ ] Document and make weights/threshold configurable; validate against known synthetic scenarios (improving/stable/deteriorating trends)
- [ ] Threshold-crossing alert → `mission_drift_alerts`, with the contributing indicators attached as structured evidence
- [ ] GenAI narrative layer: consumes the structured MDI evidence only, must not alter any calculated value (NFR-06) — explains what changed financially, what changed socially, and the likely trade-off

### FE
- [ ] Management dashboard: financial KPIs + social indicators + MDI status, filterable by branch/period
- [ ] Mission-drift alert view: score, contributing indicators, trend direction, GenAI narrative
- [ ] Branch-comparison view
- [ ] Use M4's shared design system

### PP1 target (realistic, ~1 month out)
- [ ] Chart of accounts + double-entry posting working for at least disbursement/repayment events
- [ ] At least one financial KPI (e.g. PAR30) calculated correctly against test data
- [ ] Basic dashboard shell showing ledger-derived numbers (MDI and GenAI narrative can come after, per M2's own WBS — MDI isn't due until month 5–6)

---

## 3. M3 — Loan Lifecycle Management & Early Warning System (EWS)

### ML
- [x] Feature engineering: repayment timing, collection-visit outcomes, disbursement/application history, group-level repayment ratio & arrears features, event-sequence encoding (ordered repayment/visit history per borrower and group)
- [x] Train and compare two candidate model families: gradient-boosted tree (static/aggregate features) vs. LSTM/GRU (temporal event sequence)
- [x] Temporal (time-based) train/validation/test split — not random k-fold, to avoid look-ahead bias
- [x] Class-imbalance handling (distress is a minority-class event)
- [x] Select alert operating threshold from validation results
- [x] Lightweight explainability layer: short plain-language rationale per alert from feature-importance/most-recent-events (distinct in scope from M1's SHAP engine)
- [x] Nightly batch job: PAR30/overdue computation + EWS distress scoring for every active loan/group, completing within the overnight window
- [x] Evaluate against the rule-based PAR30 baseline: Precision/Recall/F1, prediction lead-time, SUS ≥ 68
- [x] Shadow-pilot validation: compare EWS alerts vs. what PAR30 would have flagged over the same period

### BE
- [x] `borrowers`, `lending_groups`, `group_members`, `loan_applications`, `loans`, `repayment_schedules` tables in the tenant DB (coordinate with M4, the schema owner)
- [x] `collections`, `receipts`, `par_status`, `ews_scores`, `ews_alerts`, `interventions`, `group_repayment_stats` tables
- [x] Loan application → Branch Manager approval workflow → auto-generated repayment schedule
- [x] Field collection + receipting endpoints, offline-tolerant (local queue, sync on reconnect)
- [x] **C3 → C1**: synchronous call for a risk score at application time
- [x] **C3 → C2**: emit events on disbursement and on each recorded collection (C2 subscribes; C3 does not write into C2's tables)
- [x] All auth/role checks (Loan Officer vs Branch Manager) delegated to M4's auth service; validate `user_id`s against the central DB
- [x] Intervention logging endpoint (officer records action taken on an alert + outcome)

### FE
- [x] Loan application screen (individual/group) showing live risk score pulled from M1
- [x] Branch Manager approval queue
- [x] Field collection entry screen (mobile-first, offline-tolerant) + digital receipt display
- [x] Loan Officer alert inbox: ranked EWS alerts for assigned borrowers/groups with plain-language rationale
- [x] Branch Manager portfolio overview + branch-level EWS dashboard
- [x] Intervention logging UI + outcome tracking view
- [x] Use M4's shared design system

### PP1 target (realistic, ~1 month out)
- [x] Loan officer/branch manager interviews and survey underway (instrument already drafted in Appendix 1.1)
- [x] Basic loan lifecycle CRUD working against the agreed schema: application → approval → repayment schedule generation
- [x] First-pass feature engineering script + rule-based PAR30 computation running (full ML model and shadow-pilot come later, per M3's own WBS)

---

## 4. M4 — Agentic ERP / Graduated Trust Architecture (critical path — M1/M2/M3 depend on this)

### BE — highest priority
- [ ] **Central DB**: `institutions`, `institution_databases`, `subscriptions`, `system_configurations`, `roles`, `users`, `login_audit`
- [ ] Tenant provisioning flow: new institution signup → create its dedicated Postgres database → run tenant schema migrations → register the connection in `institution_databases`
- [ ] Request-routing layer: resolve `institution_id` from the authenticated session → select the correct tenant DB connection for every request
- [ ] JWT auth + RBAC for the 6 roles (central DB `users`/`roles`)
- [ ] 5-step onboarding wizard backend (creates the institution + provisions its database)
- [ ] **Tenant DB**: `branches`, `employees`, `payroll_records` tables
- [ ] HR/payroll module with EPF/ETF calculation + auto-posting event to M2's ledger (don't write into M2's tables directly — emit an event M2 subscribes to)
- [ ] Agent orchestration layer: Agent 1 (Compliance), Agent 2 (Workflow Orchestrator), Agent 3 (Anomaly Detection), Agent 4 (NLQ) via LangChain + LLM API
- [ ] Graduated Trust tier engine: classify action → Tier 1–4 → execute / execute-and-notify / prepare-and-approve / alert-only
- [ ] `agent_actions` + `audit_log` tables (tenant DB) capturing all required fields (agent ID, action, inputs, model/prompt version, tier, justification, tools used, approval/override status, result, timestamp)
- [ ] Expose a stable stub API (auth + tenant routing) early, before agents are fully built, so other components can integrate against it

### FE
- [ ] Login/signup + onboarding wizard UI
- [ ] Role-based dashboard skeletons for all 6 roles
- [ ] Executive dashboard (portfolio health, financial snapshot, HR headcount, agent activity feed)
- [ ] Tier-3 approval queue screen
- [ ] Global "Ask Agent 4" NLQ widget as a shared component other members (e.g. M1's Risk Report page) can embed
- [ ] Shared design system / component library (owned by M4 per the responsibility table)

### PP1 target (realistic, ~1 month out)
- [ ] Central DB + tenant provisioning flow working for at least one test institution
- [ ] Auth + RBAC working
- [ ] Onboarding wizard skeleton functional
- [ ] Stub API live so M1/M2/M3 can start integrating

---

## Notes
- **Database architecture decision:** moved from a single shared Postgres instance (RLS + `institution_id` on every table) to **database-per-tenant** — one central DB for system-level data, one separate physical database per institution for business data. This is a stronger isolation guarantee (a bug can't leak across institutions even at the query level, since there's no other institution's data in the same database) and removes the need for `institution_id` on every tenant table. Trade-off: cross-database references (mainly `user_id`) can no longer be enforced as real foreign keys and must be validated at the application layer — see `IMFS_ERD.dbml` for every place this applies.
- M3's proposal integrates via REST/event API contracts rather than components reading each other's tables directly. That convention is kept even though M1/M2/M3/M4's tables now sit physically together inside each tenant database: each table has one owning component, everyone else goes through that component's API.
- M2's financial/social/MDI tables are now fully modelled in `IMFS_ERD.dbml` (`chart_of_accounts`, `journal_entries`, `journal_entry_lines`, `financial_kpi_snapshots`, `social_performance_indicators`, `mission_drift_scores`, `mission_drift_alerts`).
- `IMFS_Database_Schema.sql` reflects the earlier shared-DB design and is now superseded by `IMFS_ERD.dbml` — treat the DBML file as the current source of truth going forward.
- Update this file as tasks are completed or re-scoped — it's meant to be a living checklist, not a one-time plan.
