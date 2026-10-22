import { classificationMeta } from "@/components/risk-report/mock-data"

export function buildDisbursementApplication(report, linkedApplication) {
  const form = linkedApplication?.form ?? {}

  return {
    fullName: report.applicant?.name || form.fullName || "Unnamed applicant",
    nic: report.applicant?.nic || form.nic || form.businessRegNo || "—",
    product: report.product || form.facilityType || linkedApplication?.loanType || "Consumer loan",
    amount: Number(form.loanAmount || form.financeAmount || report.loanAmount || 0),
    tenure: form.terms || form.facilityPeriodMonths || "12",
    district: form.branch || form.assignedBranch || form.district || "—",
    riskScore: report.riskScore,
    riskLabel: classificationMeta(report.classification).label,
    applicationId: report.applicationId,
    // Extra fields for M3 approve sync (browser-local form → live DB)
    phone: form.phoneMobile || form.contactNo || "",
    contactNo: form.contactNo || form.phoneMobile || "",
    occupation: form.occupation || "",
    purpose: form.purpose || form.backgroundNotes || "",
    monthlyIncome: form.income?.otherIncome || form.income?.netSalary || "",
    localApplicationId: linkedApplication?.id || null,
  }
}
