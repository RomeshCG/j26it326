/**
 * A1 Compliance Readiness v1 — tenant-scoped evidence + explainable rules.
 *
 * Uses actionType `generate_cbsl_report` (policy / Graduated Trust Tier 3).
 * Report kind is `cbsl_readiness_v1` — NOT an official CBSL submission.
 *
 * Numbers and gaps come only from Prisma aggregates. No LLM. No invented
 * financial/regulatory figures. Missing evidence is never treated as compliance.
 */

import { createHash } from "node:crypto"
import type { Capability, RoleName } from "./permissions.js"
import { hasCapability } from "./permissions.js"

export const A1_CBSL_ACTION_TYPE = "generate_cbsl_report" as const
export const A1_REPORT_KIND = "cbsl_readiness_v1" as const
export const A1_MODEL_VERSION = "a1-rules-v1" as const
export const A1_RULESET_VERSION = "a1-readiness-rules-v1" as const

/** Audit action written at prepare time (independent of mutable inputPayload). */
export const A1_PREPARE_AUDIT_ACTION = "a1_readiness.prepared" as const

export const A1_DISCLAIMER =
  "CBSL readiness / data-gap package only. Not an official CBSL regulatory submission. " +
  "Missing evidence is not treated as successful compliance."

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuidString(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value.trim())
}

export type A1GapSeverity = "blocking" | "warning" | "info"

export type A1OverallStatus =
  | "not_ready"
  | "ready_with_warnings"
  | "evidence_complete_for_scoped_checks"

export type A1DataGap = {
  code: string
  severity: A1GapSeverity
  message: string
  recommendation: string
}

export type A1InferredRisk = {
  code: string
  severity: A1GapSeverity
  basis: string
  message: string
}

export type A1OrganizationalFacts = {
  activeBranchCount: number
  totalBranchCount: number
  branches: Array<{
    id: string
    name: string
    district: string | null
    isActive: boolean
  }>
  employeeCount: number
  employeesByStatus: Record<string, number>
  employeesMissingEpfNumber: number
  employeesMissingEtfNumber: number
  payrollRecordCount: number
  payrollRecordCountInPeriod: number
}

export type A1GovernanceFacts = {
  generateCbslPolicyActive: boolean | null
  generateCbslPolicyTier: number | null
  agentActionsInPeriod: number
  tier3PendingCount: number
  tier3ApprovedInPeriod: number
  tier3RejectedInPeriod: number
  auditLogEntriesInPeriod: number
}

export type A1UnavailableSlots = {
  status: "not_available" | "partial"
  loanCount: number | null
  borrowerCount: number | null
  journalEntryCountInPeriod: number | null
  note: string
}

export type A1ReadinessFacts = {
  institution: {
    tenantInstitutionName: string | null
    centralInstitutionId: string | null
    tenantInfoPresent: boolean
  }
  organizational: A1OrganizationalFacts
  governance: A1GovernanceFacts
  financialAndPortfolioSlots: A1UnavailableSlots
}

export type A1ReadinessReport = {
  schemaVersion: "a1-v1"
  reportKind: typeof A1_REPORT_KIND
  disclaimer: string
  period: { startIso: string; endIso: string }
  generatedAt: string
  overallStatus: A1OverallStatus
  facts: A1ReadinessFacts
  dataGaps: A1DataGap[]
  inferredRisks: A1InferredRisk[]
  recommendations: string[]
  grounding: {
    modelVersion: typeof A1_MODEL_VERSION
    rulesetVersion: typeof A1_RULESET_VERSION
    analysisMode: "deterministic_rules"
    toolsUsed: Array<{ name: string; tables: string[] }>
  }
}

/** Minimal Prisma surface for A1 v1 (tenant DB only). */
export type A1TenantPrisma = {
  tenantInfo: {
    findFirst: (args: {
      where: { id: number }
    }) => Promise<{
      institutionId: string
      institutionName: string
    } | null>
  }
  branch: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
    findMany: (args: {
      select: Record<string, boolean>
      orderBy?: Record<string, string>
    }) => Promise<
      Array<{
        id: string
        name: string
        district: string | null
        isActive: boolean
      }>
    >
  }
  employee: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
    groupBy: (args: {
      by: ["employmentStatus"]
      _count: { _all: true }
    }) => Promise<Array<{ employmentStatus: string; _count: { _all: number } }>>
  }
  payrollRecord: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
  agentAction: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
  auditLog: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
  agentTierPolicy: {
    findUnique: (args: {
      where: { actionType: string }
    }) => Promise<{
      isActive: boolean
      tier: number
      agentId: string | null
    } | null>
  }
  loan?: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
  borrower?: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
  journalEntry?: {
    count: (args?: { where?: Record<string, unknown> }) => Promise<number>
  }
}

export type A1PeriodValidation =
  | { ok: true; start: Date; end: Date; startIso: string; endIso: string }
  | { ok: false; error: string }

export type A1PrepareBodyValidation =
  | { ok: true; period: A1PeriodValidation & { ok: true } }
  | { ok: false; error: string }

const MS_DAY = 24 * 60 * 60 * 1000
const MAX_PERIOD_DAYS = 366

function toIso(d: Date): string {
  return d.toISOString()
}

/**
 * Default: last 30 days ending now (UTC). Optional ISO start/end in body.
 */
export function validateA1PrepareBody(raw: unknown): A1PrepareBodyValidation {
  if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const body = raw as Record<string, unknown>
    if (body.periodStart !== undefined || body.periodEnd !== undefined) {
      if (typeof body.periodStart !== "string" || typeof body.periodEnd !== "string") {
        return {
          ok: false,
          error: "periodStart and periodEnd must both be ISO date strings when provided",
        }
      }
      const start = new Date(body.periodStart)
      const end = new Date(body.periodEnd)
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return { ok: false, error: "periodStart/periodEnd must be valid ISO timestamps" }
      }
      if (end.getTime() < start.getTime()) {
        return { ok: false, error: "periodEnd must be on or after periodStart" }
      }
      const spanDays = (end.getTime() - start.getTime()) / MS_DAY
      if (spanDays > MAX_PERIOD_DAYS) {
        return {
          ok: false,
          error: `Reporting period must be at most ${MAX_PERIOD_DAYS} days`,
        }
      }
      return {
        ok: true,
        period: {
          ok: true,
          start,
          end,
          startIso: toIso(start),
          endIso: toIso(end),
        },
      }
    }
  } else if (raw !== undefined && raw !== null && typeof raw !== "object") {
    return { ok: false, error: "Body must be a JSON object when provided" }
  }

  const end = new Date()
  const start = new Date(end.getTime() - 30 * MS_DAY)
  return {
    ok: true,
    period: {
      ok: true,
      start,
      end,
      startIso: toIso(start),
      endIso: toIso(end),
    },
  }
}

/**
 * Who may prepare an A1 readiness proposal (creates pending Tier 3 action).
 * Approve/reject still require agents:decide_tier3 (existing routes).
 */
export function roleMayPrepareA1(role: RoleName): boolean {
  return (
    hasCapability(role, "agents:decide_tier3") ||
    hasCapability(role, "finance:manage_ledger")
  )
}

export function capabilityHintForA1Prepare(): Capability[] {
  return ["agents:decide_tier3", "finance:manage_ledger"]
}

/**
 * Stable JSON for hashing (sorted object keys recursively).
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`
  }
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(",")}}`
}

/**
 * Hash of integrity-critical report fields (excludes generatedAt drift between hops).
 */
export function computeA1ProposalHash(report: A1ReadinessReport): string {
  const material = {
    schemaVersion: report.schemaVersion,
    reportKind: report.reportKind,
    disclaimer: report.disclaimer,
    period: report.period,
    overallStatus: report.overallStatus,
    facts: report.facts,
    dataGaps: report.dataGaps,
    inferredRisks: report.inferredRisks,
    recommendations: report.recommendations,
    grounding: report.grounding,
  }
  return createHash("sha256").update(stableStringify(material)).digest("hex")
}

export async function collectA1Evidence(
  tenantPrisma: A1TenantPrisma,
  period: { start: Date; end: Date }
): Promise<A1ReadinessFacts> {
  const tenantInfo = await tenantPrisma.tenantInfo.findFirst({ where: { id: 1 } })

  const [totalBranchCount, activeBranchCount, branches] = await Promise.all([
    tenantPrisma.branch.count(),
    tenantPrisma.branch.count({ where: { isActive: true } }),
    tenantPrisma.branch.findMany({
      select: { id: true, name: true, district: true, isActive: true },
      orderBy: { name: "asc" },
    }),
  ])

  const [
    employeeCount,
    statusGroups,
    employeesMissingEpfNumber,
    employeesMissingEtfNumber,
    payrollRecordCount,
    payrollRecordCountInPeriod,
  ] = await Promise.all([
    tenantPrisma.employee.count(),
    tenantPrisma.employee.groupBy({
      by: ["employmentStatus"],
      _count: { _all: true },
    }),
    tenantPrisma.employee.count({
      where: { OR: [{ epfNumber: null }, { epfNumber: "" }] },
    }),
    tenantPrisma.employee.count({
      where: { OR: [{ etfNumber: null }, { etfNumber: "" }] },
    }),
    tenantPrisma.payrollRecord.count(),
    tenantPrisma.payrollRecord.count({
      where: {
        period: { gte: period.start, lte: period.end },
      },
    }),
  ])

  const employeesByStatus: Record<string, number> = {}
  for (const row of statusGroups) {
    employeesByStatus[row.employmentStatus] = row._count._all
  }

  const policy = await tenantPrisma.agentTierPolicy.findUnique({
    where: { actionType: A1_CBSL_ACTION_TYPE },
  })

  const [
    agentActionsInPeriod,
    tier3PendingCount,
    tier3ApprovedInPeriod,
    tier3RejectedInPeriod,
    auditLogEntriesInPeriod,
  ] = await Promise.all([
    tenantPrisma.agentAction.count({
      where: { createdAt: { gte: period.start, lte: period.end } },
    }),
    tenantPrisma.agentAction.count({
      where: { tier: 3, status: "pending_approval" },
    }),
    tenantPrisma.agentAction.count({
      where: {
        tier: 3,
        status: "executed",
        decidedAt: { gte: period.start, lte: period.end },
      },
    }),
    tenantPrisma.agentAction.count({
      where: {
        tier: 3,
        status: "rejected",
        decidedAt: { gte: period.start, lte: period.end },
      },
    }),
    tenantPrisma.auditLog.count({
      where: { createdAt: { gte: period.start, lte: period.end } },
    }),
  ])

  let loanCount: number | null = null
  let borrowerCount: number | null = null
  let journalEntryCountInPeriod: number | null = null
  if (tenantPrisma.loan) {
    loanCount = await tenantPrisma.loan.count()
  }
  if (tenantPrisma.borrower) {
    borrowerCount = await tenantPrisma.borrower.count()
  }
  if (tenantPrisma.journalEntry) {
    journalEntryCountInPeriod = await tenantPrisma.journalEntry.count({
      where: { createdAt: { gte: period.start, lte: period.end } },
    })
  }

  const slotsEmpty =
    (loanCount === null || loanCount === 0) &&
    (borrowerCount === null || borrowerCount === 0) &&
    (journalEntryCountInPeriod === null || journalEntryCountInPeriod === 0)

  return {
    institution: {
      tenantInstitutionName: tenantInfo?.institutionName ?? null,
      centralInstitutionId: tenantInfo?.institutionId ?? null,
      tenantInfoPresent: Boolean(tenantInfo),
    },
    organizational: {
      activeBranchCount,
      totalBranchCount,
      branches,
      employeeCount,
      employeesByStatus,
      employeesMissingEpfNumber,
      employeesMissingEtfNumber,
      payrollRecordCount,
      payrollRecordCountInPeriod,
    },
    governance: {
      generateCbslPolicyActive: policy ? policy.isActive : null,
      generateCbslPolicyTier: policy ? policy.tier : null,
      agentActionsInPeriod,
      tier3PendingCount,
      tier3ApprovedInPeriod,
      tier3RejectedInPeriod,
      auditLogEntriesInPeriod,
    },
    financialAndPortfolioSlots: {
      status: slotsEmpty ? "not_available" : "partial",
      loanCount,
      borrowerCount,
      journalEntryCountInPeriod,
      note:
        "Loan/borrower/ledger counts are observational only. A1 does not assert CBSL portfolio or finance line items.",
    },
  }
}

/**
 * Explainable readiness rules over collected facts. Does not invent thresholds
 * from external regulation — only evidence-presence and governance hygiene.
 */
export function analyzeA1Readiness(facts: A1ReadinessFacts): {
  dataGaps: A1DataGap[]
  inferredRisks: A1InferredRisk[]
  recommendations: string[]
  overallStatus: A1OverallStatus
} {
  const dataGaps: A1DataGap[] = []
  const inferredRisks: A1InferredRisk[] = []
  const recommendations: string[] = []

  if (!facts.institution.tenantInfoPresent) {
    dataGaps.push({
      code: "NO_TENANT_INFO",
      severity: "blocking",
      message: "tenant_info row is missing; institution identity cannot be grounded.",
      recommendation: "Ensure tenant provisioning completed successfully.",
    })
  }

  if (facts.organizational.activeBranchCount < 1) {
    dataGaps.push({
      code: "NO_ACTIVE_BRANCH",
      severity: "blocking",
      message: "No active branch records found.",
      recommendation: "Create or activate at least one branch before compliance packaging.",
    })
  }

  if (facts.organizational.employeeCount < 1) {
    dataGaps.push({
      code: "NO_EMPLOYEES",
      severity: "blocking",
      message: "No employee records found.",
      recommendation: "Record staff in the tenant employees table (HR v1 when available).",
    })
  }

  if (
    facts.organizational.employeeCount > 0 &&
    facts.organizational.employeesMissingEpfNumber > 0
  ) {
    dataGaps.push({
      code: "EMPLOYEES_MISSING_EPF",
      severity: "blocking",
      message: `${facts.organizational.employeesMissingEpfNumber} of ${facts.organizational.employeeCount} employees lack an EPF number.`,
      recommendation: "Capture EPF numbers for all active staff before treating register evidence as complete.",
    })
  }

  if (
    facts.organizational.employeeCount > 0 &&
    facts.organizational.employeesMissingEtfNumber > 0
  ) {
    dataGaps.push({
      code: "EMPLOYEES_MISSING_ETF",
      severity: "warning",
      message: `${facts.organizational.employeesMissingEtfNumber} of ${facts.organizational.employeeCount} employees lack an ETF number.`,
      recommendation: "Capture ETF numbers for staff where required by internal policy.",
    })
  }

  if (facts.organizational.payrollRecordCount < 1) {
    dataGaps.push({
      code: "NO_PAYROLL_RECORDS",
      severity: "blocking",
      message: "No payroll_records exist in this tenant.",
      recommendation: "Run payroll (HR module) before claiming payroll/EPF evidence completeness.",
    })
  } else if (facts.organizational.payrollRecordCountInPeriod < 1) {
    dataGaps.push({
      code: "NO_PAYROLL_IN_PERIOD",
      severity: "warning",
      message: "Payroll rows exist but none fall in the selected reporting period.",
      recommendation: "Confirm the period or generate a payroll run covering this window.",
    })
  }

  if (facts.governance.generateCbslPolicyActive === null) {
    dataGaps.push({
      code: "CBSL_POLICY_MISSING",
      severity: "blocking",
      message: "No agent_tier_policies row for generate_cbsl_report.",
      recommendation: "Re-seed default Graduated Trust policies for this tenant.",
    })
  } else if (facts.governance.generateCbslPolicyActive === false) {
    dataGaps.push({
      code: "CBSL_POLICY_INACTIVE",
      severity: "blocking",
      message: "generate_cbsl_report policy exists but is inactive.",
      recommendation: "Reactivate the policy before preparing compliance packages.",
    })
  } else if (facts.governance.generateCbslPolicyTier !== 3) {
    inferredRisks.push({
      code: "CBSL_POLICY_TIER_UNEXPECTED",
      severity: "warning",
      basis: `policy.tier=${String(facts.governance.generateCbslPolicyTier)}`,
      message:
        "generate_cbsl_report is expected at Tier 3 for human approval; configured tier differs.",
    })
  }

  if (facts.governance.tier3PendingCount > 0) {
    inferredRisks.push({
      code: "TIER3_BACKLOG",
      severity: "warning",
      basis: `tier3PendingCount=${facts.governance.tier3PendingCount}`,
      message:
        "There are Tier 3 actions still pending approval; governance backlog may delay compliance decisions.",
    })
    recommendations.push(
      "Clear or decide existing Tier 3 pending actions before relying on a fresh readiness package."
    )
  }

  if (facts.governance.auditLogEntriesInPeriod < 1) {
    dataGaps.push({
      code: "NO_AUDIT_IN_PERIOD",
      severity: "info",
      message: "No audit_log entries in the selected period.",
      recommendation: "Normal for quiet periods; confirm audit writing is enabled if unexpected.",
    })
  }

  const fin = facts.financialAndPortfolioSlots
  if (
    fin.status === "not_available" ||
    (fin.loanCount === 0 && fin.borrowerCount === 0)
  ) {
    dataGaps.push({
      code: "PORTFOLIO_EVIDENCE_UNAVAILABLE",
      severity: "blocking",
      message:
        "No loan/borrower portfolio evidence is available in this tenant for the readiness package.",
      recommendation:
        "Integrate M3 portfolio data when available; until then treat portfolio CBSL lines as unavailable — not zero-compliant.",
    })
  }

  if (fin.journalEntryCountInPeriod === 0 || fin.journalEntryCountInPeriod === null) {
    dataGaps.push({
      code: "LEDGER_EVIDENCE_UNAVAILABLE",
      severity: "blocking",
      message: "No journal entry evidence in period (or ledger not queryable).",
      recommendation:
        "Integrate M2 ledger activity when available; do not invent financial totals.",
    })
  }

  const blocking = dataGaps.filter((g) => g.severity === "blocking").length
  const warnings =
    dataGaps.filter((g) => g.severity === "warning").length +
    inferredRisks.filter((r) => r.severity === "warning").length

  let overallStatus: A1OverallStatus
  if (blocking > 0) {
    overallStatus = "not_ready"
    recommendations.push(
      "Do not treat this package as submission-ready while blocking evidence gaps remain."
    )
  } else if (warnings > 0) {
    overallStatus = "ready_with_warnings"
    recommendations.push(
      "Review warnings with a human approver; scoped evidence checks passed without blocking gaps."
    )
  } else {
    overallStatus = "evidence_complete_for_scoped_checks"
    recommendations.push(
      "Scoped IMFS evidence checks found no blocking gaps. This is still not an official CBSL filing."
    )
  }

  // Deduplicate recommendations
  const uniqueRecs = [...new Set(recommendations)]

  return {
    dataGaps,
    inferredRisks,
    recommendations: uniqueRecs,
    overallStatus,
  }
}

export function buildA1ReadinessReport(input: {
  facts: A1ReadinessFacts
  period: { startIso: string; endIso: string }
  generatedAt?: string
}): A1ReadinessReport {
  const analysis = analyzeA1Readiness(input.facts)
  return {
    schemaVersion: "a1-v1",
    reportKind: A1_REPORT_KIND,
    disclaimer: A1_DISCLAIMER,
    period: input.period,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    overallStatus: analysis.overallStatus,
    facts: input.facts,
    dataGaps: analysis.dataGaps,
    inferredRisks: analysis.inferredRisks,
    recommendations: analysis.recommendations,
    grounding: {
      modelVersion: A1_MODEL_VERSION,
      rulesetVersion: A1_RULESET_VERSION,
      analysisMode: "deterministic_rules",
      toolsUsed: [
        {
          name: "prisma_tenant_aggregates",
          tables: [
            "tenant_info",
            "branches",
            "employees",
            "payroll_records",
            "agent_actions",
            "audit_log",
            "agent_tier_policies",
            "loans",
            "borrowers",
            "journal_entries",
          ],
        },
      ],
    },
  }
}

export async function prepareA1ReadinessReport(
  tenantPrisma: A1TenantPrisma,
  period: { start: Date; end: Date; startIso: string; endIso: string }
): Promise<A1ReadinessReport> {
  const facts = await collectA1Evidence(tenantPrisma, {
    start: period.start,
    end: period.end,
  })
  return buildA1ReadinessReport({
    facts,
    period: { startIso: period.startIso, endIso: period.endIso },
  })
}

export function buildA1ActionText(report: A1ReadinessReport): string {
  return `A1 compliance readiness (${report.reportKind}): ${report.overallStatus}`
}

export function buildA1InputPayload(
  report: A1ReadinessReport,
  meta: { preparedByUserId: string }
): Record<string, unknown> {
  if (!isUuidString(meta.preparedByUserId)) {
    throw new Error("preparedByUserId must be a valid UUID")
  }
  const proposalHash = computeA1ProposalHash(report)
  return {
    agentId: "A1",
    actionType: A1_CBSL_ACTION_TYPE,
    reportKind: A1_REPORT_KIND,
    modelVersion: A1_MODEL_VERSION,
    rulesetVersion: A1_RULESET_VERSION,
    proposalHash,
    preparedByUserId: meta.preparedByUserId.trim(),
    report,
    disclaimer: A1_DISCLAIMER,
  }
}

export function buildA1ToolsUsed(
  report: A1ReadinessReport,
  meta?: { proposalHash?: string; preparedByUserId?: string }
): unknown[] {
  return [
    {
      name: "a1_readiness_rules",
      args: {
        reportKind: report.reportKind,
        rulesetVersion: A1_RULESET_VERSION,
        period: report.period,
      },
      resultSummary: {
        overallStatus: report.overallStatus,
        blockingGaps: report.dataGaps.filter((g) => g.severity === "blocking").length,
        warningGaps: report.dataGaps.filter((g) => g.severity === "warning").length,
        proposalHash: meta?.proposalHash ?? computeA1ProposalHash(report),
        preparedByUserId: meta?.preparedByUserId ?? null,
      },
    },
  ]
}

export function buildA1PrepareAuditDetails(input: {
  actionId: string
  proposalHash: string
  preparedByUserId: string
  overallStatus: A1OverallStatus
  reportKind?: string
}): Record<string, unknown> {
  return {
    actionId: input.actionId,
    actionType: A1_CBSL_ACTION_TYPE,
    reportKind: input.reportKind ?? A1_REPORT_KIND,
    proposalHash: input.proposalHash,
    preparedByUserId: input.preparedByUserId,
    overallStatus: input.overallStatus,
    note:
      "Prepare-time binding for A1 proposalHash / preparer. Not cryptographic immutability against DB admins.",
  }
}

/** True when this pending action is an A1 readiness package (not other Tier 3 types). */
export function isA1ReadinessInputPayload(inputPayload: unknown): boolean {
  if (
    inputPayload === null ||
    typeof inputPayload !== "object" ||
    Array.isArray(inputPayload)
  ) {
    return false
  }
  const p = inputPayload as Record<string, unknown>
  return (
    p.actionType === A1_CBSL_ACTION_TYPE && p.reportKind === A1_REPORT_KIND
  )
}

export type A1ApproveGateResult =
  | { ok: true; preparedByUserId: string; proposalHash: string }
  | { ok: false; error: string; httpStatus: 403 | 409 }

/**
 * Server-side A1 approve gate: SoD + prepare-audit hash binding + payload self-hash.
 * Legacy / missing preparer or prepare audit → fail closed (not silently allowed).
 *
 * Does not claim cryptographic immutability if an attacker can rewrite both the
 * action row and the prepare audit; it raises the bar for casual payload edits.
 */
export function evaluateA1ApproveGate(input: {
  inputPayload: unknown
  approverUserId: string
  prepareAuditDetails: unknown | null
}): A1ApproveGateResult {
  if (!isUuidString(input.approverUserId)) {
    return {
      ok: false,
      error: "Approver userId must be a valid UUID",
      httpStatus: 409,
    }
  }

  if (!isA1ReadinessInputPayload(input.inputPayload)) {
    return {
      ok: false,
      error: "Action is not a recognized A1 readiness package",
      httpStatus: 409,
    }
  }

  const payload = input.inputPayload as Record<string, unknown>
  const preparedByUserId = payload.preparedByUserId
  if (!isUuidString(preparedByUserId)) {
    return {
      ok: false,
      error:
        "A1 preparedByUserId missing or invalid — legacy packages cannot be approved safely",
      httpStatus: 409,
    }
  }

  if (preparedByUserId.trim() === input.approverUserId.trim()) {
    return {
      ok: false,
      error:
        "Separation of duties: the user who prepared this A1 report cannot approve it",
      httpStatus: 403,
    }
  }

  const grounded = extractA1HandlerGrounding(payload)
  if (!grounded.ok) {
    return { ok: false, error: grounded.error, httpStatus: 409 }
  }

  if (
    input.prepareAuditDetails === null ||
    typeof input.prepareAuditDetails !== "object" ||
    Array.isArray(input.prepareAuditDetails)
  ) {
    return {
      ok: false,
      error:
        "A1 prepare audit binding missing — cannot verify proposalHash independently",
      httpStatus: 409,
    }
  }

  const audit = input.prepareAuditDetails as Record<string, unknown>
  if (typeof audit.proposalHash !== "string" || audit.proposalHash.length < 32) {
    return {
      ok: false,
      error: "A1 prepare audit is missing proposalHash",
      httpStatus: 409,
    }
  }
  if (audit.proposalHash !== grounded.proposalHash) {
    return {
      ok: false,
      error:
        "A1 proposalHash does not match prepare-time audit binding (payload may have been altered)",
      httpStatus: 409,
    }
  }
  if (
    isUuidString(audit.preparedByUserId) &&
    audit.preparedByUserId.trim() !== preparedByUserId.trim()
  ) {
    return {
      ok: false,
      error: "A1 preparedByUserId does not match prepare-time audit binding",
      httpStatus: 409,
    }
  }

  return {
    ok: true,
    preparedByUserId: preparedByUserId.trim(),
    proposalHash: grounded.proposalHash,
  }
}

export type A1HandlerGrounding =
  | {
      ok: true
      report: A1ReadinessReport
      proposalHash: string
    }
  | { ok: false; error: string }

/**
 * Fail-closed: approved handler only accepts the reviewed readiness package.
 */
export function extractA1HandlerGrounding(inputPayload: unknown): A1HandlerGrounding {
  if (
    inputPayload === null ||
    typeof inputPayload !== "object" ||
    Array.isArray(inputPayload)
  ) {
    return { ok: false, error: "A1 handler missing grounded inputPayload" }
  }
  const payload = inputPayload as Record<string, unknown>

  if (payload.actionType !== A1_CBSL_ACTION_TYPE) {
    return { ok: false, error: "A1 handler actionType mismatch" }
  }
  if (payload.reportKind !== A1_REPORT_KIND) {
    return { ok: false, error: "A1 handler reportKind mismatch" }
  }
  if (typeof payload.proposalHash !== "string" || payload.proposalHash.length < 32) {
    return { ok: false, error: "A1 handler missing proposalHash" }
  }
  if (
    payload.report === null ||
    typeof payload.report !== "object" ||
    Array.isArray(payload.report)
  ) {
    return { ok: false, error: "A1 handler missing report object" }
  }

  const report = payload.report as A1ReadinessReport
  if (report.reportKind !== A1_REPORT_KIND || report.schemaVersion !== "a1-v1") {
    return { ok: false, error: "A1 handler report schema/kind invalid" }
  }
  if (!report.facts || !Array.isArray(report.dataGaps)) {
    return { ok: false, error: "A1 handler report missing facts or dataGaps" }
  }

  const expected = computeA1ProposalHash(report)
  if (expected !== payload.proposalHash) {
    return {
      ok: false,
      error: "A1 proposalHash mismatch — reviewed report integrity check failed",
    }
  }

  return {
    ok: true,
    report,
    proposalHash: payload.proposalHash,
  }
}
