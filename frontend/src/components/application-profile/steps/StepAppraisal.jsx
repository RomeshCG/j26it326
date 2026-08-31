import {
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
} from "../FormFields"

export default function StepAppraisal({ form, onChange }) {
  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <div className="space-y-8">
      <SectionTitle title="Credit appraisal report" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="facilityType" label="Type of facility">
          <TextInput id="facilityType" value={form.facilityType} onChange={(v) => update("facilityType", v)} />
        </Field>
        <Field id="facilityAmount" label="Facility amount (LKR)">
          <TextInput id="facilityAmount" type="number" value={form.facilityAmount} onChange={(v) => update("facilityAmount", v)} />
        </Field>
        <Field id="applicantStatus" label="Applicant status">
          <SelectInput
            id="applicantStatus"
            value={form.applicantStatus}
            options={["Existing", "New"]}
            onChange={(v) => update("applicantStatus", v)}
          />
        </Field>
        <Field id="article" label="Article / business asset">
          <TextInput id="article" value={form.article} onChange={(v) => update("article", v)} />
        </Field>
        <Field id="value" label="Value (LKR)">
          <TextInput id="value" type="number" value={form.value} onChange={(v) => update("value", v)} />
        </Field>
        <Field id="appraisalDate" label="Date">
          <TextInput id="appraisalDate" type="date" value={form.appraisalDate} onChange={(v) => update("appraisalDate", v)} />
        </Field>
        <Field id="rental" label="Rental / installment (LKR)">
          <TextInput id="rental" type="number" value={form.rental} onChange={(v) => update("rental", v)} />
        </Field>
        <Field id="creditOfficer" label="Credit officer">
          <TextInput id="creditOfficer" value={form.creditOfficer} onChange={(v) => update("creditOfficer", v)} />
        </Field>
      </div>

      <SectionTitle title="Applicant details" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="age" label="Age">
          <TextInput id="age" type="number" value={form.age} onChange={(v) => update("age", v)} />
        </Field>
        <Field id="professionEmployer" label="Profession & employer">
          <TextInput id="professionEmployer" value={form.professionEmployer} onChange={(v) => update("professionEmployer", v)} />
        </Field>
        <Field id="natureOfBusiness" label="Nature of business">
          <TextInput id="natureOfBusiness" value={form.natureOfBusiness} onChange={(v) => update("natureOfBusiness", v)} />
        </Field>
        <Field id="businessSince" label="Business / employment since">
          <TextInput id="businessSince" value={form.businessSince} onChange={(v) => update("businessSince", v)} />
        </Field>
        <Field id="purpose" label="Purpose of facility">
          <TextInput id="purpose" value={form.purpose} onChange={(v) => update("purpose", v)} />
        </Field>
      </div>

      <Field id="backgroundNotes" label="Applicant / business background">
        <TextAreaInput
          id="backgroundNotes"
          value={form.backgroundNotes}
          onChange={(v) => update("backgroundNotes", v)}
          rows={5}
          placeholder="Credit investigation, strengths, risks, repayment capacity notes…"
        />
      </Field>

      <Field id="locationNotes" label="Location notes">
        <TextAreaInput
          id="locationNotes"
          value={form.locationNotes}
          onChange={(v) => update("locationNotes", v)}
          rows={3}
          placeholder="Road map / residence location notes…"
        />
      </Field>
    </div>
  )
}
