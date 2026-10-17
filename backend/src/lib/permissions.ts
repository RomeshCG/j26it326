/**
 * Global role definitions and capabilities for IMFS RBAC.
 * The 6 roles in central.roles are strictly:
 * admin | executive | finance_officer | hr_officer | branch_manager | loan_officer
 */

export const ROLES = [
  "admin",
  "executive",
  "finance_officer",
  "hr_officer",
  "branch_manager",
  "loan_officer",
] as const

export type RoleName = (typeof ROLES)[number]

export function isValidRole(role: string): role is RoleName {
  return (ROLES as readonly string[]).includes(role)
}

/**
 * High-level permission capabilities across IMFS modules.
 */
export type Capability =
  // Central / Tenant Admin (M4)
  | "system:manage_users"
  | "system:view_settings"
  | "system:manage_settings"
  | "tenant:view_info"
  | "tenant:manage_branches"
  | "tenant:view_branches"
  // HR & Payroll (M4)
  | "hr:manage_employees"
  | "hr:view_employees"
  | "hr:run_payroll"
  | "hr:approve_payroll"
  // Graduated Trust & Agents (M4)
  | "agents:view_actions"
  | "agents:manage_policies"
  | "agents:decide_tier3"
  | "agents:query_nlq"
  // Financial Engine & Ledger (M2)
  | "finance:view_ledger"
  | "finance:manage_ledger"
  | "finance:view_kpis"
  | "finance:view_mission_drift"
  // Loans & Borrower Operations (M3)
  | "loans:create_application"
  | "loans:review_application"
  | "loans:approve_application"
  | "loans:disburse"
  | "loans:collect_repayment"
  | "loans:view_ews_alerts"
  // Credit Risk (M1)
  | "risk:view_assessments"
  | "risk:run_assessment"
  // Executive Oversight
  | "executive:view_dashboard"

/**
 * Permissions mapping per role.
 * Read-only reference for M1/M2/M3 and UI checks.
 */
export const ROLE_PERMISSIONS: Record<RoleName, readonly Capability[]> = {
  admin: [
    "system:manage_users",
    "system:view_settings",
    "system:manage_settings",
    "tenant:view_info",
    "tenant:manage_branches",
    "tenant:view_branches",
    "hr:manage_employees",
    "hr:view_employees",
    "agents:view_actions",
    "agents:manage_policies",
    "agents:decide_tier3",
    "agents:query_nlq",
    "finance:view_ledger",
    "finance:view_kpis",
    "finance:view_mission_drift",
    "loans:view_ews_alerts",
    "risk:view_assessments",
    "executive:view_dashboard",
  ],
  executive: [
    "tenant:view_info",
    "tenant:view_branches",
    "hr:view_employees",
    "finance:view_ledger",
    "finance:view_kpis",
    "finance:view_mission_drift",
    "agents:view_actions",
    "agents:decide_tier3",
    "agents:query_nlq",
    "risk:view_assessments",
    "loans:view_ews_alerts",
    "executive:view_dashboard",
  ],
  finance_officer: [
    "tenant:view_info",
    "tenant:view_branches",
    "hr:view_employees",
    "hr:approve_payroll",
    "finance:view_ledger",
    "finance:manage_ledger",
    "finance:view_kpis",
    "finance:view_mission_drift",
    "loans:disburse",
    "agents:view_actions",
    "agents:query_nlq",
  ],
  hr_officer: [
    "tenant:view_info",
    "tenant:view_branches",
    "hr:manage_employees",
    "hr:view_employees",
    "hr:run_payroll",
    "agents:view_actions",
    "agents:query_nlq",
  ],
  branch_manager: [
    "tenant:view_info",
    "tenant:view_branches",
    "hr:view_employees",
    "loans:review_application",
    "loans:approve_application",
    "loans:disburse",
    "loans:collect_repayment",
    "loans:view_ews_alerts",
    "risk:view_assessments",
    "agents:view_actions",
    "agents:decide_tier3",
    "agents:query_nlq",
  ],
  loan_officer: [
    "tenant:view_info",
    "tenant:view_branches",
    "loans:create_application",
    "loans:collect_repayment",
    "loans:view_ews_alerts",
    "risk:view_assessments",
    "risk:run_assessment",
    "agents:view_actions",
    "agents:query_nlq",
  ],
}

/**
 * Checks if a given role has a specific capability.
 */
export function hasCapability(role: RoleName, capability: Capability): boolean {
  const allowed = ROLE_PERMISSIONS[role]
  return allowed ? allowed.includes(capability) : false
}
