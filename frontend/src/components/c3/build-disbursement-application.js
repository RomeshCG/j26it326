import { classificationMeta } from "@/components/risk-report/mock-data"

export function buildDisbursementApplication(report, linkedApplication) {
  const form = linkedApplication?.form ?? {}

  return {
    fullName: report.applicant?.name || form.fullName || "Unnamed applicant",
    nic: report.applicant?.nic || form.nic || form.businessRegNo || "—",
    product: report.product || linkedApplication?.loanType || form.purpose || "Consumer loan",
    amount: Number(form.loanAmount || form.financeAmount || report.loanAmount || 0),
    tenure: form.terms || form.facilityPeriodMonths || "12",
    district: form.branch || form.assignedBranch || "—",
    riskScore: report.riskScore,
    riskLabel: classificationMeta(report.classification).label,
    applicationId: report.applicationId,
  }
}
