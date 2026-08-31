import { Button } from "@/components/ui/button"
import { createEmptyLineRow } from "../constants"
import { computeFinancialSummary } from "../calculations"
import {
  Field,
  SectionTitle,
  SummaryCard,
  TextInput,
  formatLkr,
  formatNumber,
} from "../FormFields"

function LineItemsTable({ title, rows, onChange, onAddRow }) {
  function updateRow(index, field, value) {
    const next = [...rows]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const total = rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">{title}</h4>
        <Button type="button" size="sm" variant="outline" onClick={onAddRow} className="cursor-pointer">
          Add row
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2 w-40">Amount (LKR)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index} className="border-b last:border-b-0">
                <td className="px-2 py-2">
                  <TextInput
                    id={`${title}-${index}-label`}
                    value={row.label}
                    onChange={(value) => updateRow(index, "label", value)}
                  />
                </td>
                <td className="px-2 py-2">
                  <TextInput
                    id={`${title}-${index}-amount`}
                    type="number"
                    value={row.amount}
                    onChange={(value) => updateRow(index, "amount", value)}
                  />
                </td>
              </tr>
            ))}
            <tr className="bg-muted/20 font-medium">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 tabular-nums">{formatLkr(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function StepIncomeReview({ form, onChange }) {
  const summary = computeFinancialSummary(form)

  function updateRows(field, rows) {
    onChange({ ...form, [field]: rows })
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Income details"
        description="Monthly earn and expense breakdown with auto-calculated totals."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LineItemsTable
          title="Earn"
          rows={form.incomeRows}
          onChange={(rows) => updateRows("incomeRows", rows)}
          onAddRow={() => updateRows("incomeRows", [...form.incomeRows, createEmptyLineRow()])}
        />
        <LineItemsTable
          title="Expenses"
          rows={form.expenseRows}
          onChange={(rows) => updateRows("expenseRows", rows)}
          onAddRow={() => updateRows("expenseRows", [...form.expenseRows, createEmptyLineRow()])}
        />
      </div>

      <LineItemsTable
        title="Loan expenses"
        rows={form.loanExpenseRows}
        onChange={(rows) => updateRows("loanExpenseRows", rows)}
        onAddRow={() => updateRows("loanExpenseRows", [...form.loanExpenseRows, createEmptyLineRow()])}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Earn total" value={formatLkr(summary.earnTotal)} />
        <SummaryCard label="Expense total" value={formatLkr(summary.expenseTotal)} />
        <SummaryCard label="Loan expense total" value={formatLkr(summary.loanExpenseTotal)} />
        <SummaryCard
          label="DSCR"
          value={summary.dscr == null ? "N/A" : formatNumber(summary.dscr)}
          tone={summary.dscr != null && summary.dscr >= 1 ? "positive" : "negative"}
        />
      </div>

      <SectionTitle title="Review summary" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard label="Applicant" value={form.fullName || "—"} />
        <SummaryCard label="Loan amount" value={formatLkr(form.loanAmount)} />
        <SummaryCard label="Surplus (a − b)" value={formatLkr(summary.surplus)} tone={summary.surplus >= 0 ? "positive" : "negative"} />
      </div>
    </div>
  )
}
