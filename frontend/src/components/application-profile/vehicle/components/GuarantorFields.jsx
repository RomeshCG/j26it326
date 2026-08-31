import {
  Field,
  SectionTitle,
  SelectInput,
  TextAreaInput,
  TextInput,
  ToggleGroup,
} from "../../FormFields"
import { OCCUPANCY_TYPES, SALUTATIONS } from "../constants"

export default function GuarantorFields({
  prefix,
  guarantor,
  errors,
  onChange,
}) {
  function update(field, value) {
    onChange({ ...guarantor, [field]: value })
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field id={`${prefix}-salutation`} label="Salutation">
          <SelectInput
            id={`${prefix}-salutation`}
            value={guarantor.salutation}
            options={SALUTATIONS}
            onChange={(v) => update("salutation", v)}
          />
        </Field>
        <Field
          id={`${prefix}-name`}
          label="Name in full"
          required
          error={errors[`${prefix}Name`]}
        >
          <TextInput
            id={`${prefix}-name`}
            value={guarantor.name}
            onChange={(v) => update("name", v)}
          />
        </Field>
        <Field
          id={`${prefix}-nic`}
          label="NIC number"
          required
          error={errors[`${prefix}Nic`]}
        >
          <TextInput id={`${prefix}-nic`} value={guarantor.nic} onChange={(v) => update("nic", v)} />
        </Field>
        <Field id={`${prefix}-dob`} label="Date of birth">
          <TextInput
            id={`${prefix}-dob`}
            type="date"
            value={guarantor.dateOfBirth}
            onChange={(v) => update("dateOfBirth", v)}
          />
        </Field>
      </div>

      <Field id={`${prefix}-address`} label="Permanent address">
        <TextAreaInput
          id={`${prefix}-address`}
          rows={2}
          value={guarantor.address}
          onChange={(v) => update("address", v)}
        />
      </Field>

      <SectionTitle title="Contact details" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id={`${prefix}-home-land`} label="Home land line">
          <TextInput
            id={`${prefix}-home-land`}
            value={guarantor.homeLandline}
            onChange={(v) => update("homeLandline", v)}
          />
        </Field>
        <Field id={`${prefix}-home-mobile`} label="Home mobile">
          <TextInput
            id={`${prefix}-home-mobile`}
            value={guarantor.homeMobile}
            onChange={(v) => update("homeMobile", v)}
          />
        </Field>
        <Field id={`${prefix}-office-land`} label="Office land line">
          <TextInput
            id={`${prefix}-office-land`}
            value={guarantor.officeLandline}
            onChange={(v) => update("officeLandline", v)}
          />
        </Field>
        <Field id={`${prefix}-office-mobile`} label="Office mobile">
          <TextInput
            id={`${prefix}-office-mobile`}
            value={guarantor.officeMobile}
            onChange={(v) => update("officeMobile", v)}
          />
        </Field>
        <Field id={`${prefix}-email`} label="Email">
          <TextInput
            id={`${prefix}-email`}
            type="email"
            value={guarantor.email}
            onChange={(v) => update("email", v)}
          />
        </Field>
      </div>

      <SectionTitle title="Sources of income" />
      <Field id={`${prefix}-occupancy`} label="Nature of occupancy">
        <ToggleGroup
          value={guarantor.occupancy}
          options={OCCUPANCY_TYPES}
          onChange={(v) => update("occupancy", v)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field id={`${prefix}-designation`} label="Designation / nature of business">
          <TextInput
            id={`${prefix}-designation`}
            value={guarantor.designation}
            onChange={(v) => update("designation", v)}
          />
        </Field>
        <Field id={`${prefix}-income`} label="Net monthly income (LKR)">
          <TextInput
            id={`${prefix}-income`}
            type="number"
            value={guarantor.netMonthlyIncome}
            onChange={(v) => update("netMonthlyIncome", v)}
          />
        </Field>
        <Field id={`${prefix}-joined`} label="Date joined / started">
          <TextInput
            id={`${prefix}-joined`}
            type="date"
            value={guarantor.dateJoined}
            onChange={(v) => update("dateJoined", v)}
          />
        </Field>
      </div>
      <Field id={`${prefix}-employer`} label="Name & address of employer / business">
        <TextAreaInput
          id={`${prefix}-employer`}
          rows={2}
          value={guarantor.employerNameAddress}
          onChange={(v) => update("employerNameAddress", v)}
        />
      </Field>
    </div>
  )
}
