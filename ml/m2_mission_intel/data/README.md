# M1 data (local only for generated files)

Create these folders on your machine when you start generating datasets:

```text
data/
  synthetic/   ← generated CSVs / parquet (GITIGNORED — do not commit)
  private/     ← customer / demo source extracts (GITIGNORED)
  raw/         ← any raw dumps (GITIGNORED)
  processed/   ← intermediate features (GITIGNORED)
  samples/     ← optional tiny public samples only (can be committed)
```

**Push generator scripts to git. Do not push the synthetic dataset files.**

Example local path after you generate:

`ml/m1_credit_risk/data/synthetic/loan_risk_synthetic_v1.csv`
