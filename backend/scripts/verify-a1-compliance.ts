/**
 * Offline verification for A1 CBSL readiness v1 (no DB / no live dispatch).
 *
 * Run: npm run verify:a1-compliance
 */
import {
  A1_CBSL_ACTION_TYPE,
  A1_MODEL_VERSION,
  A1_PREPARE_AUDIT_ACTION,
  A1_REPORT_KIND,
  A1_RULESET_VERSION,
  analyzeA1Readiness,
  buildA1InputPayload,
  buildA1PrepareAuditDetails,
  buildA1ReadinessReport,
  computeA1ProposalHash,
  evaluateA1ApproveGate,
  extractA1HandlerGrounding,
  isA1ReadinessInputPayload,
  roleMayPrepareA1,
  validateA1PrepareBody,
  type A1ReadinessFacts,
} from "../src/lib/agent-a1-compliance.js"
import {
  cbslReadinessHandler,
  clearActionHandlers,
  defaultStubHandler,
  executeActionHandler,
  getActionHandler,
  hasRegisteredActionHandler,
  registerDefaultAgentHandlers,
} from "../src/lib/agent-handlers.js"
import {
  A2_BUDGET_ACTION_TYPE,
} from "../src/lib/agent-a2-budget.js"
import { A4_NLQ_ACTION_TYPE } from "../src/lib/agent-a4-nlq.js"
import { A1_PREPARE_ROLES } from "../src/routes/agent-governance.js"
import { hasCapability, type RoleName } from "../src/lib/permissions.js"

let passed = 0
let failed = 0

function assert(condition: boolean, name: string, detail?: string) {
  if (condition) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`)
}

function sparseFacts(over: Partial<A1ReadinessFacts> = {}): A1ReadinessFacts {
  const base: A1ReadinessFacts = {
    institution: {
      tenantInstitutionName: "ZZ Test",
      centralInstitutionId: "33b6545d-7c78-4354-a017-d0717efba3b8",
      tenantInfoPresent: true,
    },
    organizational: {
      activeBranchCount: 1,
      totalBranchCount: 1,
      branches: [
        {
          id: "b1",
          name: "Head Office",
          district: "Colombo",
          isActive: true,
        },
      ],
      employeeCount: 1,
      employeesByStatus: { active: 1 },
      employeesMissingEpfNumber: 1,
      employeesMissingEtfNumber: 1,
      payrollRecordCount: 0,
      payrollRecordCountInPeriod: 0,
    },
    governance: {
      generateCbslPolicyActive: true,
      generateCbslPolicyTier: 3,
      agentActionsInPeriod: 2,
      tier3PendingCount: 0,
      tier3ApprovedInPeriod: 0,
      tier3RejectedInPeriod: 0,
      auditLogEntriesInPeriod: 5,
    },
    financialAndPortfolioSlots: {
      status: "not_available",
      loanCount: 0,
      borrowerCount: 0,
      journalEntryCountInPeriod: 0,
      note: "test",
    },
  }
  return {
    ...base,
    ...over,
    institution: { ...base.institution, ...over.institution },
    organizational: { ...base.organizational, ...over.organizational },
    governance: { ...base.governance, ...over.governance },
    financialAndPortfolioSlots: {
      ...base.financialAndPortfolioSlots,
      ...over.financialAndPortfolioSlots,
    },
  }
}

section("validateA1PrepareBody")
assert(!validateA1PrepareBody("x").ok, "rejects non-object")
assert(validateA1PrepareBody({}).ok, "empty body uses default 30d window")
assert(validateA1PrepareBody(undefined).ok, "undefined body ok")
assert(
  !validateA1PrepareBody({ periodStart: "2026-01-01" }).ok,
  "rejects partial period"
)
assert(
  !validateA1PrepareBody({
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2025-01-01T00:00:00.000Z",
  }).ok,
  "rejects end before start"
)
{
  const v = validateA1PrepareBody({
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-01-31T23:59:59.000Z",
  })
  assert(v.ok, "accepts explicit period")
}

section("analyzeA1Readiness — sparse tenant (typical provisioned)")
{
  const a = analyzeA1Readiness(sparseFacts())
  assert(a.overallStatus === "not_ready", "sparse tenant is not_ready")
  assert(
    a.dataGaps.some((g) => g.code === "NO_PAYROLL_RECORDS"),
    "flags missing payroll"
  )
  assert(
    a.dataGaps.some((g) => g.code === "EMPLOYEES_MISSING_EPF"),
    "flags missing EPF"
  )
  assert(
    a.dataGaps.some((g) => g.code === "PORTFOLIO_EVIDENCE_UNAVAILABLE"),
    "flags portfolio unavailable"
  )
  assert(
    a.dataGaps.some((g) => g.code === "LEDGER_EVIDENCE_UNAVAILABLE"),
    "flags ledger unavailable"
  )
  assert(
    !a.dataGaps.some((g) => /compliant|passed CBSL/i.test(g.message)),
    "does not claim CBSL compliance"
  )
}

section("analyzeA1Readiness — missing tenant_info is blocking")
{
  const a = analyzeA1Readiness(
    sparseFacts({
      institution: {
        tenantInstitutionName: null,
        centralInstitutionId: null,
        tenantInfoPresent: false,
      },
    })
  )
  assert(
    a.dataGaps.some((g) => g.code === "NO_TENANT_INFO" && g.severity === "blocking"),
    "NO_TENANT_INFO blocking"
  )
}

section("analyzeA1Readiness — evidence-complete scoped path")
{
  const a = analyzeA1Readiness(
    sparseFacts({
      organizational: {
        activeBranchCount: 2,
        totalBranchCount: 2,
        branches: [
          { id: "b1", name: "HQ", district: null, isActive: true },
          { id: "b2", name: "Branch", district: "Galle", isActive: true },
        ],
        employeeCount: 3,
        employeesByStatus: { active: 3 },
        employeesMissingEpfNumber: 0,
        employeesMissingEtfNumber: 0,
        payrollRecordCount: 3,
        payrollRecordCountInPeriod: 3,
      },
      financialAndPortfolioSlots: {
        status: "partial",
        loanCount: 10,
        borrowerCount: 8,
        journalEntryCountInPeriod: 4,
        note: "test",
      },
      governance: {
        generateCbslPolicyActive: true,
        generateCbslPolicyTier: 3,
        agentActionsInPeriod: 1,
        tier3PendingCount: 0,
        tier3ApprovedInPeriod: 0,
        tier3RejectedInPeriod: 0,
        auditLogEntriesInPeriod: 2,
      },
    })
  )
  assert(
    a.overallStatus === "evidence_complete_for_scoped_checks",
    "scoped complete when evidence present"
  )
  assert(
    a.dataGaps.filter((g) => g.severity === "blocking").length === 0,
    "no blocking gaps"
  )
}

section("analyzeA1Readiness — tier3 backlog warning")
{
  const a = analyzeA1Readiness(
    sparseFacts({
      governance: {
        generateCbslPolicyActive: true,
        generateCbslPolicyTier: 3,
        agentActionsInPeriod: 1,
        tier3PendingCount: 2,
        tier3ApprovedInPeriod: 0,
        tier3RejectedInPeriod: 0,
        auditLogEntriesInPeriod: 1,
      },
    })
  )
  assert(
    a.inferredRisks.some((r) => r.code === "TIER3_BACKLOG"),
    "TIER3_BACKLOG inferred"
  )
}

section("report build + integrity hash")
{
  const report = buildA1ReadinessReport({
    facts: sparseFacts(),
    period: {
      startIso: "2026-09-01T00:00:00.000Z",
      endIso: "2026-09-30T23:59:59.000Z",
    },
    generatedAt: "2026-10-16T12:00:00.000Z",
  })
  assert(report.reportKind === A1_REPORT_KIND, "reportKind")
  assert(report.schemaVersion === "a1-v1", "schemaVersion")
  assert(report.disclaimer.toLowerCase().includes("not an official"), "disclaimer")
  assert(report.grounding.analysisMode === "deterministic_rules", "no LLM mode")
  const hash1 = computeA1ProposalHash(report)
  const hash2 = computeA1ProposalHash({
    ...report,
    generatedAt: "2099-01-01T00:00:00.000Z",
  })
  assert(hash1 === hash2, "hash ignores generatedAt")
  const tampered = {
    ...report,
    overallStatus:
      report.overallStatus === "not_ready"
        ? ("ready_with_warnings" as const)
        : ("not_ready" as const),
  }
  assert(
    computeA1ProposalHash(tampered) !== hash1,
    "tampered overallStatus changes hash"
  )
}

const PREPARER_ID = "11111111-1111-4111-8111-111111111111"
const APPROVER_ID = "22222222-2222-4222-8222-222222222222"

section("extractA1HandlerGrounding / payload integrity")
{
  const report = buildA1ReadinessReport({
    facts: sparseFacts(),
    period: {
      startIso: "2026-09-01T00:00:00.000Z",
      endIso: "2026-09-30T23:59:59.000Z",
    },
    generatedAt: "2026-10-16T12:00:00.000Z",
  })
  const payload = buildA1InputPayload(report, { preparedByUserId: PREPARER_ID })
  assert(payload.actionType === A1_CBSL_ACTION_TYPE, "payload actionType")
  assert(payload.preparedByUserId === PREPARER_ID, "stores preparedByUserId")
  assert(isA1ReadinessInputPayload(payload), "isA1ReadinessInputPayload")
  const ok = extractA1HandlerGrounding(payload)
  assert(ok.ok, "valid payload grounds")
  const badHash = { ...payload, proposalHash: "0".repeat(64) }
  assert(
    !extractA1HandlerGrounding(badHash).ok,
    "rejects hash mismatch"
  )
  const mutatedReport = {
    ...payload,
    report: { ...(payload.report as object), overallStatus: "ready_with_warnings" },
  }
  assert(
    !extractA1HandlerGrounding(mutatedReport).ok,
    "rejects mutated report vs hash"
  )
  assert(!extractA1HandlerGrounding(null).ok, "rejects null")
  assert(
    !extractA1HandlerGrounding({ ...payload, reportKind: "fake" }).ok,
    "rejects wrong reportKind"
  )
}

section("SoD + prepare-audit approve gate")
{
  const report = buildA1ReadinessReport({
    facts: sparseFacts(),
    period: {
      startIso: "2026-09-01T00:00:00.000Z",
      endIso: "2026-09-30T23:59:59.000Z",
    },
    generatedAt: "2026-10-16T12:00:00.000Z",
  })
  const payload = buildA1InputPayload(report, { preparedByUserId: PREPARER_ID })
  const hash = String(payload.proposalHash)
  const audit = buildA1PrepareAuditDetails({
    actionId: "33333333-3333-4333-8333-333333333333",
    proposalHash: hash,
    preparedByUserId: PREPARER_ID,
    overallStatus: report.overallStatus,
  })
  assert(A1_PREPARE_AUDIT_ACTION === "a1_readiness.prepared", "prepare audit action name")

  const differentOk = evaluateA1ApproveGate({
    inputPayload: payload,
    approverUserId: APPROVER_ID,
    prepareAuditDetails: audit,
  })
  assert(differentOk.ok, "different user may approve")

  const selfDeny = evaluateA1ApproveGate({
    inputPayload: payload,
    approverUserId: PREPARER_ID,
    prepareAuditDetails: audit,
  })
  assert(!selfDeny.ok && selfDeny.httpStatus === 403, "self-approval denied 403")
  assert(
    String(selfDeny.error).toLowerCase().includes("separation"),
    "self-approval mentions SoD"
  )

  const legacy = { ...payload }
  delete legacy.preparedByUserId
  const legacyDeny = evaluateA1ApproveGate({
    inputPayload: legacy,
    approverUserId: APPROVER_ID,
    prepareAuditDetails: audit,
  })
  assert(!legacyDeny.ok && legacyDeny.httpStatus === 409, "legacy missing preparer denied")

  const noAudit = evaluateA1ApproveGate({
    inputPayload: payload,
    approverUserId: APPROVER_ID,
    prepareAuditDetails: null,
  })
  assert(!noAudit.ok && noAudit.httpStatus === 409, "missing prepare audit denied")

  const wrongHashAudit = evaluateA1ApproveGate({
    inputPayload: payload,
    approverUserId: APPROVER_ID,
    prepareAuditDetails: { ...audit, proposalHash: "a".repeat(64) },
  })
  assert(!wrongHashAudit.ok, "audit hash mismatch denied")

  const swappedPayload = {
    ...payload,
    proposalHash: "b".repeat(64),
  }
  // broken self-hash on payload
  const brokenPayload = evaluateA1ApproveGate({
    inputPayload: swappedPayload,
    approverUserId: APPROVER_ID,
    prepareAuditDetails: audit,
  })
  assert(!brokenPayload.ok, "payload self-hash failure denied")
}

async function runHandlerTests() {
  section("handler registration (not stub)")
  clearActionHandlers()
  assert(
    getActionHandler(A1_CBSL_ACTION_TYPE) === defaultStubHandler,
    "cleared registry falls back to stub"
  )
  registerDefaultAgentHandlers()
  assert(hasRegisteredActionHandler(A1_CBSL_ACTION_TYPE), "A1 registered")
  assert(hasRegisteredActionHandler(A2_BUDGET_ACTION_TYPE), "A2 still registered")
  assert(hasRegisteredActionHandler(A4_NLQ_ACTION_TYPE), "A4 still registered")
  assert(
    getActionHandler(A1_CBSL_ACTION_TYPE) === cbslReadinessHandler,
    "A1 handler is cbslReadinessHandler"
  )

  const report = buildA1ReadinessReport({
    facts: sparseFacts(),
    period: {
      startIso: "2026-09-01T00:00:00.000Z",
      endIso: "2026-09-30T23:59:59.000Z",
    },
  })
  const payload = buildA1InputPayload(report, {
    preparedByUserId: PREPARER_ID,
  })
  const exec = await executeActionHandler({
    actionId: "00000000-0000-0000-0000-0000000000a1",
    actionType: A1_CBSL_ACTION_TYPE,
    agentId: "A1",
    agentName: "Compliance",
    tier: 3,
    inputPayload: payload,
  })
  assert(exec.success, "handler succeeds on valid payload")
  const out = exec.outputPayload as Record<string, unknown>
  assert(out.stubExecuted === false, "not stub")
  assert(out.handler === "cbslReadinessHandler", "handler id")
  assert(out.reportKind === A1_REPORT_KIND, "output reportKind")
  assert(out.modelVersion === A1_MODEL_VERSION, "model version")
  assert(out.rulesetVersion === A1_RULESET_VERSION, "ruleset version")

  const fail = await executeActionHandler({
    actionId: "00000000-0000-0000-0000-0000000000a2",
    actionType: A1_CBSL_ACTION_TYPE,
    agentId: "A1",
    agentName: "Compliance",
    tier: 3,
    inputPayload: { ...payload, proposalHash: "deadbeef".repeat(8) },
  })
  assert(!fail.success, "handler fails on bad hash")
  assert(
    String(fail.error).includes("proposalHash"),
    "error mentions proposalHash"
  )
}

section("RBAC prepare roles")
assert(roleMayPrepareA1("admin"), "admin may prepare")
assert(roleMayPrepareA1("executive"), "executive may prepare")
assert(roleMayPrepareA1("branch_manager"), "BM may prepare")
assert(roleMayPrepareA1("finance_officer"), "finance may prepare")
assert(!roleMayPrepareA1("hr_officer"), "hr cannot prepare")
assert(!roleMayPrepareA1("loan_officer"), "loan cannot prepare")
assert(
  A1_PREPARE_ROLES.includes("finance_officer"),
  "A1_PREPARE_ROLES includes finance"
)
assert(
  A1_PREPARE_ROLES.every(
    (r) =>
      hasCapability(r as RoleName, "agents:decide_tier3") ||
      hasCapability(r as RoleName, "finance:manage_ledger")
  ),
  "prepare roles match capability union"
)
assert(
  !hasCapability("finance_officer", "agents:decide_tier3"),
  "SoD: finance prepares but cannot approve Tier 3"
)

section("constants")
assert(A1_CBSL_ACTION_TYPE === "generate_cbsl_report", "policy actionType retained")
assert(A1_REPORT_KIND === "cbsl_readiness_v1", "report kind")

await runHandlerTests()

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
