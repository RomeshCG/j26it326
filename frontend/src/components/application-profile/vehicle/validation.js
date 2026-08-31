export function validateVehicleStep(step, form, branchContext) {
  const errors = {}

  if (step === 1) {
    if (branchContext.mode === "select") {
      if (!form.branch?.trim()) errors.branch = "Select a branch"
    } else if (form.branchOverride?.enabled) {
      if (!form.branchOverride.requestedBranch) {
        errors.requestedBranch = "Select the requested branch"
      }
      if (!form.branchOverride.reason?.trim()) {
        errors.overrideReason = "Provide a reason for the branch override"
      }
    }
    if (!form.applicationDate) errors.applicationDate = "Application date is required"
    if (!form.financeAmount || Number(form.financeAmount) <= 0) {
      errors.financeAmount = "Enter finance amount"
    }
    if (!form.facilityPeriodMonths || Number(form.facilityPeriodMonths) <= 0) {
      errors.facilityPeriodMonths = "Enter facility period"
    }
    if (!form.fullName?.trim()) errors.fullName = "Full name is required"
    if (!form.nic?.trim()) errors.nic = "NIC is required"
    if (!form.maritalStatus) errors.maritalStatus = "Marital status is required"
    if (!form.permanentAddress?.trim()) errors.permanentAddress = "Permanent address is required"
    if (!form.phoneMobile1?.trim()) errors.phoneMobile1 = "Mobile number is required"
  }

  if (step === 2) {
    if (!form.income?.occupancy) errors.incomeOccupancy = "Nature of occupancy is required"
    if (!form.income?.netMonthlyIncome || Number(form.income.netMonthlyIncome) <= 0) {
      errors.netMonthlyIncome = "Enter net monthly income"
    }
    if (form.maritalStatus === "married") {
      if (!form.familyMember?.name?.trim()) errors.familyName = "Spouse name is required"
      if (!form.familyMember?.nic?.trim()) errors.familyNic = "Spouse NIC is required"
      if (!form.familyMember?.mobile?.trim()) errors.familyMobile = "Spouse mobile is required"
    } else if (form.maritalStatus === "single") {
      if (!form.familyMember?.name?.trim()) {
        errors.familyName = "Immediate family member name is required"
      }
      if (!form.familyMember?.mobile?.trim()) {
        errors.familyMobile = "Family member mobile is required"
      }
    }
  }

  if (step === 3) {
    if (!form.vehicle?.vehicleType) errors.vehicleType = "Select vehicle type"
    if (!form.vehicle?.make?.trim()) errors.vehicleMake = "Make is required"
    if (!form.vehicle?.model?.trim()) errors.vehicleModel = "Model is required"
    if (!form.guarantor1?.name?.trim()) errors.guarantor1Name = "Guarantor 1 name is required"
    if (!form.guarantor1?.nic?.trim()) errors.guarantor1Nic = "Guarantor 1 NIC is required"
  }

  if (step === 4) {
    if (!form.guarantor2?.name?.trim()) errors.guarantor2Name = "Guarantor 2 name is required"
    if (!form.guarantor2?.nic?.trim()) errors.guarantor2Nic = "Guarantor 2 NIC is required"
    if (!form.declarationAccepted) {
      errors.declarationAccepted = "Declaration must be accepted"
    }
  }

  return errors
}
