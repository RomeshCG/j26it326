import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatLkr(amount) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function FieldRow({ label, value }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/50 py-2.5 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function SelectField({ id, label, value, options, onChange, placeholder = "Select…" }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select
        value={value || null}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export default function TraditionalScoringPanel({ caseData, form, onChange }) {
  const { applicant, loanDetails } = caseData

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Manual scoring sheet
        </p>
        <h3 className="mt-1 text-base font-semibold">{applicant.name}</h3>
        <p className="text-sm text-muted-foreground">NIC {applicant.nic}</p>

        <div className="mt-4 space-y-0">
          <FieldRow label="Product" value={loanDetails.product} />
          <FieldRow label="Loan amount" value={formatLkr(loanDetails.amount)} />
          <FieldRow label="Tenure" value={`${loanDetails.tenureMonths} months`} />
          <FieldRow label="District" value={loanDetails.district} />
          <FieldRow
            label="Monthly income"
            value={formatLkr(loanDetails.monthlyIncome)}
          />
          <FieldRow label="Purpose" value={loanDetails.purpose} />
          <FieldRow label="Group" value={loanDetails.groupName} />
          <FieldRow label="Existing loans" value={loanDetails.existingLoans} />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <p className="mb-4 text-sm font-semibold">Officer assessment</p>
        <div className="space-y-4">
          <SelectField
            id="income-assessment"
            label="Income assessment"
            value={form.incomeAssessment}
            options={["Good", "Average", "Poor"]}
            onChange={(value) => onChange("incomeAssessment", value)}
          />
          <SelectField
            id="collateral-check"
            label="Collateral check"
            value={form.collateralCheck}
            options={["Passed", "Failed"]}
            onChange={(value) => onChange("collateralCheck", value)}
          />
          <SelectField
            id="character-assessment"
            label="Character assessment"
            value={form.characterAssessment}
            options={["Good", "Average", "Poor"]}
            onChange={(value) => onChange("characterAssessment", value)}
          />
          <SelectField
            id="recommended-decision"
            label="Recommended decision"
            value={form.recommendedDecision}
            options={["Approve", "Reject"]}
            onChange={(value) => onChange("recommendedDecision", value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-dashed bg-muted/30 p-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Traditional workflow — no AI scores, SHAP charts, or generated narratives.
          Complete all manual fields before recording your Group B decision.
        </p>
      </div>
    </div>
  )
}
