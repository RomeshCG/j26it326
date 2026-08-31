import { LOAN_PURPOSES, INTEREST_PERIODS } from "../constants"
import {
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "../FormFields"

export default function StepLoanRequest({ form, errors, onChange }) {
  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  function togglePurpose(purpose) {
    const current = form.loanPurpose ?? []
    const next = current.includes(purpose)
      ? current.filter((item) => item !== purpose)
      : [...current, purpose]
    update("loanPurpose", next)
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Consumer loan application"
        description="Loan request details from the signed application form."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="applicationDate" label="Application date" required error={errors.applicationDate}>
          <TextInput id="applicationDate" type="date" value={form.applicationDate} onChange={(v) => update("applicationDate", v)} />
        </Field>
        <Field id="amountInWords" label="Loan amount in words">
          <TextInput id="amountInWords" value={form.amountInWords} onChange={(v) => update("amountInWords", v)} />
        </Field>
      </div>

      <Field label="Purpose of loan">
        <div className="flex flex-wrap gap-2">
          {LOAN_PURPOSES.map((purpose) => {
            const active = (form.loanPurpose ?? []).includes(purpose)
            return (
              <button
                key={purpose}
                type="button"
                onClick={() => togglePurpose(purpose)}
                className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {purpose}
              </button>
            )
          })}
        </div>
      </Field>

      <SectionTitle
        title="Promissory note"
        description="Interest terms only — signatures skipped for prototype."
      />
      <div className="grid gap-4 md:grid-cols-3">
        <Field id="interestRate" label="Interest rate (%)">
          <TextInput id="interestRate" type="number" value={form.interestRate} onChange={(v) => update("interestRate", v)} />
        </Field>
        <Field id="interestPeriod" label="Interest period">
          <SelectInput
            id="interestPeriod"
            value={form.interestPeriod}
            options={INTEREST_PERIODS}
            onChange={(v) => update("interestPeriod", v)}
          />
        </Field>
      </div>

      <Field id="promissoryNotes" label="Additional loan request notes">
        <TextAreaInput
          id="promissoryNotes"
          value={form.promissoryNotes ?? ""}
          onChange={(v) => update("promissoryNotes", v)}
          rows={4}
          placeholder="Any additional terms recorded on the physical promissory note…"
        />
      </Field>
    </div>
  )
}
