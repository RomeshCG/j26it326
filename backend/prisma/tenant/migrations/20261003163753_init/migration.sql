-- CreateTable
CREATE TABLE "tenant_info" (
    "id" INTEGER NOT NULL,
    "institution_id" UUID NOT NULL,
    "institution_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_info_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "district" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "position" TEXT,
    "employment_status" TEXT NOT NULL DEFAULT 'active',
    "epf_number" TEXT,
    "etf_number" TEXT,
    "joined_at" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_branch_assignments" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_branch_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "gross_pay" DECIMAL(14,2) NOT NULL,
    "epf_amount" DECIMAL(14,2) NOT NULL,
    "etf_amount" DECIMAL(14,2) NOT NULL,
    "net_pay" DECIMAL(14,2) NOT NULL,
    "posted_to_ledger" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tier_policies" (
    "id" UUID NOT NULL,
    "action_type" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "tier" SMALLINT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_tier_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_actions" (
    "id" UUID NOT NULL,
    "policy_id" UUID,
    "agent_name" TEXT NOT NULL,
    "tier" SMALLINT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "confidence" DECIMAL(5,2),
    "input_payload" JSONB,
    "output_payload" JSONB,
    "status" TEXT NOT NULL,
    "approved_by" UUID,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "loan_application_id" UUID NOT NULL,
    "risk_score" DECIMAL(8,4) NOT NULL,
    "classification" TEXT NOT NULL,
    "recommendation" TEXT,
    "model_version" TEXT,
    "explanation_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shap_explanations" (
    "id" UUID NOT NULL,
    "risk_assessment_id" UUID NOT NULL,
    "feature_name" TEXT NOT NULL,
    "contribution" DECIMAL(12,6) NOT NULL,
    "direction" TEXT NOT NULL,

    CONSTRAINT "shap_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shap_interactions" (
    "id" UUID NOT NULL,
    "risk_assessment_id" UUID NOT NULL,
    "feature_a" TEXT NOT NULL,
    "feature_b" TEXT NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "interaction_value" DECIMAL(12,6) NOT NULL,

    CONSTRAINT "shap_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reliance_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "preferred_explanation_mode" TEXT,
    "correct_follow_count" INTEGER NOT NULL DEFAULT 0,
    "incorrect_follow_count" INTEGER NOT NULL DEFAULT 0,
    "override_count" INTEGER NOT NULL DEFAULT 0,
    "calibration_status" TEXT NOT NULL DEFAULT 'calibrated',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reliance_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_log" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "context_type" TEXT NOT NULL,
    "reference_id" UUID NOT NULL,
    "ai_recommendation" TEXT,
    "human_decision" TEXT,
    "explanation_mode" TEXT,
    "reasoning" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_products" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "product_category" TEXT NOT NULL,
    "default_interest_rate" DECIMAL(8,4) NOT NULL,
    "min_amount" DECIMAL(14,2) NOT NULL,
    "max_amount" DECIMAL(14,2) NOT NULL,
    "min_term_months" INTEGER NOT NULL,
    "max_term_months" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loan_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrowers" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "nic_number" TEXT NOT NULL,
    "contact_number" TEXT,
    "gender" TEXT,
    "date_of_birth" DATE,
    "address_line" TEXT,
    "district" TEXT,
    "locality_type" TEXT,
    "monthly_income" DECIMAL(14,2),
    "income_band" TEXT,
    "occupation" TEXT,
    "household_size" INTEGER,
    "is_new_to_banking" BOOLEAN,
    "poverty_proxy_score" DECIMAL(8,4),
    "kyc_status" TEXT NOT NULL DEFAULT 'pending',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "borrowers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "borrower_documents" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "borrower_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lending_groups" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "group_name" TEXT NOT NULL,
    "leader_borrower_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'forming',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lending_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "role_in_group" TEXT,
    "joined_at" DATE,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "application_type" TEXT NOT NULL,
    "borrower_id" UUID,
    "group_id" UUID,
    "requested_amount" DECIMAL(14,2) NOT NULL,
    "requested_term_months" INTEGER,
    "purpose" TEXT,
    "purpose_detail" TEXT,
    "collateral_type" TEXT,
    "collateral_detail" JSONB,
    "guarantor_name" TEXT,
    "guarantor_nic" TEXT,
    "guarantor_contact" TEXT,
    "wizard_payload" JSONB,
    "submitted_by" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "decision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_documents" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "document_type" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loans" (
    "id" UUID NOT NULL,
    "application_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "group_id" UUID,
    "principal" DECIMAL(14,2) NOT NULL,
    "interest_rate" DECIMAL(8,4) NOT NULL,
    "term_months" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_disbursement',
    "activated_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disbursements" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" TEXT NOT NULL,
    "reference_number" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "disbursed_by" UUID,
    "disbursed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repayment_schedules" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "installment_no" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "principal_due" DECIMAL(14,2) NOT NULL,
    "interest_due" DECIMAL(14,2) NOT NULL,
    "amount_due" DECIMAL(14,2) NOT NULL,
    "amount_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'upcoming',

    CONSTRAINT "repayment_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "collections" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "visit_date" DATE NOT NULL,
    "outcome" TEXT NOT NULL,
    "amount_collected" DECIMAL(14,2) NOT NULL,
    "promise_date" DATE,
    "synced_offline_entry" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" UUID NOT NULL,
    "collection_id" UUID NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "par_status" (
    "id" UUID NOT NULL,
    "loan_id" UUID NOT NULL,
    "par_bucket" TEXT NOT NULL,
    "days_past_due" INTEGER NOT NULL DEFAULT 0,
    "outstanding_principal" DECIMAL(14,2),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "par_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ews_signals" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "group_id" UUID,
    "loan_id" UUID,
    "signal_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "signal_value" DECIMAL(14,4),
    "observed_at" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ews_signals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ews_scores" (
    "id" UUID NOT NULL,
    "borrower_id" UUID NOT NULL,
    "group_id" UUID,
    "distress_score" DECIMAL(8,4) NOT NULL,
    "risk_band" TEXT NOT NULL,
    "model_version" TEXT,
    "fusion_summary" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ews_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ews_alerts" (
    "id" UUID NOT NULL,
    "ews_score_id" UUID NOT NULL,
    "assigned_officer_id" UUID,
    "branch_id" UUID NOT NULL,
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "ews_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "id" UUID NOT NULL,
    "alert_id" UUID NOT NULL,
    "officer_id" UUID NOT NULL,
    "action_taken" TEXT NOT NULL,
    "outcome" TEXT,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_repayment_stats" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "repayment_ratio" DECIMAL(8,4) NOT NULL,
    "arrears_count" INTEGER NOT NULL,
    "arrears_ratio" DECIMAL(8,4) NOT NULL,

    CONSTRAINT "group_repayment_stats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chart_of_accounts" (
    "id" UUID NOT NULL,
    "account_code" TEXT NOT NULL,
    "account_name" TEXT NOT NULL,
    "account_type" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "chart_of_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" UUID NOT NULL,
    "transaction_date" DATE NOT NULL,
    "reference_type" TEXT NOT NULL,
    "reference_id" UUID,
    "description" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" UUID NOT NULL,
    "journal_entry_id" UUID NOT NULL,
    "account_id" UUID NOT NULL,
    "debit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_kpi_snapshots" (
    "id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "par30" DECIMAL(8,4),
    "oss" DECIMAL(8,4),
    "oer" DECIMAL(8,4),
    "portfolio_yield" DECIMAL(8,4),
    "cost_per_borrower" DECIMAL(14,2),
    "write_off_ratio" DECIMAL(8,4),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "financial_kpi_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_performance_indicators" (
    "id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "female_borrower_ratio" DECIMAL(8,4),
    "rural_borrower_ratio" DECIMAL(8,4),
    "low_income_client_ratio" DECIMAL(8,4),
    "new_to_banking_ratio" DECIMAL(8,4),
    "outreach_coverage" DECIMAL(8,4),
    "dropout_rate" DECIMAL(8,4),
    "poverty_proxy_score" DECIMAL(8,4),
    "literacy_progress" DECIMAL(8,4),
    "group_solidarity_score" DECIMAL(8,4),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_performance_indicators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_drift_scores" (
    "id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "mdi_score" DECIMAL(8,4) NOT NULL,
    "threshold_state" TEXT NOT NULL,
    "contributing_trends" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_drift_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mission_drift_alerts" (
    "id" UUID NOT NULL,
    "mdi_score_id" UUID NOT NULL,
    "narrative" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "reviewed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mission_drift_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_branch_id_idx" ON "employees"("branch_id");

-- CreateIndex
CREATE INDEX "user_branch_assignments_user_id_idx" ON "user_branch_assignments"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_branch_assignments_user_id_branch_id_key" ON "user_branch_assignments"("user_id", "branch_id");

-- CreateIndex
CREATE INDEX "payroll_records_employee_id_idx" ON "payroll_records"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_tier_policies_action_type_key" ON "agent_tier_policies"("action_type");

-- CreateIndex
CREATE INDEX "agent_actions_status_idx" ON "agent_actions"("status");

-- CreateIndex
CREATE INDEX "agent_actions_tier_idx" ON "agent_actions"("tier");

-- CreateIndex
CREATE INDEX "audit_log_created_at_idx" ON "audit_log"("created_at");

-- CreateIndex
CREATE INDEX "risk_assessments_loan_application_id_idx" ON "risk_assessments"("loan_application_id");

-- CreateIndex
CREATE INDEX "shap_explanations_risk_assessment_id_idx" ON "shap_explanations"("risk_assessment_id");

-- CreateIndex
CREATE INDEX "shap_interactions_risk_assessment_id_idx" ON "shap_interactions"("risk_assessment_id");

-- CreateIndex
CREATE UNIQUE INDEX "reliance_profiles_user_id_key" ON "reliance_profiles"("user_id");

-- CreateIndex
CREATE INDEX "decision_log_user_id_idx" ON "decision_log"("user_id");

-- CreateIndex
CREATE INDEX "decision_log_context_type_reference_id_idx" ON "decision_log"("context_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_products_code_key" ON "loan_products"("code");

-- CreateIndex
CREATE UNIQUE INDEX "borrowers_nic_number_key" ON "borrowers"("nic_number");

-- CreateIndex
CREATE INDEX "borrowers_branch_id_idx" ON "borrowers"("branch_id");

-- CreateIndex
CREATE INDEX "borrower_documents_borrower_id_idx" ON "borrower_documents"("borrower_id");

-- CreateIndex
CREATE INDEX "lending_groups_branch_id_idx" ON "lending_groups"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_borrower_id_key" ON "group_members"("group_id", "borrower_id");

-- CreateIndex
CREATE INDEX "loan_applications_branch_id_idx" ON "loan_applications"("branch_id");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE INDEX "loan_applications_submitted_by_idx" ON "loan_applications"("submitted_by");

-- CreateIndex
CREATE INDEX "application_documents_application_id_idx" ON "application_documents"("application_id");

-- CreateIndex
CREATE INDEX "loans_borrower_id_idx" ON "loans"("borrower_id");

-- CreateIndex
CREATE INDEX "loans_status_idx" ON "loans"("status");

-- CreateIndex
CREATE INDEX "disbursements_loan_id_idx" ON "disbursements"("loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "repayment_schedules_loan_id_installment_no_key" ON "repayment_schedules"("loan_id", "installment_no");

-- CreateIndex
CREATE INDEX "collections_loan_id_idx" ON "collections"("loan_id");

-- CreateIndex
CREATE INDEX "collections_officer_id_idx" ON "collections"("officer_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_receipt_number_key" ON "receipts"("receipt_number");

-- CreateIndex
CREATE INDEX "par_status_loan_id_idx" ON "par_status"("loan_id");

-- CreateIndex
CREATE INDEX "ews_signals_borrower_id_observed_at_idx" ON "ews_signals"("borrower_id", "observed_at");

-- CreateIndex
CREATE INDEX "ews_scores_borrower_id_idx" ON "ews_scores"("borrower_id");

-- CreateIndex
CREATE INDEX "ews_alerts_status_idx" ON "ews_alerts"("status");

-- CreateIndex
CREATE INDEX "interventions_alert_id_idx" ON "interventions"("alert_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_repayment_stats_group_id_period_key" ON "group_repayment_stats"("group_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "chart_of_accounts_account_code_key" ON "chart_of_accounts"("account_code");

-- CreateIndex
CREATE INDEX "journal_entries_transaction_date_idx" ON "journal_entries"("transaction_date");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journal_entry_id_idx" ON "journal_entry_lines"("journal_entry_id");

-- CreateIndex
CREATE UNIQUE INDEX "financial_kpi_snapshots_period_key" ON "financial_kpi_snapshots"("period");

-- CreateIndex
CREATE UNIQUE INDEX "social_performance_indicators_period_key" ON "social_performance_indicators"("period");

-- CreateIndex
CREATE UNIQUE INDEX "mission_drift_scores_period_key" ON "mission_drift_scores"("period");

-- CreateIndex
CREATE INDEX "mission_drift_alerts_status_idx" ON "mission_drift_alerts"("status");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_branch_assignments" ADD CONSTRAINT "user_branch_assignments_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "agent_tier_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shap_explanations" ADD CONSTRAINT "shap_explanations_risk_assessment_id_fkey" FOREIGN KEY ("risk_assessment_id") REFERENCES "risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shap_interactions" ADD CONSTRAINT "shap_interactions_risk_assessment_id_fkey" FOREIGN KEY ("risk_assessment_id") REFERENCES "risk_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrowers" ADD CONSTRAINT "borrowers_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "borrower_documents" ADD CONSTRAINT "borrower_documents_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lending_groups" ADD CONSTRAINT "lending_groups_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lending_groups" ADD CONSTRAINT "lending_groups_leader_borrower_id_fkey" FOREIGN KEY ("leader_borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "loan_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loans" ADD CONSTRAINT "loans_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disbursements" ADD CONSTRAINT "disbursements_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repayment_schedules" ADD CONSTRAINT "repayment_schedules_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "repayment_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "par_status" ADD CONSTRAINT "par_status_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_signals" ADD CONSTRAINT "ews_signals_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_signals" ADD CONSTRAINT "ews_signals_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_signals" ADD CONSTRAINT "ews_signals_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_scores" ADD CONSTRAINT "ews_scores_borrower_id_fkey" FOREIGN KEY ("borrower_id") REFERENCES "borrowers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_scores" ADD CONSTRAINT "ews_scores_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_alerts" ADD CONSTRAINT "ews_alerts_ews_score_id_fkey" FOREIGN KEY ("ews_score_id") REFERENCES "ews_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ews_alerts" ADD CONSTRAINT "ews_alerts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "ews_alerts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_repayment_stats" ADD CONSTRAINT "group_repayment_stats_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "lending_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_fkey" FOREIGN KEY ("journal_entry_id") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "chart_of_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mission_drift_alerts" ADD CONSTRAINT "mission_drift_alerts_mdi_score_id_fkey" FOREIGN KEY ("mdi_score_id") REFERENCES "mission_drift_scores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
