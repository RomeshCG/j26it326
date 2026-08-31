import { createDefaultBranchOverride } from "../branch-context"

export const VEHICLE_WIZARD_STEPS = [
  { id: 1, title: "General & contact" },
  { id: 2, title: "Income & assets" },
  { id: 3, title: "Vehicle & guarantor 1" },
  { id: 4, title: "Guarantor 2 & declaration" },
  { id: 5, title: "Review" },
]

export const SALUTATIONS = ["Mr", "Mrs", "Ms", "Other"]
export const LOAN_SUB_TYPES = [
  { value: "lease", label: "Lease" },
  { value: "hire-purchase", label: "Hire Purchase" },
  { value: "vehicle-loan", label: "Vehicle Loan" },
]
export const VEHICLE_TYPES = [
  { value: "bike", label: "Bike" },
  { value: "three-wheeler", label: "Three-wheeler" },
  { value: "other", label: "Other vehicle" },
]
export const LEASE_PURPOSES = [
  { value: "business", label: "Business" },
  { value: "personal", label: "Personal" },
  { value: "rent", label: "Rent" },
  { value: "hire", label: "Hire" },
]
export const VEHICLE_CONDITIONS = [
  { value: "registered", label: "Registered" },
  { value: "unregistered", label: "Unregistered" },
]
export const RESIDENCE_TYPES = [
  { value: "owned", label: "Owned" },
  { value: "rented", label: "Rented" },
  { value: "with-parents", label: "With parents" },
  { value: "other", label: "Other" },
]
export const GENDERS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
]
export const MARITAL_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "widowed", label: "Widowed" },
  { value: "divorced", label: "Divorced" },
]
export const EDUCATION_LEVELS = [
  "Primary / Secondary",
  "Diploma",
  "Graduate",
  "Post Graduate",
  "Professional",
]
export const ADDRESS_PROOF_TYPES = [
  "Electricity Bill",
  "Water Bill",
  "Telephone Bill",
  "Other",
]
export const OCCUPANCY_TYPES = [
  { value: "employed", label: "Employed" },
  { value: "self-employed", label: "Self Employed" },
  { value: "businessman", label: "Businessman" },
  { value: "other", label: "Other" },
]
export const EMPLOYMENT_NATURES = [
  "Clerical",
  "Skilled",
  "Supervisor",
  "Executive",
  "Director",
  "Consultant",
  "Middle Management",
  "Senior Management",
]
export const EMPLOYER_NATURES = ["Government", "Semi Government", "Private"]

export function createEmptyMovableAssetRow() {
  return { property: "", value: "", vehicleNo: "", tenure: "" }
}

export function createEmptyImmovableAssetRow() {
  return { property: "", value: "", tenure: "" }
}

export function createEmptyLiabilityRow() {
  return {
    type: "",
    bank: "",
    amountOutstanding: "",
    monthlyPayment: "",
    security: "",
  }
}

export function createEmptyGuarantor() {
  return {
    salutation: "",
    name: "",
    address: "",
    nic: "",
    dateOfBirth: "",
    homeLandline: "",
    homeMobile: "",
    officeLandline: "",
    officeMobile: "",
    email: "",
    occupancy: "",
    designation: "",
    employerNameAddress: "",
    dateJoined: "",
    netMonthlyIncome: "",
  }
}

export function createDefaultVehicleForm() {
  return {
    branch: "",
    assignedBranch: "",
    branchOverride: createDefaultBranchOverride(),
    applicationDate: "",
    loanSubType: "hire-purchase",
    productCode: "",
    groupNo: "",
    customerCode: "",
    financeAmount: "",
    facilityPeriodMonths: "",
    cashPrice: "",
    salutation: "",
    fullName: "",
    nic: "",
    dateOfBirth: "",
    permanentAddress: "",
    permanentPostalCode: "",
    correspondenceAddress: "",
    correspondencePostalCode: "",
    addressProof: "",
    addressProofOther: "",
    addressDurationYears: "",
    addressDurationMonths: "",
    residenceType: "",
    residenceTypeOther: "",
    gramaSevakaName: "",
    gramaSevakaNumber: "",
    district: "",
    agaDivision: "",
    gender: "",
    maritalStatus: "",
    education: "",
    dependents: "",
    child1Age: "",
    child2Age: "",
    child3Age: "",
    phoneLandline: "",
    phoneMobile1: "",
    phoneMobile2: "",
    email: "",
    income: {
      occupancy: "",
      designation: "",
      employmentNature: "",
      employerNameAddress: "",
      employerNature: "",
      dateJoined: "",
      netMonthlyIncome: "",
      businessPhoneLandline: "",
      businessPhoneMobile: "",
      workEmail: "",
      previousEmployer: "",
      previousExperience: "",
    },
    familyMember: {
      salutation: "",
      name: "",
      address: "",
      nic: "",
      landline: "",
      mobile: "",
      employed: "",
      employerName: "",
      employerAddress: "",
      designation: "",
      employerContact: "",
    },
    movableAssets: [
      createEmptyMovableAssetRow(),
      createEmptyMovableAssetRow(),
      createEmptyMovableAssetRow(),
    ],
    immovableAssets: [
      createEmptyImmovableAssetRow(),
      createEmptyImmovableAssetRow(),
    ],
    liabilities: [
      createEmptyLiabilityRow(),
      createEmptyLiabilityRow(),
    ],
    vehicle: {
      leasePurpose: "",
      vehicleType: "",
      condition: "",
      make: "",
      model: "",
      yearOfManufacture: "",
      vehicleNumber: "",
      expectedIncome: "",
      supplierName: "",
      location: "",
    },
    guarantor1: createEmptyGuarantor(),
    guarantor2: createEmptyGuarantor(),
    declarationAccepted: false,
  }
}

export function createVehicleApplication(loanType = "hire-purchase") {
  const now = new Date().toISOString()
  return {
    id: `APP-${Date.now().toString().slice(-8)}`,
    loanType,
    status: "draft",
    currentStep: 1,
    form: createDefaultVehicleForm(),
    createdAt: now,
    updatedAt: now,
    borrowerId: null,
  }
}
