import { createDefaultBranchOverride } from "./branch-context"

export const LOAN_TYPES = [
  {
    id: "consumer",
    label: "Consumer / Personal-Business",
    description:
      "Joint application for personal, self-employment, and small business borrowers.",
    available: true,
  },
  {
    id: "hire-purchase",
    label: "Hire Purchase (Bike / Three-wheel)",
    description:
      "Vehicle lease / hire purchase application for bikes and three-wheelers.",
    available: true,
  },
]

export const WIZARD_STEPS = [
  { id: 1, title: "Client & loan details" },
  { id: 2, title: "Financial profile" },
  { id: 3, title: "Credit appraisal" },
  { id: 4, title: "Loan request" },
  { id: 5, title: "Income & review" },
]

export const SALUTATIONS = ["Mr", "Mrs", "Ms", "Miss"]
export const CIVIL_STATUSES = ["Married", "Unmarried", "Widow", "Other"]
export const LOAN_PURPOSES = [
  "Personal",
  "Professional",
  "Self-employment",
  "Consumption",
]
export const INTEREST_PERIODS = ["Monthly", "Annual"]

export { createDefaultBranchOverride } from "./branch-context"

export function createEmptyLoanRow() {
  return {
    facilityNo: "",
    dateGranted: "",
    amountGranted: "",
    monthlyRental: "",
    capitalBalance: "",
    arrears: "",
  }
}

export function createEmptyLineRow() {
  return { label: "", amount: "" }
}

export function createDefaultForm(applicantType = "individual") {
  return {
    applicantType,
    branch: "",
    assignedBranch: "",
    branchOverride: createDefaultBranchOverride(),
    centerName: "",
    groupNo: "",
    customerCode: "",
    contactNo: "",
    loanAmount: "",
    terms: "",
    installment: "",
    inspectionDate: "",
    disburseDate: "",
    salutation: "",
    civilStatus: "",
    nameWithInitials: "",
    fullName: "",
    preferredName: "",
    dateOfBirth: "",
    nic: "",
    businessRegNo: "",
    address: "",
    children: "",
    grandParent: "",
    spouse: {
      name: "",
      occupation: "",
      phone: "",
      nic: "",
    },
    occupation: "",
    employerName: "",
    employerPhone: "",
    employerAddress: "",
    phoneHome: "",
    phoneWork: "",
    phoneMobile: "",
    whatsapp: "",
    email: "",
    facebook: "",
    viber: "",
    existingLoans: [createEmptyLoanRow(), createEmptyLoanRow()],
    bank: {
      bank: "",
      branch: "",
      accountNo: "",
      accountType: "",
    },
    assets: {
      movable: "",
      immovable: "",
    },
    income: {
      netSalary: "",
      otherIncome: "",
      livingExpenses: "",
      otherIncomeDetails: "",
      existingRentals: "",
      otherDebtService: "",
      proposedCommitment: "",
    },
    facilityType: "Consumer loan",
    facilityAmount: "",
    applicantStatus: "New",
    article: "",
    value: "",
    appraisalDate: "",
    rental: "",
    creditOfficer: "",
    age: "",
    professionEmployer: "",
    natureOfBusiness: "",
    businessSince: "",
    purpose: "",
    backgroundNotes: "",
    locationNotes: "",
    amountInWords: "",
    loanPurpose: [],
    interestRate: "",
    interestPeriod: "Monthly",
    applicationDate: "",
    incomeRows: [createEmptyLineRow(), createEmptyLineRow(), createEmptyLineRow()],
    expenseRows: [createEmptyLineRow(), createEmptyLineRow(), createEmptyLineRow()],
    loanExpenseRows: [createEmptyLineRow(), createEmptyLineRow()],
  }
}

export function createApplication(loanType, applicantType = "individual") {
  const now = new Date().toISOString()
  return {
    id: `APP-${Date.now().toString().slice(-8)}`,
    loanType,
    status: "draft",
    currentStep: 1,
    form: createDefaultForm(applicantType),
    createdAt: now,
    updatedAt: now,
    borrowerId: null,
  }
}
