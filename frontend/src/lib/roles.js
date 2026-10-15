/**
 * Role definitions and mappings for IMFS MicroFlow ERP
 * M4: Graduated Trust Architecture & Multi-Tenant RBAC
 */

export const ROLE_DISPLAY_NAMES = {
  admin: "Institution Admin",
  executive: "Executive",
  finance_officer: "Finance Officer",
  hr_officer: "HR Officer",
  branch_manager: "Branch Manager",
  loan_officer: "Loan Officer",
}

export const DISPLAY_NAME_TO_ROLE = {
  "Institution Admin": "admin",
  "Executive": "executive",
  "Finance Officer": "finance_officer",
  "HR Officer": "hr_officer",
  "Branch Manager": "branch_manager",
  "Loan Officer": "loan_officer",
  "Field Officer": "loan_officer",
}

export const INSTITUTION_TYPE_MAP = {
  "Licensed Finance Company": "licensed_finance_company",
  "Microfinance NGO": "microfinance_ngo",
  "Rural Development Bank": "rural_development_bank",
  "Co-operative Society": "cooperative_society",
}

export function toBackendInstitutionType(displayType) {
  return INSTITUTION_TYPE_MAP[displayType] || "microfinance_ngo"
}

/**
 * Converts a backend role (e.g. 'finance_officer') to display label ('Finance Officer')
 */
export function toDisplayRole(role) {
  if (!role) return "User"
  return ROLE_DISPLAY_NAMES[role] || role
}

/**
 * Converts a display label (e.g. 'Finance Officer') to backend role ('finance_officer')
 */
export function toBackendRole(role) {
  if (!role) return ""
  return DISPLAY_NAME_TO_ROLE[role] || role
}

/**
 * Determines primary post-login dashboard route based on user role
 */
export function getRoleRedirect(role) {
  const backendRole = toBackendRole(role)
  switch (backendRole) {
    case "admin":
    case "executive":
      return "/dashboard"
    case "finance_officer":
      return "/finance-manager"
    case "hr_officer":
      return "/hr"
    case "branch_manager":
      return "/branch-manager"
    case "loan_officer":
      return "/loan-officer"
    default:
      return "/dashboard"
  }
}
