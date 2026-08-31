import { ArrowLeft, Pencil } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { computeFinancialSummary } from "./calculations"
import { getEffectiveBranch } from "./branch-context"
import { getApplication } from "./storage"
import { formatLkr, formatNumber } from "./FormFields"

function ViewSection({ title, children }) {
  return (
    <Card className="rounded-xl border bg-card">
      <CardHeader className="border-b border-border/50 pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">{children}</CardContent>
    </Card>
  )
}

function ViewField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm">{value || "—"}</p>
    </div>
  )
}

export default function ConsumerApplicationView() {
  const navigate = useNavigate()
  const { applicationId } = useParams()
  const application = getApplication(applicationId)

  if (!application) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Application not found.</p>
      </div>
    )
  }

  const form = application.form
  const summary = computeFinancialSummary(form)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 cursor-pointer"
            onClick={() => navigate("/loan-officer/borrowers")}
          >
            <ArrowLeft />
            Borrower management
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Application profile</h1>
          <p className="text-sm text-muted-foreground">
            {application.id} · {form.fullName || "Unnamed applicant"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{application.status}</Badge>
          {application.status === "draft" ? (
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => navigate(`/loan-officer/applications/${application.id}/edit`)}
            >
              <Pencil />
              Continue draft
            </Button>
          ) : null}
        </div>
      </div>

      <ViewSection title="Client & loan details">
        <ViewField label="Applicant type" value={form.applicantType} />
        <ViewField label="Full name" value={form.fullName} />
        <ViewField label="NIC / Business reg." value={form.nic || form.businessRegNo} />
        <ViewField label="Branch" value={getEffectiveBranch(form)} />
        {form.branchOverride?.enabled ? (
          <>
            <ViewField label="Assigned branch" value={form.assignedBranch} />
            <ViewField
              label="Branch override"
              value={
                form.branchOverride.status === "pending"
                  ? `Pending approval · ${form.branchOverride.requestedBranch}`
                  : form.branchOverride.status === "approved"
                    ? `Approved · ${form.branchOverride.requestedBranch}`
                    : form.branchOverride.requestedBranch || "Requested"
              }
            />
            <ViewField label="Override reason" value={form.branchOverride.reason} />
          </>
        ) : null}
        <ViewField label="Group no." value={form.groupNo} />
        <ViewField label="Customer code" value={form.customerCode} />
        <ViewField label="Loan amount" value={formatLkr(form.loanAmount)} />
        <ViewField label="Terms" value={form.terms ? `${form.terms} months` : "—"} />
        <ViewField label="Civil status" value={form.civilStatus} />
        <ViewField label="Mobile" value={form.phoneMobile} />
        <ViewField label="Address" value={form.address} />
        {form.civilStatus === "Married" ? (
          <>
            <ViewField label="Spouse name" value={form.spouse?.name} />
            <ViewField label="Spouse NIC" value={form.spouse?.nic} />
          </>
        ) : null}
      </ViewSection>

      <ViewSection title="Financial profile">
        <ViewField label="Total net income (a)" value={formatLkr(summary.totalNetIncome)} />
        <ViewField label="Total debt service (b)" value={formatLkr(summary.totalDebtService)} />
        <ViewField label="Surplus" value={formatLkr(summary.surplus)} />
        <ViewField label="Bank" value={form.bank?.bank} />
        <ViewField label="Movable assets" value={form.assets?.movable} />
        <ViewField label="Immovable assets" value={form.assets?.immovable} />
      </ViewSection>

      <ViewSection title="Credit appraisal">
        <ViewField label="Purpose" value={form.purpose} />
        <ViewField label="Facility amount" value={formatLkr(form.facilityAmount)} />
        <ViewField label="Credit officer" value={form.creditOfficer} />
        <ViewField label="Background" value={form.backgroundNotes} />
      </ViewSection>

      <ViewSection title="Income summary">
        <ViewField label="Earn total" value={formatLkr(summary.earnTotal)} />
        <ViewField label="Expense total" value={formatLkr(summary.expenseTotal)} />
        <ViewField label="Loan expense total" value={formatLkr(summary.loanExpenseTotal)} />
        <ViewField label="DSCR" value={summary.dscr == null ? "N/A" : formatNumber(summary.dscr)} />
      </ViewSection>
    </div>
  )
}
