import BranchField from "../BranchField"
import {
  CIVIL_STATUSES,
  SALUTATIONS,
} from "../constants"
import {
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
  ToggleGroup,
  AutoAssignedField,
} from "../FormFields"

export default function StepClient({
  form,
  errors,
  branchContext,
  onChange,
  onApplicantTypeChange,
}) {
  const isBusiness = form.applicantType === "business"
  const showSpouse = form.civilStatus === "Married"

  function update(field, value) {
    onChange({ ...form, [field]: value })
  }

  function updateSpouse(field, value) {
    onChange({ ...form, spouse: { ...form.spouse, [field]: value } })
  }

  function updateLoanRow(index, field, value) {
    const rows = [...form.existingLoans]
    rows[index] = { ...rows[index], [field]: value }
    onChange({ ...form, existingLoans: rows })
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Applicant type"
        description="Choose whether this is an individual or business borrower."
      />
      <ToggleGroup
        value={form.applicantType}
        options={[
          { value: "individual", label: "Individual" },
          { value: "business", label: "Business" },
        ]}
        onChange={onApplicantTypeChange}
      />

      <SectionTitle
        title="Loan administration"
        description="Branch, group number, and customer code are assigned automatically. Executives can select the processing branch."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BranchField
          form={form}
          errors={errors}
          branchContext={branchContext}
          onChange={onChange}
        />
        <Field id="centerName" label="Center name" error={errors.centerName}>
          <TextInput id="centerName" value={form.centerName} onChange={(v) => update("centerName", v)} />
        </Field>
        <AutoAssignedField id="groupNo" label="Group no." value={form.groupNo} />
        <AutoAssignedField id="customerCode" label="Customer code" value={form.customerCode} />
        <Field id="contactNo" label="Contact no." required error={errors.contactNo}>
          <TextInput id="contactNo" value={form.contactNo} onChange={(v) => update("contactNo", v)} />
        </Field>
        <Field id="loanAmount" label="Loan amount (LKR)" required error={errors.loanAmount}>
          <TextInput id="loanAmount" type="number" value={form.loanAmount} onChange={(v) => update("loanAmount", v)} />
        </Field>
        <Field id="terms" label="Terms (months)" required error={errors.terms}>
          <TextInput id="terms" type="number" value={form.terms} onChange={(v) => update("terms", v)} />
        </Field>
        <Field id="installment" label="Installment (LKR)" error={errors.installment}>
          <TextInput id="installment" type="number" value={form.installment} onChange={(v) => update("installment", v)} />
        </Field>
        <Field id="inspectionDate" label="Inspection date">
          <TextInput id="inspectionDate" type="date" value={form.inspectionDate} onChange={(v) => update("inspectionDate", v)} />
        </Field>
        <Field id="disburseDate" label="Disburse date">
          <TextInput id="disburseDate" type="date" value={form.disburseDate} onChange={(v) => update("disburseDate", v)} />
        </Field>
      </div>

      <SectionTitle title="Client information" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="salutation" label="Salutation">
          <SelectInput id="salutation" value={form.salutation} options={SALUTATIONS} onChange={(v) => update("salutation", v)} />
        </Field>
        <Field id="civilStatus" label="Civil status" required error={errors.civilStatus}>
          <SelectInput id="civilStatus" value={form.civilStatus} options={CIVIL_STATUSES} onChange={(v) => update("civilStatus", v)} />
        </Field>
        <Field id="nameWithInitials" label="Name with initials">
          <TextInput id="nameWithInitials" value={form.nameWithInitials} onChange={(v) => update("nameWithInitials", v)} />
        </Field>
        <Field id="fullName" label="Full name" required error={errors.fullName}>
          <TextInput id="fullName" value={form.fullName} onChange={(v) => update("fullName", v)} />
        </Field>
        <Field id="preferredName" label="Preferred name">
          <TextInput id="preferredName" value={form.preferredName} onChange={(v) => update("preferredName", v)} />
        </Field>
        <Field id="dateOfBirth" label="Date of birth">
          <TextInput id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={(v) => update("dateOfBirth", v)} />
        </Field>
        {!isBusiness ? (
          <Field id="nic" label="NIC no." required error={errors.nic}>
            <TextInput id="nic" value={form.nic} onChange={(v) => update("nic", v)} />
          </Field>
        ) : (
          <Field id="businessRegNo" label="Business reg. no." required error={errors.businessRegNo}>
            <TextInput id="businessRegNo" value={form.businessRegNo} onChange={(v) => update("businessRegNo", v)} />
          </Field>
        )}
        {isBusiness ? (
          <Field id="nicBusiness" label="Owner NIC">
            <TextInput id="nicBusiness" value={form.nic} onChange={(v) => update("nic", v)} />
          </Field>
        ) : null}
      </div>
      <Field id="address" label="Address" required error={errors.address}>
        <TextAreaInput id="address" value={form.address} onChange={(v) => update("address", v)} rows={3} />
      </Field>

      {showSpouse ? (
        <>
          <SectionTitle title="Spouse information (joint partner)" description="Required when civil status is Married." />
          <div className="grid gap-4 md:grid-cols-2">
            <Field id="spouseName" label="Spouse name" required error={errors.spouseName}>
              <TextInput id="spouseName" value={form.spouse.name} onChange={(v) => updateSpouse("name", v)} />
            </Field>
            <Field id="spouseOccupation" label="Occupation" required error={errors.spouseOccupation}>
              <TextInput id="spouseOccupation" value={form.spouse.occupation} onChange={(v) => updateSpouse("occupation", v)} />
            </Field>
            <Field id="spousePhone" label="Telephone" required error={errors.spousePhone}>
              <TextInput id="spousePhone" value={form.spouse.phone} onChange={(v) => updateSpouse("phone", v)} />
            </Field>
            <Field id="spouseNic" label="NIC no." required error={errors.spouseNic}>
              <TextInput id="spouseNic" value={form.spouse.nic} onChange={(v) => updateSpouse("nic", v)} />
            </Field>
          </div>
        </>
      ) : null}

      <SectionTitle title="Family & employment" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="children" label="Children">
          <TextInput id="children" value={form.children} onChange={(v) => update("children", v)} />
        </Field>
        <Field id="grandParent" label="Grand parent">
          <TextInput id="grandParent" value={form.grandParent} onChange={(v) => update("grandParent", v)} />
        </Field>
        <Field id="occupation" label="Occupation">
          <TextInput id="occupation" value={form.occupation} onChange={(v) => update("occupation", v)} />
        </Field>
        <Field id="employerName" label="Employer name">
          <TextInput id="employerName" value={form.employerName} onChange={(v) => update("employerName", v)} />
        </Field>
        <Field id="employerPhone" label="Employer phone">
          <TextInput id="employerPhone" value={form.employerPhone} onChange={(v) => update("employerPhone", v)} />
        </Field>
      </div>
      <Field id="employerAddress" label="Employer address">
        <TextAreaInput id="employerAddress" value={form.employerAddress} onChange={(v) => update("employerAddress", v)} />
      </Field>

      <SectionTitle title="Contact details" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="phoneHome" label="Home">
          <TextInput id="phoneHome" value={form.phoneHome} onChange={(v) => update("phoneHome", v)} />
        </Field>
        <Field id="phoneWork" label="Work">
          <TextInput id="phoneWork" value={form.phoneWork} onChange={(v) => update("phoneWork", v)} />
        </Field>
        <Field id="phoneMobile" label="Mobile" required error={errors.phoneMobile}>
          <TextInput id="phoneMobile" value={form.phoneMobile} onChange={(v) => update("phoneMobile", v)} />
        </Field>
        <Field id="whatsapp" label="WhatsApp">
          <TextInput id="whatsapp" value={form.whatsapp} onChange={(v) => update("whatsapp", v)} />
        </Field>
        <Field id="email" label="Email">
          <TextInput id="email" type="email" value={form.email} onChange={(v) => update("email", v)} />
        </Field>
        <Field id="viber" label="Viber">
          <TextInput id="viber" value={form.viber} onChange={(v) => update("viber", v)} />
        </Field>
        <Field id="facebook" label="Facebook">
          <TextInput id="facebook" value={form.facebook} onChange={(v) => update("facebook", v)} />
        </Field>
      </div>
    </div>
  )
}
