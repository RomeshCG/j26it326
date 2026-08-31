import { Field, SectionTitle } from "../../FormFields"
import GuarantorFields from "../components/GuarantorFields"

export default function StepGuarantor2Declaration({ form, errors, onChange }) {
  return (
    <div className="space-y-8">
      <SectionTitle title="Guarantor 2" />
      <GuarantorFields
        prefix="guarantor2"
        guarantor={form.guarantor2}
        errors={errors}
        onChange={(guarantor2) => onChange({ ...form, guarantor2 })}
      />

      <SectionTitle
        title="Declaration"
        description="Signatures are captured digitally in production. For this prototype, accept the declaration to proceed."
      />
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/60 bg-muted/20 p-4 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.declarationAccepted}
          onChange={(event) =>
            onChange({ ...form, declarationAccepted: event.target.checked })
          }
        />
        <span>
          I/We declare that the above information is true and warrant that I/We have made
          full disclosure of all matters relevant to this application. I/We authorize you
          to make any inquiries you deem necessary for credit assessment or confirmation of
          the above particulars.
        </span>
      </label>
      {errors.declarationAccepted ? (
        <Field id="declarationAccepted" label="">
          <p className="text-xs text-destructive">{errors.declarationAccepted}</p>
        </Field>
      ) : null}
    </div>
  )
}
