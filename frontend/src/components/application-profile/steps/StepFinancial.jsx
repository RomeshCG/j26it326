import { Button } from "@/components/ui/button"
import { createEmptyLoanRow } from "../constants"
import { computeFinancialSummary } from "../calculations"
import {
  Field,
  SectionTitle,
  SummaryCard,
  TextAreaInput,
  TextInput,
  formatLkr,
} from "../FormFields"

export default function StepFinancial({ form, onChange }) {
  const summary = computeFinancialSummary(form)

  function updateIncome(field, value) {
    onChange({ ...form, income: { ...form.income, [field]: value } })
  }

  function updateBank(field, value) {
    onChange({ ...form, bank: { ...form.bank, [field]: value } })
  }

  function updateAssets(field, value) {
    onChange({ ...form, assets: { ...form.assets, [field]: value } })
  }

  function updateLoanRow(index, field, value) {
    const rows = [...form.existingLoans]
    rows[index] = { ...rows[index], [field]: value }
    onChange({ ...form, existingLoans: rows })
  }

  function addLoanRow() {
    onChange({ ...form, existingLoans: [...form.existingLoans, createEmptyLoanRow()] })
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Performance with existing loans"
        description="Enter any current facilities held by the applicant."
      />
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Facility no.</th>
              <th className="px-3 py-2">Date granted</th>
              <th className="px-3 py-2">Amount (LKR)</th>
              <th className="px-3 py-2">Monthly rental</th>
              <th className="px-3 py-2">Balance O/S</th>
              <th className="px-3 py-2">Arrears</th>
            </tr>
          </thead>
          <tbody>
            {form.existingLoans.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                {["facilityNo", "dateGranted", "amountGranted", "monthlyRental", "capitalBalance", "arrears"].map(
                  (field) => (
                    <td key={field} className="px-2 py-2">
                      <TextInput
                        id={`loan-${index}-${field}`}
                        value={row[field]}
                        type={field.includes("date") ? "date" : field === "facilityNo" ? "text" : "number"}
                        onChange={(value) => updateLoanRow(index, field, value)}
                      />
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addLoanRow} className="cursor-pointer">
        Add loan row
      </Button>

      <SectionTitle title="Bank details" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="bankName" label="Bank">
          <TextInput id="bankName" value={form.bank.bank} onChange={(v) => updateBank("bank", v)} />
        </Field>
        <Field id="bankBranch" label="Branch">
          <TextInput id="bankBranch" value={form.bank.branch} onChange={(v) => updateBank("branch", v)} />
        </Field>
        <Field id="accountNo" label="Account no.">
          <TextInput id="accountNo" value={form.bank.accountNo} onChange={(v) => updateBank("accountNo", v)} />
        </Field>
        <Field id="accountType" label="Account type">
          <TextInput id="accountType" value={form.bank.accountType} onChange={(v) => updateBank("accountType", v)} />
        </Field>
      </div>

      <SectionTitle title="Customer assets" />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="movableAssets" label="Movable">
          <TextAreaInput id="movableAssets" value={form.assets.movable} onChange={(v) => updateAssets("movable", v)} rows={4} />
        </Field>
        <Field id="immovableAssets" label="Immovable">
          <TextAreaInput id="immovableAssets" value={form.assets.immovable} onChange={(v) => updateAssets("immovable", v)} rows={4} />
        </Field>
      </div>

      <SectionTitle
        title="Income & repayment capacity"
        description="Totals and surplus are calculated automatically."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <Field id="netSalary" label="Net salary income (LKR)">
            <TextInput id="netSalary" type="number" value={form.income.netSalary} onChange={(v) => updateIncome("netSalary", v)} />
          </Field>
          <Field id="otherIncome" label="Net income from other sources (LKR)">
            <TextInput id="otherIncome" type="number" value={form.income.otherIncome} onChange={(v) => updateIncome("otherIncome", v)} />
          </Field>
          <Field id="livingExpenses" label="Living expenses (LKR)">
            <TextInput id="livingExpenses" type="number" value={form.income.livingExpenses} onChange={(v) => updateIncome("livingExpenses", v)} />
          </Field>
          <Field id="existingRentals" label="Existing rentals (LKR)">
            <TextInput id="existingRentals" type="number" value={form.income.existingRentals} onChange={(v) => updateIncome("existingRentals", v)} />
          </Field>
          <Field id="otherDebtService" label="Other debt service cost (LKR)">
            <TextInput id="otherDebtService" type="number" value={form.income.otherDebtService} onChange={(v) => updateIncome("otherDebtService", v)} />
          </Field>
          <Field id="proposedCommitment" label="Proposed facility commitment (LKR)">
            <TextInput id="proposedCommitment" type="number" value={form.income.proposedCommitment} onChange={(v) => updateIncome("proposedCommitment", v)} />
          </Field>
        </div>
        <div className="space-y-4">
          <Field id="otherIncomeDetails" label="Other sources of income (details)">
            <TextAreaInput id="otherIncomeDetails" value={form.income.otherIncomeDetails} onChange={(v) => updateIncome("otherIncomeDetails", v)} rows={8} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard label="Total net income (a)" value={formatLkr(summary.totalNetIncome)} />
            <SummaryCard label="Total debt service (b)" value={formatLkr(summary.totalDebtService)} />
            <SummaryCard
              label="Surplus (a − b)"
              value={formatLkr(summary.surplus)}
              tone={summary.surplus >= 0 ? "positive" : "negative"}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
