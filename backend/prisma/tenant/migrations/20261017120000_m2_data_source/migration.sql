-- M2: data_source labelling + KPI portfolio fields (additive, nullable/defaulted)
ALTER TABLE "journal_entries" ADD COLUMN "data_source" TEXT NOT NULL DEFAULT 'app';

ALTER TABLE "financial_kpi_snapshots"
  ADD COLUMN "portfolio_outstanding" DECIMAL(16,2),
  ADD COLUMN "avg_loan_size" DECIMAL(14,2),
  ADD COLUMN "data_source" TEXT NOT NULL DEFAULT 'synthetic';

ALTER TABLE "social_performance_indicators" ADD COLUMN "data_source" TEXT NOT NULL DEFAULT 'synthetic';

ALTER TABLE "mission_drift_scores" ADD COLUMN "data_source" TEXT NOT NULL DEFAULT 'synthetic';
