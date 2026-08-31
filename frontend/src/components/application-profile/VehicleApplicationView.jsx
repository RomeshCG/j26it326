import { ArrowLeft, Pencil } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

import { getEffectiveBranch } from "./branch-context"
import { formatLkr, formatNumber } from "./FormFields"
import { getApplication } from "./storage"
import { computeVehicleSummary } from "./vehicle/calculations"
import { LEASE_PURPOSES, VEHICLE_TYPES } from "./vehicle/constants"

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

function labelFor(options, value) {
  return options.find((item) => item.value === value)?.label || value || "—"
}

export default function VehicleApplicationView() {
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
  const summary = computeVehicleSummary(form)

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
          <h1 className="text-2xl font-semibold tracking-tight">Vehicle application profile</h1>
          <p className="text-sm text-muted-foreground">
            {application.id} · {form.fullName || "Unnamed applicant"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">{application.status}</Badge>
          <Badge variant="secondary">Hire purchase</Badge>
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

      <ViewSection title="Loan & applicant">
        <ViewField label="Full name" value={form.fullName} />
        <ViewField label="NIC" value={form.nic} />
        <ViewField label="Branch" value={getEffectiveBranch(form)} />
        <ViewField label="Product code" value={form.productCode} />
        <ViewField label="Group no." value={form.groupNo} />
        <ViewField label="Customer code" value={form.customerCode} />
        <ViewField label="Finance amount" value={formatLkr(form.financeAmount)} />
        <ViewField
          label="Facility period"
          value={form.facilityPeriodMonths ? `${form.facilityPeriodMonths} months` : "—"}
        />
        <ViewField label="Marital status" value={form.maritalStatus} />
        <ViewField label="Mobile" value={form.phoneMobile1} />
        <ViewField label="Permanent address" value={form.permanentAddress} />
      </ViewSection>

      <ViewSection title="Vehicle asset">
        <ViewField
          label="Vehicle type"
          value={labelFor(VEHICLE_TYPES, form.vehicle?.vehicleType)}
        />
        <ViewField label="Make / model" value={`${form.vehicle?.make || ""} ${form.vehicle?.model || ""}`.trim()} />
        <ViewField label="Year" value={form.vehicle?.yearOfManufacture} />
        <ViewField label="Vehicle number" value={form.vehicle?.vehicleNumber} />
        <ViewField
          label="Purpose"
          value={labelFor(LEASE_PURPOSES, form.vehicle?.leasePurpose)}
        />
        <ViewField
          label="Expected income"
          value={formatLkr(form.vehicle?.expectedIncome)}
        />
        <ViewField label="Supplier" value={form.vehicle?.supplierName} />
        <ViewField label="Location" value={form.vehicle?.location} />
      </ViewSection>

      <ViewSection title="Guarantors">
        <ViewField label="Guarantor 1" value={form.guarantor1?.name} />
        <ViewField label="Guarantor 1 NIC" value={form.guarantor1?.nic} />
        <ViewField
          label="Guarantor 1 income"
          value={formatLkr(form.guarantor1?.netMonthlyIncome)}
        />
        <ViewField label="Guarantor 2" value={form.guarantor2?.name} />
        <ViewField label="Guarantor 2 NIC" value={form.guarantor2?.nic} />
        <ViewField
          label="Guarantor 2 income"
          value={formatLkr(form.guarantor2?.netMonthlyIncome)}
        />
      </ViewSection>

      <ViewSection title="Financial summary">
        <ViewField label="Applicant income" value={formatLkr(summary.applicantIncome)} />
        <ViewField label="Total support income" value={formatLkr(summary.totalSupportIncome)} />
        <ViewField label="Total assets" value={formatLkr(summary.totalAssets)} />
        <ViewField
          label="Monthly liabilities"
          value={formatLkr(summary.totalMonthlyLiabilities)}
        />
        <ViewField label="Surplus" value={formatLkr(summary.surplus)} />
        <ViewField
          label="DSCR"
          value={summary.dscr == null ? "N/A" : formatNumber(summary.dscr)}
        />
      </ViewSection>
    </div>
  )
}
