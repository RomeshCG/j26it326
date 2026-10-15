# Code review: M1 (Credit Risk)

Scope: `ml/m1_credit_risk`, `ml/notebooks/m1`, and the M1 frontend (`risk-report`, `application-profile`, `borrower-management`, `trust-profile`, `ab-experiment`).
Method: read the code, ran ESLint and the training scripts, and checked results against the real PAR file. The aim is to help us all present a defensible project, not to rank people.

## Status after the review

The model was rebuilt in this review: the old target `risk_pct` was a formula of its own inputs (R² 0.999, meaningless). It now predicts `overdue` (PAR `age` > 1) from loan terms only, with grouped cross-validation and baselines. Honest AUC is about 0.81 (base rate 0.50). Details are in `ml/m1_credit_risk/features/feature_list.md`.

## Gaps against the project briefing / task list

Checked against `internalDocs/PROJECT_BRIEFING.md` and `IMFS_Task_List.md`:

| # | Gap | Evidence |
|---|---|---|
| A | **The M1 backend is now on this branch** (merged with `main`) | Still on `feature/m1-wire-fe`, not yet merged to `main`; open a PR once the frontend is updated |
| B | **Backend now serves the new model** | `risk-score.ts` is a client for the FastAPI service (`ml/m1_credit_risk/serve/app.py`); the old heuristic is removed. Needs the Python service running; 503 otherwise |
| C | **Frontend still sends the old features** | `map-api-report.js` / `buildAssessFeatures` send arrears fields (invented defaults) and no `product_type`, so the live report call will get a 400 until the frontend is updated. M3's stub calls `/assess-risk` with borrower demographics, a different contract; tell M3 |
| D | **Task-list items with no code** | SHAP interaction analysis (only a UI matrix exists), reliance-adaptive logic, GenAI narrative grounded in score + SHAP, `decision_log` endpoint with `user_id` validation |
| E | **Evaluation is thinner than promised** | Task list asks for accuracy, precision, recall, F1, ROC-AUC and a confusion matrix. Done: AUC, PR-AUC, Brier. Missing: confusion matrix and threshold metrics |
| F | **Features the task list promises are not in the PAR data** | Household cash flow, income stability, savings behaviour, guarantee strength. State this limitation in the paper |
| G | **Trust-profile, A/B and reliance screens** | Make sure they do not display invented numbers as findings |

## Gaps still open (ML)

| # | Gap | Why it matters | Suggested fix |
|---|---|---|---|
| 1 | PAR `age` confirmed as arrears age (team) | Label basis settled | Record the partner's exact unit (days vs periods) when known |
| 2 | Single PAR snapshot (ongoing loans); two more planned | The model shows who is overdue now, not who will become overdue | When the new snapshots arrive, train on one and test on the next for a true future-default result |
| 3 | Branch dominates the explanations | The model may reflect local conditions, not borrower risk | Report it, and add a per-branch analysis |
| 4 | Risk bands (0.33 / 0.66) are arbitrary | Not tuned or calibrated | Tune on validation data, add a calibration plot |
| 5 | Demographic columns (gender, area, income) are expert-prior fills | Independent of repayment, so only noise as predictors | Use for fairness slicing only; document the elicitation method |
| 6 | Old scripts `generate_synthetic.py` and `merge_par_synthetic.py` still build the circular `risk_pct` | Easy to run by mistake | Mark deprecated or remove after the team agrees |
| 7 | HTTP route done (on this branch); UI not updated | See C above | Update the frontend, then PR to `main` |
| 8 | `ml/requirements.txt` is not pinned and is shared | Results may not reproduce | Pin versions (needs group agreement) |
| 9 | ML has no CI | Tests only run by hand | Add `ml` tests to a CI workflow |

## Frontend lint (M1 files)

- `risk-report/`: 3 problems (`AdaptiveExplanation.jsx` 2, `ShapInteractionMatrix.jsx` 1)
- `application-profile/`: 4 problems (unused variables, `FormFields.jsx` exports)

## Things done well

- PII removal is done before any file is shared.
- The scripts are small, documented and reproducible from the CLI.
- Tests now exist for the label, leakage guard and pipeline (`ml/m1_credit_risk/tests/test_overdue.py`).
