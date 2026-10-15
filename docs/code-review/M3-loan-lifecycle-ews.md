# Code review: M3 (Loan Lifecycle, Collections, Early Warning)

Scope: `backend/src/routes/m3`, `backend/src/lib/m3`, `ml/m3_ews`, `frontend/src/components/c3`.
Method: read the code, ran ESLint and `tsc`, and read the evaluation scripts. The aim is to help us all present a defensible project.

## Highest priority: the EWS evaluation numbers

| Finding | Evidence | Why it matters |
|---|---|---|
| Perfect scores on synthetic data | `evaluation_report.md`: precision 100%, recall 100%, 0 false positives, 0 false negatives | The generator (`generate_synthetic_data.py`) builds each loan's features *from* its label (`target_distress`), so the model learns the generator, not real behaviour |
| Lead time is hardcoded | `evaluate_model.py` sets `avg_lead_time_days = 42 if advance_detected > 0 else 30`, and `shadow_pilot.py` sets `average_lead_time_days = 42` | The "~42 days early" claim is not measured |
| "PAR30 baseline" is built from the same features | `par30_preds` uses `avg_days_late_3m` and `consecutive_missed`, which are also model inputs | The comparison is circular |
| `sus_benchmark_target: 68.0` is written into the pilot results | `shadow_pilot_results.json` | SUS is a user-survey score and can't come from a script |
| "Risk mitigated LKR 1,096,938" | Computed from synthetic loans | Not a real saving |

**Suggested fix:** keep the synthetic data for software tests, but evaluate on the real PAR file. For example, test whether features computed before a cutoff date predict loans that go overdue after it (needs two snapshots), or at least split by center. Compute lead time from dates, and report the SUS score only from real participants (`docs/SUS_Evaluation_Instrument_M3.md` is ready for this). Until then, label these results as "synthetic demo".

## Against the task list (`IMFS_Task_List.md`, `M3_STATUS_AND_TODO.md`)

Your own status doc already says the task list overclaims. Confirmed in code:

| Claim in task list | Reality |
|---|---|
| LSTM/GRU compared against the tree model | **No LSTM/torch code in the repo.** Build it, or drop the claim and say "tree model v1" |
| Temporal train/validation/test split | `train_model.py` has a split, but the data is synthetic, so check it is time-based and not leaking the same contract |
| Class-imbalance handling and operating threshold | Not verified against real data |
| C3 -> C1 risk score at application time | Calls `/assess-risk` (stub). The real M1 path is `POST /api/risk/assess` with the Bearer JWT, and M1's contract is changing (see the M1 file) |
| SUS >= 68 | Written into a results file. Needs real participants |
| Offline-tolerant collections | Not verified; narrow the claim to "online-first v1" if not built |
| Retrain on real PAR | Not done yet; the M3 doc says it must be |

## Backend gaps

| # | Gap | Evidence | Suggested fix |
|---|---|---|---|
| 1 | All 8 route files use `mock-auth` | `lib/m3/mock-auth.ts` trusts `x-mock-user-id` / `x-mock-role` headers, so any client can claim any role | Switch to the real `middleware/auth.ts` (the file says to). Coordinate with M4 |
| 2 | Error messages leaked to clients | About 35 places return `err.message` in 500 responses | One shared error handler that returns a generic message and logs the detail |
| 3 | Validation is uneven | `par.ts` has no Zod; `ews.ts` very little; query strings are cast manually | Validate query and body with Zod everywhere |
| 4 | `any` in `collections.ts` (`tx: any`, `tx as any`) and `applications.ts` | Hides type errors in money handling | Use Prisma's transaction client type |
| 5 | `m2-events.ts` only logs events | M2 endpoint doesn't exist yet | Agree the contract with M2, add retry or an outbox if events matter |
| 6 | No automated tests | Only manual `verify-*.ts` scripts | Add tests for repayment schedule and PAR calculation (money logic) |

## Frontend (`c3`) gaps

- Lint: 8 problems (unused variables in `BranchPortfolio.jsx` 3, `CollectionRecording.jsx` 2, `EwsAlertDetail.jsx` 1; impure call in `DisbursementConfirm.jsx`; `setState` in an effect in `EwsAlertInbox.jsx`).
- `mock-data.js` is 888 lines and 10 files still reference mock data; check that each screen uses the real API (`lib/m3-api.js`) and remove the mock afterwards.
- Two files are large (`LoanApplicationForm.jsx` 366, `EwsAlertDetail.jsx` 355). These are acceptable, but `mock-data.js` should not ship.

## ML code gaps

- `generate_synthetic_data.py` (285 lines) and `train_model.py` (265) are readable, but there are no unit tests.
- No time-based split on the synthetic data, and no baseline other than the circular one.

## Things done well

- Tenant isolation and role checks are consistently called (`resolveTenant`, `requireRole`).
- Good route documentation headers; `SUS_Evaluation_Instrument_M3.md` is ready to use with real users.
- Batched collection processing uses transactions.
