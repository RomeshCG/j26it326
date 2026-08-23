import { RISK_REPORT } from "@/components/risk-report/mock-data"

export const AB_EXPERIMENT_CASE = {
  caseId: "RES-2026-014",
  studyArm: "Within-subjects comparison",
  applicant: RISK_REPORT.applicant,
  loanDetails: {
    product: "Group Enterprise",
    amount: 120000,
    tenureMonths: 12,
    district: "Gampaha",
    monthlyIncome: 45000,
    purpose: "Small retail inventory expansion",
    groupName: "Gampaha Women's Enterprise Group",
    existingLoans: "None reported",
  },
  report: RISK_REPORT,
}
