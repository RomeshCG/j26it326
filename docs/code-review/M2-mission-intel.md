# Code review: M2 (Mission Intelligence / Finance KPIs)

Scope: `frontend/src/components/c2`, `ml/m2_mission_intel`, and any M2 backend. Based on what is in this repo; if M2 work lives elsewhere, please tell us so the review can be updated.
Method: read the code and ran ESLint. The aim is to help us all present a defensible project.

## Biggest gap: M2 is front-end with mock data only

| Area | State in the repo |
|---|---|
| `ml/m2_mission_intel/` (`kpi`, `mdi`, `narrative`) | Empty (`.keep` placeholder files only) |
| Backend | No M2 routes. M3's `lib/m3/m2-events.ts` already posts loan events to an M2 endpoint (`M2_SERVICE_URL`) that does not exist, so those events are only logged |
| Frontend `c2` | About 2,650 lines. No API calls (0 `fetch`), data comes from `mock-data.js` and `social-performance-data.js` |

For a research project, the ML/analytics part (mission drift index, KPI model, grounded narratives) is the research contribution. Right now there is nothing to evaluate, so this is the highest priority.

## Against the task list (`internalDocs/IMFS_Task_List.md`, `M2_ML_FE_BE_TODO.md`)

The project briefing calls M2 "the core novelty" (Mission Drift Index). The M2 plan itself says the screens are "beautiful mock dashboards" and that the panel will see a UI prototype unless these exist:

- [ ] Double-entry ledger: journal posting rules that balance (Prisma models exist, nothing uses them)
- [ ] Subscription to M3 disbursement/collection events and M4 payroll events
- [ ] Financial KPIs (PAR30, OSS, OER, yield, cost per borrower, write-off ratio) saved to `financial_kpi_snapshots`
- [ ] Social indicators saved to `social_performance_indicators`, with monthly snapshots for the rolling window
- [ ] MDI formula with configurable weights, a rolling 3-month window vs a baseline, validated on known scenarios
- [ ] Alerts with structured evidence, and a narrative layer that may not change any calculated value
- [ ] `/api/m2/*` routes behind `authenticate -> resolveTenantContext -> requireRole`
- [ ] Unit tests: every posting balances, and a hand-calculated P&L matches the system

Suggested order: ledger + one KPI (PAR30 from the real PAR file) -> MDI formula on synthetic scenarios -> narrative -> wire the screens.

## Gaps

| # | Gap | Suggested fix |
|---|---|---|
| 1 | No MDI / KPI / narrative code or models | Implement and evaluate them; the planned layout already exists in `ml/m2_mission_intel` |
| 2 | No backend endpoint to receive M3's events | Add an internal route and agree the payload (`m2-events.ts` has the types) |
| 3 | UI shows mock numbers, so they can't be validated | Wire to real data (PAR from M1, MIX Market benchmarks in `ml/shared/data`) |
| 4 | Very large files: `PAndLReport.jsx` 923 lines, `SocialPerformance.jsx` 859 | Split into smaller components |
| 5 | `MissionDriftAlerts.jsx` is 1 line (stub) | Implement or remove |
| 6 | Lint: 5 problems (unused variables in `PAndLReport.jsx` 3, `SocialPerformance.jsx` 2) | Remove unused variables |
| 7 | No tests | Add tests for the KPI calculations once they exist |

## Research-quality note

Whatever MDI or narrative method you build, the paper will need: a clear definition of "mission drift", a validation against real or documented cases, and an honest statement of which numbers are synthetic or from MIX Market benchmarks.

## Things done well

- Clean separation into dashboard, detail and report screens.
- Public datasets for benchmarks are already collected (`ml/shared/data`).
