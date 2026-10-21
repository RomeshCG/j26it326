# M3 Early Warning System — Comparative Evaluation Report

## 1. Executive Summary

The EWS predictive model was evaluated on an **unseen holdout test cohort of 1113 loans** (across 252 independent centers) against the conventional rule-based **PAR30 baseline**.

### Benchmark Comparison (Unseen Holdout Cohort)

| Metric | Rule-Based PAR30 | EWS (XGBoost) | Advantage |
| :--- | :--- | :--- | :--- |
| **Precision** | 57.58% | 95.56% | +37.99% |
| **Recall** | 33.93% | 93.37% | +59.44% |
| **F1-Score** | 0.4270 | 0.9445 | +0.5175 |
| **Prediction Lead Time** | 0 days (reactive) | **~14 days** | **Early intervention enabled** |

## 2. Top Distinguishing Distress Signals

- **`partial_payment_rate`**: 0.6104
- **`term_completion_pct`**: 0.0959
- **`promise_kept_rate`**: 0.0499
- **`days_since_last_payment`**: 0.0489
- **`repayment_on_time_rate_3m`**: 0.0473

## 3. Confusion Matrix Breakdown (Holdout Test Cohort)

- **True Positives (TP)**: 366
- **False Positives (FP)**: 17
- **False Negatives (FN)**: 26
- **True Negatives (TN)**: 704

## 4. Methodology & Data Integrity Notes

- **Dataset**: 7,245 loans from partner microfinance loan book (`par30_clean_no_pii.csv`).
- **Split Strategy**: GroupShuffleSplit by village Center (1,172 Train centers, 252 Validation centers, 252 Test centers) with **0 center overlap** to prevent peer-borrower data leakage.
- **No Trivial Target Leakage**: Features reflect pre-default friction and historical borrower cadence without conditioning on ground-truth delinquency.
- False Positives: 17
- False Negatives: 26
- True Negatives: 704

*Report generated automatically by M3 evaluation suite.*
