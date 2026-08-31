import {
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
  ToggleGroup,
} from "../../FormFields"
import AssetLiabilityTables from "../components/AssetLiabilityTables"
import { EMPLOYER_NATURES, EMPLOYMENT_NATURES, OCCUPANCY_TYPES, SALUTATIONS } from "../constants"

export default function StepVehicleIncome({ form, errors, onChange }) {
  const isMarried = form.maritalStatus === "married"
  const isSingle = form.maritalStatus === "single"
  const familyTitle = isMarried
    ? "Section D · Spouse details"
    : "Section D · Immediate family member"

  function updateIncome(field, value) {
    onChange({ ...form, income: { ...form.income, [field]: value } })
  }

  function updateFamily(field, value) {
    onChange({ ...form, familyMember: { ...form.familyMember, [field]: value } })
  }

  return (
    <div className="space-y-8">
      <SectionTitle title="Section C · Applicant sources of income" />
      <Field id="incomeOccupancy" label="Nature of occupancy" required error={errors.incomeOccupancy}>
        <ToggleGroup
          value={form.income.occupancy}
          options={OCCUPANCY_TYPES}
          onChange={(v) => updateIncome("occupancy", v)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="designation" label="Designation / nature of business">
          <TextInput
            id="designation"
            value={form.income.designation}
            onChange={(v) => updateIncome("designation", v)}
          />
        </Field>
        <Field id="employmentNature" label="Nature of employment">
          <SelectInput
            id="employmentNature"
            value={form.income.employmentNature}
            options={EMPLOYMENT_NATURES}
            onChange={(v) => updateIncome("employmentNature", v)}
          />
        </Field>
        <Field id="employerNature" label="Nature of employer">
          <SelectInput
            id="employerNature"
            value={form.income.employerNature}
            options={EMPLOYER_NATURES}
            onChange={(v) => updateIncome("employerNature", v)}
          />
        </Field>
        <Field id="dateJoined" label="Date joined / started">
          <TextInput
            id="dateJoined"
            type="date"
            value={form.income.dateJoined}
            onChange={(v) => updateIncome("dateJoined", v)}
          />
        </Field>
        <Field
          id="netMonthlyIncome"
          label="Net monthly income (LKR)"
          required
          error={errors.netMonthlyIncome}
        >
          <TextInput
            id="netMonthlyIncome"
            type="number"
            value={form.income.netMonthlyIncome}
            onChange={(v) => updateIncome("netMonthlyIncome", v)}
          />
        </Field>
        <Field id="businessPhoneLandline" label="Business land line">
          <TextInput
            id="businessPhoneLandline"
            value={form.income.businessPhoneLandline}
            onChange={(v) => updateIncome("businessPhoneLandline", v)}
          />
        </Field>
        <Field id="businessPhoneMobile" label="Business mobile">
          <TextInput
            id="businessPhoneMobile"
            value={form.income.businessPhoneMobile}
            onChange={(v) => updateIncome("businessPhoneMobile", v)}
          />
        </Field>
        <Field id="workEmail" label="Work email">
          <TextInput
            id="workEmail"
            type="email"
            value={form.income.workEmail}
            onChange={(v) => updateIncome("workEmail", v)}
          />
        </Field>
        <Field id="previousEmployer" label="Previous employer">
          <TextInput
            id="previousEmployer"
            value={form.income.previousEmployer}
            onChange={(v) => updateIncome("previousEmployer", v)}
          />
        </Field>
        <Field id="previousExperience" label="Previous work experience">
          <TextInput
            id="previousExperience"
            value={form.income.previousExperience}
            onChange={(v) => updateIncome("previousExperience", v)}
          />
        </Field>
      </div>
      <Field id="employerNameAddress" label="Name & address of employer / business">
        <TextAreaInput
          id="employerNameAddress"
          rows={2}
          value={form.income.employerNameAddress}
          onChange={(v) => updateIncome("employerNameAddress", v)}
        />
      </Field>

      {isMarried || isSingle ? (
        <>
          <SectionTitle
            title={familyTitle}
            description={
              isMarried
                ? "Required when marital status is Married."
                : "Required when marital status is Single."
            }
          />
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="familySalutation" label="Salutation">
              <SelectInput
                id="familySalutation"
                value={form.familyMember.salutation}
                options={SALUTATIONS}
                onChange={(v) => updateFamily("salutation", v)}
              />
            </Field>
            <Field id="familyName" label="Name in full" required error={errors.familyName}>
              <TextInput
                id="familyName"
                value={form.familyMember.name}
                onChange={(v) => updateFamily("name", v)}
              />
            </Field>
            <Field id="familyNic" label="NIC number" required={isMarried} error={errors.familyNic}>
              <TextInput
                id="familyNic"
                value={form.familyMember.nic}
                onChange={(v) => updateFamily("nic", v)}
              />
            </Field>
            <Field id="familyMobile" label="Mobile no." required error={errors.familyMobile}>
              <TextInput
                id="familyMobile"
                value={form.familyMember.mobile}
                onChange={(v) => updateFamily("mobile", v)}
              />
            </Field>
            <Field id="familyLandline" label="Land line">
              <TextInput
                id="familyLandline"
                value={form.familyMember.landline}
                onChange={(v) => updateFamily("landline", v)}
              />
            </Field>
            <Field id="familyEmployed" label="Employed?">
              <ToggleGroup
                value={form.familyMember.employed}
                options={[
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ]}
                onChange={(v) => updateFamily("employed", v)}
              />
            </Field>
          </div>
          <Field id="familyAddress" label="Residence address">
            <TextAreaInput
              id="familyAddress"
              rows={2}
              value={form.familyMember.address}
              onChange={(v) => updateFamily("address", v)}
            />
          </Field>
          {form.familyMember.employed === "yes" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field id="familyEmployerName" label="Employer name">
                <TextInput
                  id="familyEmployerName"
                  value={form.familyMember.employerName}
                  onChange={(v) => updateFamily("employerName", v)}
                />
              </Field>
              <Field id="familyDesignation" label="Designation">
                <TextInput
                  id="familyDesignation"
                  value={form.familyMember.designation}
                  onChange={(v) => updateFamily("designation", v)}
                />
              </Field>
              <Field id="familyEmployerContact" label="Employer contact">
                <TextInput
                  id="familyEmployerContact"
                  value={form.familyMember.employerContact}
                  onChange={(v) => updateFamily("employerContact", v)}
                />
              </Field>
            </div>
          ) : null}
          <Field id="familyEmployerAddress" label="Employer address">
            <TextAreaInput
              id="familyEmployerAddress"
              rows={2}
              value={form.familyMember.employerAddress}
              onChange={(v) => updateFamily("employerAddress", v)}
            />
          </Field>
        </>
      ) : null}

      <SectionTitle title="Section E · Assets and liabilities" />
      <AssetLiabilityTables form={form} onChange={onChange} />
    </div>
  )
}
