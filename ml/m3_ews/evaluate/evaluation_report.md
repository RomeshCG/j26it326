# M3 Early Warning System — Comparative Evaluation Report

## 1. Executive Summary

The EWS predictive model was evaluated on a cohort of **1500 loans** against the conventional rule-based **PAR30 baseline**.

### Benchmark Comparison

| Metric | Rule-Based PAR30 | EWS (XGBoost) | Advantage |
| :--- | :--- | :--- | :--- |
| **Precision** | 100.00% | 100.00% | +0.00% |
| **Recall** | 86.67% | 100.00% | +13.33% |
| **F1-Score** | 0.9286 | 1.0000 | +0.0714 |
| **Prediction Lead Time** | 0 days (reactive) | **~42 days** | **Early intervention enabled** |

## 2. Top Distinguishing Distress Signals

- **`days_since_last_payment`**: 0.3826
- **`avg_days_late_3m`**: 0.3109
- **`repayment_on_time_rate_3m`**: 0.2983
- **`repayment_on_time_rate_6m`**: 0.0082
- **`consecutive_missed`**: 0.0000

## 3. Confusion Matrix Breakdown

- True Positives: 210
- False Positives: 0
- False Negatives: 0
- True Negatives: 1290

*Report generated automatically by M3 evaluation suite.*
