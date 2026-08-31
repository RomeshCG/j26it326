import BranchField from "../../BranchField"
import {
  AutoAssignedField,
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
  ToggleGroup,
} from "../../FormFields"
import {
  ADDRESS_PROOF_TYPES,
  EDUCATION_LEVELS,
  GENDERS,
  LOAN_SUB_TYPES,
  MARITAL_STATUSES,
  RESIDENCE_TYPES,
  SALUTATIONS,
} from "../constants"

export default function StepVehicleGeneral({
  form,
  errors,
  branchContext,
  onChange,
}) {
  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Loan administration"
        description="Branch, group number, customer code, and product code are assigned automatically."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BranchField
          form={form}
          errors={errors}
          branchContext={branchContext}
          onChange={onChange}
        />
        <Field
          id="applicationDate"
          label="Application date"
          required
          error={errors.applicationDate}
        >
          <TextInput
            id="applicationDate"
            type="date"
            value={form.applicationDate}
            onChange={(v) => update("applicationDate", v)}
          />
        </Field>
        <AutoAssignedField id="productCode" label="Product code" value={form.productCode} />
        <AutoAssignedField id="groupNo" label="Group no." value={form.groupNo} />
        <AutoAssignedField id="customerCode" label="Customer code" value={form.customerCode} />
        <Field
          id="financeAmount"
          label="Finance amount (LKR)"
          required
          error={errors.financeAmount}
        >
          <TextInput
            id="financeAmount"
            type="number"
            value={form.financeAmount}
            onChange={(v) => update("financeAmount", v)}
          />
        </Field>
        <Field
          id="facilityPeriodMonths"
          label="Facility period (months)"
          required
          error={errors.facilityPeriodMonths}
        >
          <TextInput
            id="facilityPeriodMonths"
            type="number"
            value={form.facilityPeriodMonths}
            onChange={(v) => update("facilityPeriodMonths", v)}
          />
        </Field>
        <Field id="cashPrice" label="Cash price (LKR)">
          <TextInput
            id="cashPrice"
            type="number"
            value={form.cashPrice}
            onChange={(v) => update("cashPrice", v)}
          />
        </Field>
      </div>

      <Field id="loanSubType" label="Loan type">
        <ToggleGroup
          value={form.loanSubType}
          options={LOAN_SUB_TYPES}
          onChange={(v) => update("loanSubType", v)}
        />
      </Field>

      <SectionTitle title="Section A · General information" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="salutation" label="Salutation">
          <SelectInput
            id="salutation"
            value={form.salutation}
            options={SALUTATIONS}
            onChange={(v) => update("salutation", v)}
          />
        </Field>
        <Field id="fullName" label="Name in full" required error={errors.fullName}>
          <TextInput id="fullName" value={form.fullName} onChange={(v) => update("fullName", v)} />
        </Field>
        <Field id="nic" label="NIC number" required error={errors.nic}>
          <TextInput id="nic" value={form.nic} onChange={(v) => update("nic", v)} />
        </Field>
        <Field id="dateOfBirth" label="Date of birth">
          <TextInput
            id="dateOfBirth"
            type="date"
            value={form.dateOfBirth}
            onChange={(v) => update("dateOfBirth", v)}
          />
        </Field>
        <Field id="gender" label="Gender">
          <ToggleGroup value={form.gender} options={GENDERS} onChange={(v) => update("gender", v)} />
        </Field>
        <Field id="maritalStatus" label="Marital status" required error={errors.maritalStatus}>
          <ToggleGroup
            value={form.maritalStatus}
            options={MARITAL_STATUSES}
            onChange={(v) => update("maritalStatus", v)}
          />
        </Field>
        <Field id="education" label="Education">
          <SelectInput
            id="education"
            value={form.education}
            options={EDUCATION_LEVELS}
            onChange={(v) => update("education", v)}
          />
        </Field>
        <Field id="dependents" label="No. of dependents">
          <TextInput
            id="dependents"
            type="number"
            value={form.dependents}
            onChange={(v) => update("dependents", v)}
          />
        </Field>
        <Field id="district" label="District">
          <TextInput id="district" value={form.district} onChange={(v) => update("district", v)} />
        </Field>
        <Field id="agaDivision" label="AGA division">
          <TextInput id="agaDivision" value={form.agaDivision} onChange={(v) => update("agaDivision", v)} />
        </Field>
      </div>

      <Field id="permanentAddress" label="Permanent address" required error={errors.permanentAddress}>
        <TextAreaInput
          id="permanentAddress"
          rows={2}
          value={form.permanentAddress}
          onChange={(v) => update("permanentAddress", v)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id="permanentPostalCode" label="Permanent postal code">
          <TextInput
            id="permanentPostalCode"
            value={form.permanentPostalCode}
            onChange={(v) => update("permanentPostalCode", v)}
          />
        </Field>
        <Field id="correspondencePostalCode" label="Correspondence postal code">
          <TextInput
            id="correspondencePostalCode"
            value={form.correspondencePostalCode}
            onChange={(v) => update("correspondencePostalCode", v)}
          />
        </Field>
      </div>
      <Field id="correspondenceAddress" label="Correspondence address (if different)">
        <TextAreaInput
          id="correspondenceAddress"
          rows={2}
          value={form.correspondenceAddress}
          onChange={(v) => update("correspondenceAddress", v)}
        />
      </Field>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="addressProof" label="Address proof">
          <SelectInput
            id="addressProof"
            value={form.addressProof}
            options={ADDRESS_PROOF_TYPES}
            onChange={(v) => update("addressProof", v)}
          />
        </Field>
        <Field id="addressDurationYears" label="Duration at address (years)">
          <TextInput
            id="addressDurationYears"
            type="number"
            value={form.addressDurationYears}
            onChange={(v) => update("addressDurationYears", v)}
          />
        </Field>
        <Field id="addressDurationMonths" label="Duration at address (months)">
          <TextInput
            id="addressDurationMonths"
            type="number"
            value={form.addressDurationMonths}
            onChange={(v) => update("addressDurationMonths", v)}
          />
        </Field>
        <Field id="residenceType" label="Type of residence">
          <ToggleGroup
            value={form.residenceType}
            options={RESIDENCE_TYPES}
            onChange={(v) => update("residenceType", v)}
          />
        </Field>
        <Field id="gramaSevakaName" label="Grama sevaka name">
          <TextInput
            id="gramaSevakaName"
            value={form.gramaSevakaName}
            onChange={(v) => update("gramaSevakaName", v)}
          />
        </Field>
        <Field id="gramaSevakaNumber" label="Grama sevaka number">
          <TextInput
            id="gramaSevakaNumber"
            value={form.gramaSevakaNumber}
            onChange={(v) => update("gramaSevakaNumber", v)}
          />
        </Field>
        <Field id="child1Age" label="1st child age">
          <TextInput id="child1Age" type="number" value={form.child1Age} onChange={(v) => update("child1Age", v)} />
        </Field>
        <Field id="child2Age" label="2nd child age">
          <TextInput id="child2Age" type="number" value={form.child2Age} onChange={(v) => update("child2Age", v)} />
        </Field>
        <Field id="child3Age" label="3rd child age">
          <TextInput id="child3Age" type="number" value={form.child3Age} onChange={(v) => update("child3Age", v)} />
        </Field>
      </div>

      <SectionTitle title="Section B · Contact details" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="phoneLandline" label="Land line">
          <TextInput id="phoneLandline" value={form.phoneLandline} onChange={(v) => update("phoneLandline", v)} />
        </Field>
        <Field id="phoneMobile1" label="Mobile 1" required error={errors.phoneMobile1}>
          <TextInput id="phoneMobile1" value={form.phoneMobile1} onChange={(v) => update("phoneMobile1", v)} />
        </Field>
        <Field id="phoneMobile2" label="Mobile 2">
          <TextInput id="phoneMobile2" value={form.phoneMobile2} onChange={(v) => update("phoneMobile2", v)} />
        </Field>
        <Field id="email" label="Email">
          <TextInput id="email" type="email" value={form.email} onChange={(v) => update("email", v)} />
        </Field>
      </div>
    </div>
  )
}
