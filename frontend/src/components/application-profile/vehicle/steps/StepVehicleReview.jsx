import { SummaryCard, formatLkr, formatNumber } from "../../FormFields"
import { computeVehicleSummary } from "../calculations"
import { LEASE_PURPOSES, VEHICLE_TYPES } from "../constants"

function labelFor(options, value) {
  return options.find((item) => item.value === value)?.label || value || "—"
}

export default function StepVehicleReview({ form }) {
  const summary = computeVehicleSummary(form)

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Finance amount" value={formatLkr(form.financeAmount)} />
        <SummaryCard label="Total support income" value={formatLkr(summary.totalSupportIncome)} />
        <SummaryCard
          label="Monthly liabilities"
          value={formatLkr(summary.totalMonthlyLiabilities)}
        />
        <SummaryCard
          label="Surplus"
          value={formatLkr(summary.surplus)}
          tone={summary.surplus >= 0 ? "positive" : "negative"}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard label="Total assets" value={formatLkr(summary.totalAssets)} />
        <SummaryCard
          label="DSCR"
          value={summary.dscr == null ? "N/A" : formatNumber(summary.dscr)}
        />
      </div>

      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">Application summary</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>Applicant: {form.fullName || "—"}</li>
          <li>NIC: {form.nic || "—"}</li>
          <li>
            Vehicle: {labelFor(VEHICLE_TYPES, form.vehicle?.vehicleType)}{" "}
            {form.vehicle?.make} {form.vehicle?.model}
          </li>
          <li>Purpose: {labelFor(LEASE_PURPOSES, form.vehicle?.leasePurpose)}</li>
          <li>Guarantor 1: {form.guarantor1?.name || "—"}</li>
          <li>Guarantor 2: {form.guarantor2?.name || "—"}</li>
        </ul>
      </div>
    </div>
  )
}
