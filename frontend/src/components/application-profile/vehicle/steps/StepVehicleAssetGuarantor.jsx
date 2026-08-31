import {
  Field,
  SectionTitle,
  TextInput,
  ToggleGroup,
} from "../../FormFields"
import GuarantorFields from "../components/GuarantorFields"
import {
  LEASE_PURPOSES,
  VEHICLE_CONDITIONS,
  VEHICLE_TYPES,
} from "../constants"

export default function StepVehicleAssetGuarantor({ form, errors, onChange }) {
  function updateVehicle(field, value) {
    onChange({ ...form, vehicle: { ...form.vehicle, [field]: value } })
  }

  return (
    <div className="space-y-8">
      <SectionTitle
        title="Section F · Asset to be leased"
        description="Bike and three-wheeler financing details."
      />
      <Field id="leasePurpose" label="Purpose of lease / hire">
        <ToggleGroup
          value={form.vehicle.leasePurpose}
          options={LEASE_PURPOSES}
          onChange={(v) => updateVehicle("leasePurpose", v)}
        />
      </Field>
      <Field id="vehicleType" label="Type of vehicle" required error={errors.vehicleType}>
        <ToggleGroup
          value={form.vehicle.vehicleType}
          options={VEHICLE_TYPES}
          onChange={(v) => updateVehicle("vehicleType", v)}
        />
      </Field>
      <Field id="vehicleCondition" label="Condition">
        <ToggleGroup
          value={form.vehicle.condition}
          options={VEHICLE_CONDITIONS}
          onChange={(v) => updateVehicle("condition", v)}
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Field id="vehicleMake" label="Make" required error={errors.vehicleMake}>
          <TextInput id="vehicleMake" value={form.vehicle.make} onChange={(v) => updateVehicle("make", v)} />
        </Field>
        <Field id="vehicleModel" label="Model" required error={errors.vehicleModel}>
          <TextInput id="vehicleModel" value={form.vehicle.model} onChange={(v) => updateVehicle("model", v)} />
        </Field>
        <Field id="vehicleYear" label="Year of manufacture">
          <TextInput
            id="vehicleYear"
            type="number"
            value={form.vehicle.yearOfManufacture}
            onChange={(v) => updateVehicle("yearOfManufacture", v)}
          />
        </Field>
        <Field id="vehicleNumber" label="Vehicle number">
          <TextInput
            id="vehicleNumber"
            value={form.vehicle.vehicleNumber}
            onChange={(v) => updateVehicle("vehicleNumber", v)}
          />
        </Field>
        <Field id="expectedIncome" label="Expected income from vehicle (LKR)">
          <TextInput
            id="expectedIncome"
            type="number"
            value={form.vehicle.expectedIncome}
            onChange={(v) => updateVehicle("expectedIncome", v)}
          />
        </Field>
        <Field id="supplierName" label="Supplier name">
          <TextInput
            id="supplierName"
            value={form.vehicle.supplierName}
            onChange={(v) => updateVehicle("supplierName", v)}
          />
        </Field>
        <Field id="vehicleLocation" label="Location of vehicle">
          <TextInput
            id="vehicleLocation"
            value={form.vehicle.location}
            onChange={(v) => updateVehicle("location", v)}
          />
        </Field>
      </div>

      <SectionTitle title="Section G · Guarantor 1" />
      <GuarantorFields
        prefix="guarantor1"
        guarantor={form.guarantor1}
        errors={errors}
        onChange={(guarantor1) => onChange({ ...form, guarantor1 })}
      />
    </div>
  )
}
