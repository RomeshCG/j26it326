/**
 * Phase 9a - Graduated Trust Pure Engine Verification Script
 *
 * COMPLETELY DATABASE-FREE:
 * - No Prisma imports, no network access, no DB connection
 * - Tests pure logic in agent-engine-core.ts and agent-defaults.ts
 * - Runs in < 1 second in-process
 */

import {
  validateReason,
  resolveTier,
  nextStatusAfterHandler,
  isValidTransition,
  summarizePayload,
  capDetails,
  computeOverrideRates,
  MAX_DETAILS_BYTES,
  type AgentActionStatus,
} from "../src/lib/agent-engine-core.js"
import { DEFAULT_AGENT_POLICIES } from "../src/lib/agent-defaults.js"
import {
  dispatchAgentAction,
  decideTier3Action,
  overrideAction,
  isValidUuid,
  type TenantPrisma,
} from "../src/lib/agent-engine.js"
import {
  registerActionHandler,
  clearActionHandlers,
} from "../src/lib/agent-handlers.js"
import type { Request, Response } from "express"
import {
  handleListAgentActions,
  handleListPendingActions,
  handleGetOverrideRates,
  handleGetActionById,
  handleApproveAction,
  handleRejectAction,
  handleOverrideAction,
  handleTestDispatchAction,
  ADMIN_ROLES,
  DECIDE_TIER3_ROLES,
  agentGovernanceRouter,
} from "../src/routes/agent-governance.js"
import {
  handleListAgentPolicies,
  handleCreateAgentPolicy,
  handleUpdateAgentPolicy,
  agentPoliciesRouter,
  VIEW_ACTIONS_ROLES as POLICY_VIEW_ROLES,
  MANAGE_POLICIES_ROLES,
} from "../src/routes/agent-policies.js"
import { randomUUID } from "node:crypto"
import { ROLES, type RoleName } from "../src/lib/permissions.js"
import { Prisma } from "../node_modules/.prisma/tenant-client/index.js"
import type {
  AgentTierPolicy,
  AgentAction,
  AuditLog,
} from "../node_modules/.prisma/tenant-client/index.js"

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++
    console.log(`[PASS] Test ${passCount + failCount}: ${testName}`)
  } else {
    failCount++
    console.error(
      `[FAIL] Test ${passCount + failCount}: ${testName} ${detail ? `- ${detail}` : ""}`
    )
  }
}

async function runTests() {
  console.log("==================================================================")
  console.log("Graduated Trust Engine: Pure In-Memory Verification (Database-Free)")
  console.log("==================================================================\n")

  // --------------------------------------------------------------------------
  // Group 1: Default Policies Constant Integrity
  // --------------------------------------------------------------------------
  console.log("--- Group 1: Default Agent Policies ---")
  assert(
    DEFAULT_AGENT_POLICIES.length === 4,
    "DEFAULT_AGENT_POLICIES contains exactly 4 policies"
  )
  assert(
    DEFAULT_AGENT_POLICIES.some(
      (p) => p.actionType === "nlq_query" && p.agentId === "A4" && p.tier === 1
    ),
    "nlq_query mapped to A4 (NLQ) Tier 1"
  )
  assert(
    DEFAULT_AGENT_POLICIES.some(
      (p) =>
        p.actionType === "budget_threshold_alert" &&
        p.agentId === "A2" &&
        p.tier === 2
    ),
    "budget_threshold_alert mapped to A2 (Workflow) Tier 2"
  )
  assert(
    DEFAULT_AGENT_POLICIES.some(
      (p) =>
        p.actionType === "generate_cbsl_report" &&
        p.agentId === "A1" &&
        p.tier === 3
    ),
    "generate_cbsl_report mapped to A1 (Compliance) Tier 3"
  )
  assert(
    DEFAULT_AGENT_POLICIES.some(
      (p) =>
        p.actionType === "volume_spike_alert" &&
        p.agentId === "A3" &&
        p.tier === 4
    ),
    "volume_spike_alert mapped to A3 (Anomaly) Tier 4"
  )

  // --------------------------------------------------------------------------
  // Group 2: Reason Validation (trimmed 10 to 1000 characters)
  // --------------------------------------------------------------------------
  console.log("\n--- Group 2: Reason Validation ---")
  assert(
    !validateReason(null).valid,
    "validateReason rejects null"
  )
  assert(
    !validateReason(12345).valid,
    "validateReason rejects number"
  )
  assert(
    !validateReason("   short   ").valid,
    "validateReason rejects trimmed string < 10 chars"
  )
  assert(
    validateReason("1234567890").valid,
    "validateReason accepts exact 10 char string"
  )
  assert(
    validateReason("   1234567890   ").valid &&
      validateReason("   1234567890   ").trimmed === "1234567890",
    "validateReason trims input whitespace properly"
  )
  const exact1000 = "a".repeat(1000)
  assert(
    validateReason(exact1000).valid,
    "validateReason accepts exact 1000 char string"
  )
  const tooLong1001 = "a".repeat(1001)
  assert(
    !validateReason(tooLong1001).valid,
    "validateReason rejects 1001 char string"
  )

  // --------------------------------------------------------------------------
  // Group 3: Policy Tier Resolution & Fallback
  // --------------------------------------------------------------------------
  console.log("\n--- Group 3: Tier Resolution & Fallback ---")
  assert(
    resolveTier(null).tier === 4 && resolveTier(null).isFallback,
    "resolveTier(null) falls back to Tier 4"
  )
  assert(
    resolveTier(undefined).tier === 4 && resolveTier(undefined).isFallback,
    "resolveTier(undefined) falls back to Tier 4"
  )
  assert(
    resolveTier({ tier: 2, isActive: false }).tier === 4 &&
      resolveTier({ tier: 2, isActive: false }).isFallback,
    "resolveTier with isActive: false falls back to Tier 4"
  )
  assert(
    resolveTier({ tier: 1, isActive: true, agentId: "A4", agentName: "NLQ" }).tier === 1 &&
      !resolveTier({ tier: 1, isActive: true, agentId: "A4", agentName: "NLQ" }).isFallback,
    "resolveTier resolves active Tier 1 correctly"
  )
  assert(
    resolveTier({ tier: 3, isActive: true, agentId: "A1", agentName: "Compliance" }).tier === 3,
    "resolveTier resolves active Tier 3 correctly"
  )
  assert(
    resolveTier({ tier: 99, isActive: true }).tier === 4 &&
      resolveTier({ tier: 99, isActive: true }).isFallback,
    "resolveTier invalid numeric tier falls back to Tier 4"
  )

  // --------------------------------------------------------------------------
  // Group 4: Next Status After Handler Execution
  // --------------------------------------------------------------------------
  console.log("\n--- Group 4: Next Status After Handler ---")
  assert(
    nextStatusAfterHandler(1, true) === "executed",
    "Tier 1 successful handler -> executed"
  )
  assert(
    nextStatusAfterHandler(1, false) === "failed",
    "Tier 1 failed handler -> failed"
  )
  assert(
    nextStatusAfterHandler(2, true) === "notified",
    "Tier 2 successful handler -> notified"
  )
  assert(
    nextStatusAfterHandler(2, false) === "failed",
    "Tier 2 failed handler -> failed"
  )
  assert(
    nextStatusAfterHandler(3, true) === "executed",
    "Tier 3 successful handler -> executed"
  )
  assert(
    nextStatusAfterHandler(3, false) === "failed",
    "Tier 3 failed handler -> failed"
  )

  // --------------------------------------------------------------------------
  // Group 5: State Machine & Transition Rules
  // --------------------------------------------------------------------------
  console.log("\n--- Group 5: State Machine Transitions ---")
  const allStatuses: AgentActionStatus[] = [
    "running",
    "pending_approval",
    "approved",
    "rejected",
    "executed",
    "notified",
    "alert_only",
    "failed",
  ]

  // Valid transitions test
  assert(
    isValidTransition("running", "executed"),
    "running -> executed is valid (Tier 1)"
  )
  assert(
    isValidTransition("running", "notified"),
    "running -> notified is valid (Tier 2)"
  )
  assert(
    isValidTransition("running", "failed"),
    "running -> failed is valid"
  )
  assert(
    isValidTransition("pending_approval", "approved"),
    "pending_approval -> approved is valid (Tier 3 approval)"
  )
  assert(
    isValidTransition("pending_approval", "rejected"),
    "pending_approval -> rejected is valid (Tier 3 rejection)"
  )
  assert(
    isValidTransition("approved", "executed"),
    "approved -> executed is valid (Tier 3 handler ran)"
  )
  assert(
    isValidTransition("approved", "failed"),
    "approved -> failed is valid (Tier 3 handler failed)"
  )

  // Illegal transitions test
  assert(
    !isValidTransition("running", "approved"),
    "running -> approved is ILLEGAL"
  )
  assert(
    !isValidTransition("pending_approval", "executed"),
    "pending_approval -> executed without approval is ILLEGAL"
  )
  assert(
    !isValidTransition("executed", "running"),
    "executed -> running is ILLEGAL (terminal status)"
  )
  assert(
    !isValidTransition("rejected", "approved"),
    "rejected -> approved is ILLEGAL (terminal status)"
  )
  assert(
    !isValidTransition("alert_only", "executed"),
    "alert_only -> executed is ILLEGAL (terminal status)"
  )
  assert(
    !isValidTransition("failed", "executed"),
    "failed -> executed is ILLEGAL (terminal status)"
  )

  // Self transitions
  let anySelfAllowed = false
  for (const s of allStatuses) {
    if (isValidTransition(s, s)) anySelfAllowed = true
  }
  assert(!anySelfAllowed, "No status allows self-transition")

  // Terminal status verification: nothing leaves rejected, executed, notified, alert_only, failed
  const terminals: AgentActionStatus[] = ["rejected", "executed", "notified", "alert_only", "failed"]
  let terminalLeaked = false
  for (const term of terminals) {
    for (const target of allStatuses) {
      if (isValidTransition(term, target)) terminalLeaked = true
    }
  }
  assert(!terminalLeaked, "All terminal statuses permit zero outgoing transitions")

  // --------------------------------------------------------------------------
  // Group 6: Payload Summarization & Hash Stability (PII Protection)
  // --------------------------------------------------------------------------
  console.log("\n--- Group 6: Payload Summarization & PII Safety ---")
  const p1 = { borrowerName: "Kamal Perera", salary: 150000, loanId: "L-100" }
  const p2 = { loanId: "L-100", salary: 150000, borrowerName: "Kamal Perera" } // different key order
  const summary1 = summarizePayload(p1)
  const summary2 = summarizePayload(p2)

  assert(
    summary1.sha256 === summary2.sha256,
    "SHA-256 hash is stable regardless of object key order"
  )
  assert(
    summary1.keys.join(",") === "borrowerName,loanId,salary",
    "Top-level keys are sorted alphabetically"
  )
  const serializedSummary = JSON.stringify(summary1)
  assert(
    !serializedSummary.includes("Kamal Perera") && !serializedSummary.includes("150000"),
    "Payload summary NEVER contains raw sensitive values"
  )
  assert(
    summarizePayload(null).sizeBytes === 0,
    "summarizePayload(null) returns sizeBytes: 0"
  )
  const d1 = new Date("2026-10-13T10:00:00.000Z")
  const d2 = new Date("2026-10-13T12:00:00.000Z")
  assert(
    summarizePayload({ ts: d1 }).sha256 !== summarizePayload({ ts: d2 }).sha256,
    "Two different Dates produce different sha256 values"
  )
  assert(
    summarizePayload({ ts: d1 }).sha256 ===
      summarizePayload({ ts: new Date("2026-10-13T10:00:00.000Z") }).sha256,
    "The same Date always gives the same sha256"
  )
  assert(
    summarizePayload(d1).sha256 ===
      summarizePayload(new Date("2026-10-13T10:00:00.000Z")).sha256,
    "Direct Date serialization gives stable sha256"
  )
  const thirtyKeyPayload: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    thirtyKeyPayload[`key_${i.toString().padStart(2, "0")}`] = i
  }
  const summary30 = summarizePayload(thirtyKeyPayload)
  assert(
    summary30.keys.length === 20 && summary30.keyCount === 30,
    "summarizePayload caps keys array to 20 while recording exact keyCount of 30"
  )

  // --------------------------------------------------------------------------
  // Group 7: Details 64 KB Capping
  // --------------------------------------------------------------------------
  console.log("\n--- Group 7: Details 64 KB Cap ---")
  const smallDetails = { actionId: "123", tier: 1, action: "test" }
  const smallCapped = capDetails(smallDetails)
  assert(
    smallCapped.truncated === undefined && smallCapped.actionId === "123",
    "Small details under 64 KB remain untouched without truncation flag"
  )

  // Create a massive payload > 100 KB with one large field
  const bigDetails: Record<string, any> = {
    actionId: "ACT-BIG-01",
    tier: 3,
    massiveArray: Array.from({ length: 2000 }).map((_, i) => ({
      index: i,
      data: "Sensitive borrower audit data ".repeat(10),
    })),
  }
  const bigBytesBefore = Buffer.byteLength(JSON.stringify(bigDetails), "utf8")
  assert(bigBytesBefore > 100 * 1024, "Test setup generated > 100 KB payload")

  const bigCapped = capDetails(bigDetails)
  const bigBytesAfter = Buffer.byteLength(JSON.stringify(bigCapped), "utf8")
  assert(
    bigBytesAfter <= MAX_DETAILS_BYTES,
    `Capped details size (${bigBytesAfter} B) is <= 64 KB limit (${MAX_DETAILS_BYTES} B)`
  )
  assert(
    bigCapped.truncated === true,
    "Capped details contains truncated: true flag"
  )
  assert(
    typeof bigCapped.massiveArray === "object" && "sha256" in (bigCapped.massiveArray as any),
    "Largest oversized field was replaced with its PayloadSummary"
  )

  // In fieldUnderSummary, the large field is replaced first, the total drops
  // under 64 KB, and the loop stops, so the small field is never visited.
  const fieldUnderSummary = {
    largeField: "x".repeat(70000), // 70 KB -> replaced with summary (~107 B), bringing total under 64 KB
    smallField: "small string value",
  }
  const cappedSelective = capDetails(fieldUnderSummary)
  assert(
    cappedSelective.smallField === "small string value" &&
      typeof cappedSelective.largeField === "object" &&
      "sha256" in (cappedSelective.largeField as any),
    "capDetails stops replacing fields once the total is under 64 KB (small field left untouched)"
  )

  // Test setup with 500 small fields of ~200 B each (> 64 KB total, no single big field)
  const manySmallFields: Record<string, unknown> = {}
  for (let i = 0; i < 500; i++) {
    manySmallFields[`field_${i.toString().padStart(4, "0")}`] = "x".repeat(200)
  }
  const sizeBefore500 = Buffer.byteLength(JSON.stringify(manySmallFields), "utf8")
  assert(
    sizeBefore500 > MAX_DETAILS_BYTES,
    `500 small fields total size (${sizeBefore500} B) exceeds 64 KB`
  )
  const capped500 = capDetails(manySmallFields)
  const sizeAfter500 = Buffer.byteLength(JSON.stringify(capped500), "utf8")
  assert(
    sizeAfter500 <= MAX_DETAILS_BYTES,
    `Capped 500 small fields size (${sizeAfter500} B) is <= 64 KB limit`
  )
  assert(
    capped500.truncated === true,
    "500 small fields result has truncated: true"
  )

  // Test setup where field summaries alone exceed 64 KB, triggering fallback { truncated: true, summary }
  const massiveFieldCount: Record<string, unknown> = {}
  for (let i = 0; i < 1000; i++) {
    massiveFieldCount[`long_descriptive_audit_field_name_number_${i.toString().padStart(4, "0")}`] = "v".repeat(50)
  }
  const cappedMassive = capDetails(massiveFieldCount)
  const sizeAfterMassive = Buffer.byteLength(JSON.stringify(cappedMassive), "utf8")
  const massiveKeys = Object.keys(cappedMassive)
  const branchRan =
    massiveKeys.length === 2 && "truncated" in cappedMassive && "summary" in cappedMassive
      ? "fallback ({truncated, summary})"
      : "selective field replacement"
  console.log(`Massive fields result: ${sizeAfterMassive} B, branch: ${branchRan}`)

  assert(
    sizeAfterMassive <= MAX_DETAILS_BYTES,
    `Capped massive fields size (${sizeAfterMassive} B) is <= 64 KB limit`
  )
  assert(
    massiveKeys.length === 2 &&
      massiveKeys.includes("truncated") &&
      massiveKeys.includes("summary"),
    "Massive fields result has no field except truncated and summary"
  )
  assert(
    sizeAfterMassive < 2048,
    `Massive fields fallback result is under 2 KB (got ${sizeAfterMassive} B)`
  )

  // Check: capDetails never returns something bigger than its input (compare byte sizes)
  const allCases = [
    { name: "small details", input: smallDetails, output: smallCapped },
    { name: "big details", input: bigDetails, output: bigCapped },
    { name: "selective field replacement", input: fieldUnderSummary, output: cappedSelective },
    { name: "500 small fields", input: manySmallFields, output: capped500 },
    { name: "massive fields", input: massiveFieldCount, output: cappedMassive },
  ]
  const neverBigger = allCases.every((c) => {
    const inSize = Buffer.byteLength(JSON.stringify(c.input), "utf8")
    const outSize = Buffer.byteLength(JSON.stringify(c.output), "utf8")
    return outSize <= inSize
  })
  assert(
    neverBigger,
    "capDetails never returns something bigger than its input (byte size comparison)"
  )

  // --------------------------------------------------------------------------
  // Group 8: Override & Approval Rate Calculations
  // --------------------------------------------------------------------------
  console.log("\n--- Group 8: Rate Calculations & Zero Protection ---")

  // Test zero rows
  const zeroMetrics = computeOverrideRates([])
  assert(
    zeroMetrics.totalActions === 0 &&
      zeroMetrics.overallOverrideRate === 0 &&
      zeroMetrics.tiers.tier3.approvalRate === 0,
    "computeOverrideRates on empty rows returns 0 without division by zero errors"
  )

  // Mixed dataset
  const testRows = [
    // Tier 1: 4 actions, 1 override
    { tier: 1, agentId: "A4", status: "executed", isOverride: false },
    { tier: 1, agentId: "A4", status: "executed", isOverride: false },
    { tier: 1, agentId: "A4", status: "executed", isOverride: false },
    { tier: 1, agentId: "A4", status: "executed", isOverride: true },
    // Tier 2: 2 actions, 0 override
    { tier: 2, agentId: "A2", status: "notified", isOverride: false },
    { tier: 2, agentId: "A2", status: "notified", isOverride: false },
    // Tier 3: 5 actions: 3 approved (2 executed, 1 failed), 1 rejected, 1 still pending
    { tier: 3, agentId: "A1", status: "executed", isOverride: false }, // approved & executed
    { tier: 3, agentId: "A1", status: "executed", isOverride: false }, // approved & executed
    { tier: 3, agentId: "A1", status: "failed", isOverride: false },   // approved but handler failed
    { tier: 3, agentId: "A1", status: "rejected", isOverride: true },   // rejected (override)
    { tier: 3, agentId: "A1", status: "pending_approval", isOverride: false }, // not decided yet
    // Tier 4: 1 action
    { tier: 4, agentId: "A3", status: "alert_only", isOverride: false },
  ]

  const metrics = computeOverrideRates(testRows, "2026-09-13T00:00:00Z", "2026-10-13T00:00:00Z")

  // Overall: 12 total, 2 overridden (1 in Tier 1, 1 in Tier 3)
  assert(metrics.totalActions === 12, "Total actions is 12")
  assert(metrics.totalOverridden === 2, "Total overridden is 2")
  assert(metrics.overallOverrideRate === 16.67, `Overall override rate is 16.67% (got ${metrics.overallOverrideRate}%)`)

  // Tier 1: 4 total, 1 override -> 25.0%
  assert(
    metrics.tiers.tier1.total === 4 &&
      metrics.tiers.tier1.overridden === 1 &&
      metrics.tiers.tier1.overrideRate === 25.0,
    "Tier 1 override rate is 25.0%"
  )

  // Tier 2: 2 total, 0 override -> 0.0%
  assert(
    metrics.tiers.tier2.total === 2 &&
      metrics.tiers.tier2.overridden === 0 &&
      metrics.tiers.tier2.overrideRate === 0.0,
    "Tier 2 override rate is 0.0%"
  )

  // Tier 3: 5 total. Decided = 4 (3 approved/executed/failed + 1 rejected). Approved = 3.
  // Approval rate = 3 / 4 = 75.0%
  // Override rate = 1 / 4 = 25.0% (rejected / decided)
  assert(
    metrics.tiers.tier3.decided === 4 &&
      metrics.tiers.tier3.approved === 3 &&
      metrics.tiers.tier3.rejected === 1 &&
      metrics.tiers.tier3.approvalRate === 75.0,
    "Tier 3 approval rate is 75.0% (3 approved / 4 decided, excluding pending)"
  )
  assert(
    metrics.tiers.tier3.overrideRate === 25.0,
    "Tier 3 override rate is 25.0% (1 rejected / 4 decided)"
  )
  assert(
    metrics.tiers.tier3.approvalRate! + metrics.tiers.tier3.overrideRate === 100.0,
    "For Tier 3, approvalRate + overrideRate equals 100 whenever decided > 0"
  )

  // Agent breakdowns
  assert(metrics.byAgent["A4"].total === 4 && metrics.byAgent["A4"].overridden === 1, "Agent A4 counts accurate")
  assert(metrics.byAgent["A2"].total === 2 && metrics.byAgent["A2"].overridden === 0, "Agent A2 counts accurate")
  assert(metrics.byAgent["A1"].total === 5 && metrics.byAgent["A1"].overridden === 1, "Agent A1 counts accurate")
  assert(metrics.byAgent["A3"].total === 1 && metrics.byAgent["A3"].overridden === 0, "Agent A3 counts accurate")

  // --------------------------------------------------------------------------
  // Group 9: In-Memory Fake Prisma & Engine Integration (Database-Free)
  // --------------------------------------------------------------------------
  console.log("\n--- Group 9: Engine with In-Memory Fake Prisma ---")

  const AUDIT_LOG_COLUMNS = new Set<string>(
    Object.values(Prisma.AuditLogScalarFieldEnum)
  )

  const AGENT_ACTION_COLUMNS = new Set<string>(
    Object.values(Prisma.AgentActionScalarFieldEnum)
  )

  const AGENT_TIER_POLICY_COLUMNS = new Set<string>(
    Object.values(Prisma.AgentTierPolicyScalarFieldEnum)
  )

  interface FakePrismaExtensions {
    _getActions: () => AgentAction[]
    _getAuditLogs: () => AuditLog[]
    _getPolicies: () => AgentTierPolicy[]
    _setPolicy: (actionType: string, policy: Partial<AgentTierPolicy>) => void
  }

  function createFakeTenantPrisma(
    initialPolicies = DEFAULT_AGENT_POLICIES
  ): TenantPrisma & FakePrismaExtensions {
    const policies = new Map<string, AgentTierPolicy>()
    for (const p of initialPolicies) {
      const id = randomUUID()
      policies.set(p.actionType, {
        id,
        actionType: p.actionType,
        agentId: p.agentId,
        agentName: p.agentName,
        tier: p.tier,
        description: p.description,
        isActive: p.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as AgentTierPolicy)
    }

    const actions: AgentAction[] = []
    const auditLogs: AuditLog[] = []

    const fakePrisma: TenantPrisma & FakePrismaExtensions = {
      agentTierPolicy: {
        findUnique: async ({ where }: { where: Prisma.AgentTierPolicyWhereUniqueInput }) => {
          if (where.actionType) return policies.get(where.actionType) ?? null
          if (where.id) {
            for (const p of policies.values()) {
              if (p.id === where.id) return p
            }
          }
          return null
        },
        findMany: async (args?: any) => {
          let list = Array.from(policies.values())
          if (args?.orderBy?.actionType === "asc") {
            list.sort((a, b) => a.actionType.localeCompare(b.actionType))
          }
          return list
        },
        create: async ({ data }: { data: Prisma.AgentTierPolicyUncheckedCreateInput }) => {
          for (const key of Object.keys(data)) {
            if (!AGENT_TIER_POLICY_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentTierPolicy.create`)
            }
          }
          if (policies.has(data.actionType)) {
            const err: any = new Error(`Unique constraint failed on the fields: (actionType)`)
            err.code = "P2002"
            throw err
          }
          const row: AgentTierPolicy = {
            id: data.id ?? randomUUID(),
            actionType: data.actionType,
            agentId: data.agentId,
            agentName: data.agentName,
            tier: data.tier,
            description: data.description ?? null,
            isActive: data.isActive ?? true,
            createdAt: new Date(),
            updatedAt: new Date(),
          }
          policies.set(data.actionType, row)
          return row
        },
        createMany: async ({ data }: { data: Prisma.AgentTierPolicyCreateManyInput[] }) => {
          const arr = Array.isArray(data) ? data : [data]
          for (const item of arr) {
            for (const key of Object.keys(item)) {
              if (!AGENT_TIER_POLICY_COLUMNS.has(key)) {
                throw new Error(`FakePrisma error: Unknown field '${key}' in agentTierPolicy.createMany`)
              }
            }
            const row: AgentTierPolicy = {
              id: item.id ?? randomUUID(),
              actionType: item.actionType,
              agentId: item.agentId,
              agentName: item.agentName,
              tier: item.tier,
              description: item.description ?? null,
              isActive: item.isActive ?? true,
              createdAt: new Date(),
              updatedAt: new Date(),
            }
            policies.set(item.actionType, row)
          }
          return { count: arr.length }
        },
        update: async ({
          where,
          data,
        }: {
          where: Prisma.AgentTierPolicyWhereUniqueInput
          data: Prisma.AgentTierPolicyUpdateInput
        }) => {
          for (const key of Object.keys(data)) {
            if (!AGENT_TIER_POLICY_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentTierPolicy.update`)
            }
          }
          let existing: AgentTierPolicy | null = null
          for (const p of policies.values()) {
            if (p.id === where.id) {
              existing = p
              break
            }
          }
          if (!existing) {
            throw new Error(`Record to update not found: ${where.id}`)
          }
          const updated: AgentTierPolicy = {
            ...existing,
            ...(data as any),
            updatedAt: new Date(),
          }
          policies.set(existing.actionType, updated)
          return updated
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Prisma.AgentTierPolicyWhereInput
          data: Prisma.AgentTierPolicyUpdateManyMutationInput
        }) => {
          for (const key of Object.keys(data)) {
            if (!AGENT_TIER_POLICY_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentTierPolicy.updateMany data`)
            }
          }
          let count = 0
          for (const [key, p] of policies.entries()) {
            if (where.id && p.id !== where.id) continue
            if (where.tier !== undefined && p.tier !== where.tier) continue
            if (where.actionType !== undefined && p.actionType !== where.actionType) continue
            const updated: AgentTierPolicy = {
              ...p,
              ...(data as any),
              updatedAt: new Date(),
            }
            policies.set(key, updated)
            count++
          }
          return { count }
        },
      },
      agentAction: {
        create: async ({ data }: { data: Prisma.AgentActionUncheckedCreateInput }) => {
          for (const key of Object.keys(data)) {
            if (!AGENT_ACTION_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentAction.create`)
            }
          }
          const row: AgentAction = {
            id: data.id ?? `act-${actions.length + 1}`,
            policyId: data.policyId ?? null,
            agentId: data.agentId ?? null,
            agentName: data.agentName,
            tier: data.tier,
            action: data.action,
            reason: data.reason ?? null,
            confidence: (data.confidence as any) ?? null,
            modelVersion: data.modelVersion ?? null,
            promptVersion: data.promptVersion ?? null,
            toolsUsed: (data.toolsUsed as any) ?? null,
            inputPayload: (data.inputPayload as any) ?? null,
            outputPayload: (data.outputPayload as any) ?? null,
            status: data.status,
            isOverride: data.isOverride ?? false,
            decisionReason: data.decisionReason ?? null,
            approvedBy: data.approvedBy ?? null,
            decidedAt: data.decidedAt ? new Date(data.decidedAt as any) : null,
            processingTimeMs: data.processingTimeMs ?? null,
            createdAt: new Date(),
          }
          actions.push(row)
          return row
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: Prisma.AgentActionWhereInput
          data: Prisma.AgentActionUpdateManyMutationInput
        }) => {
          for (const key of Object.keys(data)) {
            if (!AGENT_ACTION_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentAction.updateMany data`)
            }
          }
          for (const key of Object.keys(where)) {
            if (!AGENT_ACTION_COLUMNS.has(key) && key !== "AND" && key !== "OR" && key !== "NOT") {
              throw new Error(`FakePrisma error: Unknown field '${key}' in agentAction.updateMany where`)
            }
          }
          let count = 0
          for (let i = 0; i < actions.length; i++) {
            const a = actions[i]
            if (where.id && a.id !== where.id) continue
            if (where.tier !== undefined) {
              if (where.tier && typeof where.tier === "object" && "in" in where.tier && (where.tier as any).in) {
                if (!(where.tier as any).in.includes(a.tier)) continue
              } else if (typeof where.tier === "number" && a.tier !== where.tier) {
                continue
              }
            }
            if (where.status !== undefined) {
              if (where.status && typeof where.status === "object" && "in" in where.status && (where.status as any).in) {
                if (!(where.status as any).in.includes(a.status)) continue
              } else if (typeof where.status === "string" && a.status !== where.status) {
                continue
              }
            }
            if (where.decidedAt === null && a.decidedAt != null) continue
            if (where.isOverride !== undefined && a.isOverride !== where.isOverride) continue

            actions[i] = {
              ...actions[i],
              ...(data as any),
              decidedAt: data.decidedAt ? new Date(data.decidedAt as any) : actions[i].decidedAt,
            }
            count++
          }
          return { count }
        },
        findUnique: async ({ where }: { where: Prisma.AgentActionWhereUniqueInput }) => {
          if (!where.id) return null
          return actions.find((a) => a.id === where.id) ?? null
        },
        findMany: async (args?: any) => {
          let result = [...actions]
          if (args?.where) {
            const w = args.where
            if (w.tier !== undefined) {
              result = result.filter((a) => a.tier === w.tier)
            }
            if (w.status !== undefined) {
              result = result.filter((a) => a.status === w.status)
            }
            if (w.agentId !== undefined) {
              result = result.filter((a) => a.agentId === w.agentId)
            }
            if (w.createdAt) {
              if (w.createdAt.gte) {
                result = result.filter((a) => a.createdAt >= w.createdAt.gte)
              }
              if (w.createdAt.lte) {
                result = result.filter((a) => a.createdAt <= w.createdAt.lte)
              }
            }
          }
          if (args?.orderBy?.createdAt === "desc") {
            result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          } else if (args?.orderBy?.createdAt === "asc") {
            result.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          }
          if (args?.skip !== undefined) {
            result = result.slice(args.skip)
          }
          if (args?.take !== undefined) {
            result = result.slice(0, args.take)
          }
          if (args?.select) {
            return result.map((row) => {
              const projected: Record<string, unknown> = {}
              for (const key of Object.keys(args.select)) {
                if (args.select[key]) {
                  projected[key] = (row as any)[key]
                }
              }
              return projected
            }) as any
          }
          return result as any
        },
      },
      auditLog: {
        create: async ({ data }: { data: Prisma.AuditLogUncheckedCreateInput }) => {
          for (const key of Object.keys(data)) {
            if (!AUDIT_LOG_COLUMNS.has(key)) {
              throw new Error(`FakePrisma error: Unknown field '${key}' in auditLog.create`)
            }
          }
          const row: AuditLog = {
            id: data.id ?? `audit-${auditLogs.length + 1}`,
            actorType: data.actorType,
            actorId: data.actorId ?? null,
            action: data.action,
            resource: data.resource ?? null,
            details: (data.details as any) ?? null,
            ipAddress: data.ipAddress ?? null,
            userAgent: data.userAgent ?? null,
            createdAt: new Date(),
          }
          auditLogs.push(row)
          return row
        },
      },
      $transaction: (async (fnOrArray: any) => {
        if (typeof fnOrArray === "function") {
          return fnOrArray(fakePrisma)
        }
        return Promise.all(fnOrArray)
      }) as unknown as TenantPrisma["$transaction"],
      _getActions: () => actions,
      _getAuditLogs: () => auditLogs,
      _getPolicies: () => Array.from(policies.values()),
      _setPolicy: (actionType: string, policy: Partial<AgentTierPolicy>) => {
        const existing = policies.get(actionType)
        policies.set(actionType, { id: existing?.id ?? randomUUID(), actionType, ...policy } as AgentTierPolicy)
      },
    }

    return fakePrisma
  }

  const fakePrisma = createFakeTenantPrisma()
  const validUserId = "550e8400-e29b-41d4-a716-446655440000"

  // 0. Strict fake check: reject unknown field actorEmail on auditLog.create
  let fakeRejectedActorEmail = false
  try {
    await fakePrisma.auditLog.create({
      data: {
        actorType: "user",
        actorId: validUserId,
        action: "test.action",
        actorEmail: "test@example.com",
      } as any,
    })
  } catch (err: any) {
    if (err.message.includes("actorEmail")) {
      fakeRejectedActorEmail = true
    }
  }
  assert(fakeRejectedActorEmail, "Fake prisma strictly rejects unknown field actorEmail on auditLog.create")

  // 1. Tier 1 flow: status executed, exactly 2 audit entries (running + executed)
  const resT1 = await dispatchAgentAction(fakePrisma, {
    actionType: "nlq_query",
    action: "Run NLQ analytics query",
    reason: "User requested weekly portfolio breakdown",
  })
  assert(
    resT1.status === "ok" && resT1.actionStatus === "executed" && resT1.tier === 1,
    "Tier 1 dispatch produces executed status and tier 1"
  )
  const t1Logs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resT1.actionId)
  assert(
    t1Logs.length === 2 &&
      t1Logs[0].action === "agent_action.running" &&
      t1Logs[1].action === "agent_action.executed",
    "Tier 1 writes exactly 2 audit entries (running + executed)"
  )

  // 2. Tier 2 flow: status notified, exactly 2 audit entries (running + notified)
  const resT2 = await dispatchAgentAction(fakePrisma, {
    actionType: "budget_threshold_alert",
    action: "Send budget threshold email alert",
  })
  assert(
    resT2.status === "ok" && resT2.actionStatus === "notified" && resT2.tier === 2,
    "Tier 2 dispatch produces notified status and tier 2"
  )
  const t2Logs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resT2.actionId)
  assert(
    t2Logs.length === 2 &&
      t2Logs[0].action === "agent_action.running" &&
      t2Logs[1].action === "agent_action.notified",
    "Tier 2 writes exactly 2 audit entries (running + notified)"
  )

  // 3. Tier 3 flow: status pending_approval, exactly 1 audit entry
  const resT3 = await dispatchAgentAction(fakePrisma, {
    actionType: "generate_cbsl_report",
    action: "Generate CBSL regulatory report",
  })
  assert(
    resT3.status === "ok" && resT3.actionStatus === "pending_approval" && resT3.tier === 3,
    "Tier 3 dispatch produces pending_approval status and tier 3"
  )
  const t3Logs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resT3.actionId)
  assert(
    t3Logs.length === 1 && t3Logs[0].action === "agent_action.pending_approval",
    "Tier 3 dispatch writes exactly 1 audit entry (pending_approval)"
  )

  // 4. Tier 4 flow: status alert_only, exactly 1 audit entry
  const resT4 = await dispatchAgentAction(fakePrisma, {
    actionType: "volume_spike_alert",
    action: "Log anomaly spike alert",
  })
  assert(
    resT4.status === "ok" && resT4.actionStatus === "alert_only" && resT4.tier === 4,
    "Tier 4 dispatch produces alert_only status and tier 4"
  )
  const t4Logs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resT4.actionId)
  assert(
    t4Logs.length === 1 && t4Logs[0].action === "agent_action.alert_only",
    "Tier 4 dispatch writes exactly 1 audit entry (alert_only)"
  )

  // 5. Tier cannot be set by caller; unknown action -> Tier 4 alert_only with fallback reason
  const resUnknown = await dispatchAgentAction(fakePrisma, {
    actionType: "non_existent_action_type",
    action: "Attempt unauthorized high privilege action",
    agentName: "CallerProvidedAgent",
    ...({ tier: 1 } as any), // caller attempts to forge tier 1
  })
  assert(
    resUnknown.status === "ok" &&
      resUnknown.tier === 4 &&
      resUnknown.isFallback === true &&
      resUnknown.actionStatus === "alert_only",
    "Unknown actionType safely falls back to Tier 4 alert_only (caller cannot forge tier)"
  )

  // 6. Inactive action -> Tier 4 alert_only with fallback reason
  fakePrisma._setPolicy("inactive_workflow", {
    actionType: "inactive_workflow",
    agentId: "A2",
    agentName: "Workflow",
    tier: 2,
    isActive: false,
  })
  const resInactive = await dispatchAgentAction(fakePrisma, {
    actionType: "inactive_workflow",
    action: "Trigger inactive workflow action",
  })
  assert(
    resInactive.status === "ok" &&
      resInactive.tier === 4 &&
      resInactive.isFallback === true &&
      resInactive.actionStatus === "alert_only",
    "Inactive policy safely falls back to Tier 4 alert_only with fallback reason"
  )

  // 7. Agent Name preference: active policy enforces policy.agentName even if caller sends another name
  const resActiveAgentName = await dispatchAgentAction(fakePrisma, {
    actionType: "nlq_query",
    action: "Run query with spoofed agent name",
    agentName: "ImpostorAgentName",
  })
  const activeRow = fakePrisma._getActions().find((a) => a.id === resActiveAgentName.actionId)
  assert(
    activeRow?.agentName === "NLQ" && activeRow?.agentId === "A4",
    "Active policy enforces policy agentName/agentId over caller-provided values"
  )

  // 7b. NLQ identity hardening: caller-supplied A4/NLQ survives Tier-4 fallback
  const emptyPolicyPrisma = createFakeTenantPrisma([])
  const resNlqMissingPolicy = await dispatchAgentAction(emptyPolicyPrisma, {
    actionType: "nlq_query",
    action: "A4 NLQ (count_actions_window): identity fallback probe",
    agentId: "A4",
    agentName: "NLQ",
  })
  const missingRow = emptyPolicyPrisma
    ._getActions()
    .find((a) => a.id === resNlqMissingPolicy.actionId)
  assert(
    resNlqMissingPolicy.status === "ok" &&
      resNlqMissingPolicy.tier === 4 &&
      resNlqMissingPolicy.isFallback === true &&
      resNlqMissingPolicy.actionStatus === "alert_only",
    "Missing nlq_query policy still falls back to Tier 4 alert_only"
  )
  assert(
    missingRow?.agentId === "A4" && missingRow?.agentName === "NLQ",
    "Missing nlq_query policy keeps caller A4/NLQ identity (not Unknown)"
  )

  const inactiveNlqPrisma = createFakeTenantPrisma([])
  inactiveNlqPrisma._setPolicy("nlq_query", {
    actionType: "nlq_query",
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    isActive: false,
  })
  const resNlqInactive = await dispatchAgentAction(inactiveNlqPrisma, {
    actionType: "nlq_query",
    action: "A4 NLQ inactive-policy probe",
    agentId: "A4",
    agentName: "NLQ",
  })
  const inactiveRow = inactiveNlqPrisma
    ._getActions()
    .find((a) => a.id === resNlqInactive.actionId)
  assert(
    resNlqInactive.status === "ok" &&
      resNlqInactive.tier === 4 &&
      resNlqInactive.isFallback === true &&
      resNlqInactive.actionStatus === "alert_only",
    "Inactive nlq_query policy still falls back to Tier 4 alert_only"
  )
  assert(
    inactiveRow?.agentId === "A4" && inactiveRow?.agentName === "NLQ",
    "Inactive nlq_query policy keeps caller A4/NLQ identity (not Unknown)"
  )

  const activeNlqPrisma = createFakeTenantPrisma(
    DEFAULT_AGENT_POLICIES.filter((p) => p.actionType === "nlq_query")
  )
  const resNlqActive = await dispatchAgentAction(activeNlqPrisma, {
    actionType: "nlq_query",
    action: "A4 NLQ active-policy probe",
    agentId: "A4",
    agentName: "NLQ",
  })
  const activeNlqRow = activeNlqPrisma
    ._getActions()
    .find((a) => a.id === resNlqActive.actionId)
  assert(
    resNlqActive.status === "ok" &&
      resNlqActive.tier === 1 &&
      resNlqActive.isFallback === false,
    "Active nlq_query default policy dispatches at Tier 1"
  )
  assert(
    activeNlqRow?.agentId === "A4" && activeNlqRow?.agentName === "NLQ",
    "Active nlq_query policy records A4/NLQ identity"
  )

  // 8. Handler throwing -> status failed AND audit entry written
  registerActionHandler("crashing_nlq_query", () => {
    throw new Error("Simulated database timeout inside handler execution")
  })
  fakePrisma._setPolicy("crashing_nlq_query", {
    actionType: "crashing_nlq_query",
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    isActive: true,
  })
  const resCrash = await dispatchAgentAction(fakePrisma, {
    actionType: "crashing_nlq_query",
    action: "Run crashing query",
  })
  assert(
    resCrash.status === "ok" && resCrash.actionStatus === "failed",
    "Handler exception updates action status to failed"
  )
  const crashLogs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resCrash.actionId)
  assert(
    crashLogs.length === 2 &&
      crashLogs[1].action === "agent_action.failed" &&
      crashLogs[1].details?.error?.includes("Simulated database timeout"),
    "Failure audit entry is written containing truncated error message"
  )

  // 9. Tier 3 approve workflow: commits approved, runs handler, updates to executed
  const resApprove = await decideTier3Action(fakePrisma, {
    actionId: resT3.actionId,
    decision: "approve",
    reason: "Approved by compliance manager after review",
    userId: validUserId,
  })
  assert(
    resApprove.status === "ok" &&
      resApprove.decision === "approve" &&
      resApprove.actionStatus === "executed",
    "Tier 3 approve succeeds and executes action"
  )

  // 10. Double approve -> second call returns conflict, no extra audit entry
  const auditCountBeforeDouble = fakePrisma._getAuditLogs().length
  const resDoubleApprove = await decideTier3Action(fakePrisma, {
    actionId: resT3.actionId,
    decision: "approve",
    reason: "Duplicate approval attempt",
    userId: validUserId,
  })
  assert(
    resDoubleApprove.status === "conflict",
    "Double approve on already decided action returns conflict"
  )
  assert(
    fakePrisma._getAuditLogs().length === auditCountBeforeDouble,
    "Conflict on double approve writes no extra audit entry"
  )

  // 11. Tier 3 reject: rejects invalid reason (< 10 chars)
  const resT3RejectTarget = await dispatchAgentAction(fakePrisma, {
    actionType: "generate_cbsl_report",
    action: "Second CBSL report for rejection test",
  })
  const resRejectInvalid = await decideTier3Action(fakePrisma, {
    actionId: resT3RejectTarget.actionId,
    decision: "reject",
    reason: "short",
    userId: validUserId,
  })
  assert(
    resRejectInvalid.status === "invalid" && "error" in resRejectInvalid,
    "Reject requires valid reason (rejects strings < 10 characters)"
  )

  // 12. Tier 3 reject: valid reason sets status rejected, isOverride true, and runs no handler
  const resRejectOk = await decideTier3Action(fakePrisma, {
    actionId: resT3RejectTarget.actionId,
    decision: "reject",
    reason: "Rejected due to missing regulatory annex documents",
    userId: validUserId,
  })
  assert(
    resRejectOk.status === "ok" &&
      resRejectOk.decision === "reject" &&
      resRejectOk.actionStatus === "rejected",
    "Tier 3 reject succeeds with valid reason"
  )
  const rejectedActionRow = fakePrisma._getActions().find((a: any) => a.id === resT3RejectTarget.actionId)
  assert(
    rejectedActionRow?.status === "rejected" && rejectedActionRow?.isOverride === true,
    "Rejected action has status rejected and isOverride true"
  )
  assert(
    rejectedActionRow?.decisionReason ===
      "Rejected due to missing regulatory annex documents",
    "Rejected action stores decisionReason for Agent Log display"
  )

  // 13. Approve after reject is refused (conflict)
  const resApproveAfterReject = await decideTier3Action(fakePrisma, {
    actionId: resT3RejectTarget.actionId,
    decision: "approve",
    reason: "Attempting to approve an action that was already rejected",
    userId: validUserId,
  })
  assert(
    resApproveAfterReject.status === "conflict",
    "Approve after reject is refused with conflict"
  )

  // 14. Test 93 & Test 13: Action text differs from actionType, handler verifies row is approved + decidedAt is set
  let handlerSawApproved = false
  let handlerSawDecidedAt = false
  registerActionHandler("timed_cbsl_action", async (ctx) => {
    const row = await fakePrisma.agentAction.findUnique({
      where: { id: ctx.actionId },
    })
    if (row && row.status === "approved") {
      handlerSawApproved = true
    }
    if (row && row.decidedAt instanceof Date) {
      handlerSawDecidedAt = true
    }
    return { outputPayload: { reportId: "CBSL-2026-Q3" } }
  })
  fakePrisma._setPolicy("timed_cbsl_action", {
    actionType: "timed_cbsl_action",
    agentId: "A1",
    agentName: "Compliance",
    tier: 3,
    isActive: true,
  })
  const resTimedT3 = await dispatchAgentAction(fakePrisma, {
    actionType: "timed_cbsl_action",
    action: "Quarterly CBSL regulatory generation request #2026-Q3", // differs from actionType
  })
  await decideTier3Action(fakePrisma, {
    actionId: resTimedT3.actionId,
    decision: "approve",
    reason: "Approved by authorized chief risk officer",
    userId: validUserId,
  })
  assert(
    handlerSawApproved && handlerSawDecidedAt,
    "Tier 3 handler executes when row status is approved and decidedAt is set (Point 6)"
  )
  const approvedTimedRow = fakePrisma._getActions().find((a: any) => a.id === resTimedT3.actionId)
  assert(
    approvedTimedRow?.decisionReason ===
      "Approved by authorized chief risk officer",
    "Approved Tier 3 action keeps decisionReason after handler result update"
  )

  // 15. Tier 3 unresolvable policy: fails safely with short error, writes audit entry, runs no handler
  const orphanActionId = "990e8400-e29b-41d4-a716-446655440099"
  await fakePrisma.agentAction.create({
    data: {
      id: orphanActionId,
      policyId: "pol-missing-policy",
      agentId: "A1",
      agentName: "Compliance",
      tier: 3,
      action: "Orphan action with missing policy",
      status: "pending_approval",
    },
  })
  const resUnresolvable = await decideTier3Action(fakePrisma, {
    actionId: orphanActionId,
    decision: "approve",
    reason: "Approve action whose policy is missing",
    userId: validUserId,
  })
  assert(
    resUnresolvable.status === "ok" &&
      resUnresolvable.actionStatus === "failed" &&
      resUnresolvable.error === "action type could not be resolved",
    "Unresolvable policy marks action as failed without running any handler"
  )
  const orphanRow = fakePrisma._getActions().find((a) => a.id === orphanActionId)
  assert(
    orphanRow?.status === "failed",
    "Orphan action row is marked failed in database"
  )

  // 16. Guarded result update conflict test: Tier 1 concurrent status tamper
  registerActionHandler("tampered_t1_action", async (ctx) => {
    // Concurrently change status so updateMany where { id, status: "running" } matches 0 rows
    await fakePrisma.agentAction.updateMany({
      where: { id: ctx.actionId },
      data: { status: "failed" },
    })
    return { outputPayload: { done: true } }
  })
  fakePrisma._setPolicy("tampered_t1_action", {
    actionType: "tampered_t1_action",
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    isActive: true,
  })
  const resTamperedT1 = await dispatchAgentAction(fakePrisma, {
    actionType: "tampered_t1_action",
    action: "Tampered T1 action",
  })
  assert(
    resTamperedT1.status === "conflict",
    "Guarded updateMany on Tier 1 returns conflict if row status was modified concurrently"
  )

  // 17. Guarded result update conflict test: Tier 3 concurrent status tamper
  registerActionHandler("tampered_t3_action", async (ctx) => {
    // Concurrently change status so updateMany where { id, status: "approved" } matches 0 rows
    await fakePrisma.agentAction.updateMany({
      where: { id: ctx.actionId },
      data: { status: "failed" },
    })
    return { outputPayload: { done: true } }
  })
  fakePrisma._setPolicy("tampered_t3_action", {
    actionType: "tampered_t3_action",
    agentId: "A1",
    agentName: "Compliance",
    tier: 3,
    isActive: true,
  })
  const resTamperedT3 = await dispatchAgentAction(fakePrisma, {
    actionType: "tampered_t3_action",
    action: "Tampered T3 action",
  })
  const resTamperedT3Decision = await decideTier3Action(fakePrisma, {
    actionId: resTamperedT3.actionId,
    decision: "approve",
    reason: "Approve action that will experience concurrent status change",
    userId: validUserId,
  })
  assert(
    resTamperedT3Decision.status === "conflict",
    "Guarded updateMany on Tier 3 returns conflict if row status was modified concurrently"
  )

  // 18. Override works once on Tier 1 executed action, second attempt conflicts
  const resOv1 = await overrideAction(fakePrisma, {
    actionId: resT1.actionId,
    reason: "Auditor manual override due to obsolete reference table",
    userId: validUserId,
  })
  assert(resOv1.status === "ok", "Override succeeds on executed Tier 1 action")
  const ovRow1 = fakePrisma._getActions().find((a: any) => a.id === resT1.actionId)
  assert(ovRow1?.isOverride === true, "Action row is marked isOverride: true")

  const resOvDuplicate = await overrideAction(fakePrisma, {
    actionId: resT1.actionId,
    reason: "Duplicate override attempt by another auditor",
    userId: validUserId,
  })
  assert(
    resOvDuplicate.status === "conflict",
    "Second override on already overridden action returns conflict"
  )

  // 19. Tier 3 cannot use the override route (only Tier 1 or 2 permitted)
  const resOvTier3 = await overrideAction(fakePrisma, {
    actionId: resT3.actionId,
    reason: "Attempting to call override route on Tier 3 action",
    userId: validUserId,
  })
  assert(
    resOvTier3.status === "conflict",
    "Tier 3 actions cannot use the override route (conflict returned)"
  )

  // 20. Audit details NEVER contain raw payload values (PII safety with fake salary)
  const sensitivePayload = {
    borrowerName: "Sunil Shantha",
    fakeSalaryLKR: 875000,
    nationalId: "198823400123",
  }
  const resSensitive = await dispatchAgentAction(fakePrisma, {
    actionType: "nlq_query",
    action: "Lookup borrower risk profile",
    inputPayload: sensitivePayload,
  })
  const sensitiveAuditLogs = fakePrisma._getAuditLogs().filter((l: any) => l.details?.actionId === resSensitive.actionId)
  const serializedAudit = JSON.stringify(sensitiveAuditLogs.map((l: any) => l.details))
  assert(
    !serializedAudit.includes("Sunil Shantha") &&
      !serializedAudit.includes("875000") &&
      !serializedAudit.includes("198823400123"),
    "Audit log details NEVER contain raw payload values (PII protected)"
  )
  assert(
    sensitiveAuditLogs[0].details?.inputSummary?.sha256 !== undefined &&
      sensitiveAuditLogs[0].details?.inputSummary?.keys.includes("fakeSalaryLKR"),
    "Audit log details store safe inputSummary with SHA-256 and key names only"
  )

  // 21. Agent audit entries have actorId null and agentId stored in details
  const agentLogs = fakePrisma._getAuditLogs().filter((l: any) => l.actorType === "agent")
  const allAgentsValid = agentLogs.every(
    (l: any) => l.actorId === null && "agentId" in (l.details ?? {})
  )
  assert(
    agentLogs.length > 0 && allAgentsValid,
    "All agent audit entries have actorId null and agentId stored in details (Amendment A)"
  )

  // 22. User ID must be a valid UUID for decisions and overrides
  const invalidUserDecision = await decideTier3Action(fakePrisma, {
    actionId: resTimedT3.actionId,
    decision: "approve",
    reason: "Decision with non-UUID user",
    userId: "user-12345",
  })
  assert(
    invalidUserDecision.status === "invalid" && invalidUserDecision.error.includes("UUID"),
    "Decisions reject non-UUID userId"
  )
  const invalidUserOverride = await overrideAction(fakePrisma, {
    actionId: resT2.actionId,
    reason: "Override with non-UUID user",
    userId: "not-a-uuid",
  })
  assert(
    invalidUserOverride.status === "invalid" && invalidUserOverride.error.includes("UUID"),
    "Overrides reject non-UUID userId"
  )

  // --------------------------------------------------------------------------
  // Group 10: Agent Governance Route Handlers (Isolated Mock Verification)
  // --------------------------------------------------------------------------
  console.log("\n--- Group 10: Agent Governance Routes & Carry-Over Fixes ---")

  // 1. Carry-Over Check: updateMany rejects unknown keys in data and where
  let updateManyRejectedData = false
  try {
    await fakePrisma.agentAction.updateMany({
      where: { id: "some-id" },
      data: { invalidDataKey: "boom" } as any,
    })
  } catch (err: any) {
    if (err.message.includes("invalidDataKey")) {
      updateManyRejectedData = true
    }
  }
  assert(
    updateManyRejectedData,
    "Fake prisma agentAction.updateMany rejects unknown key in data"
  )

  let updateManyRejectedWhere = false
  try {
    await fakePrisma.agentAction.updateMany({
      where: { invalidWhereKey: "boom" } as any,
      data: { status: "executed" },
    })
  } catch (err: any) {
    if (err.message.includes("invalidWhereKey")) {
      updateManyRejectedWhere = true
    }
  }
  assert(
    updateManyRejectedWhere,
    "Fake prisma agentAction.updateMany rejects unknown key in where"
  )

  // Helper for mock Express req/res
  function createMockReqRes(options: {
    query?: Record<string, any>
    params?: Record<string, any>
    body?: Record<string, any>
    user?: { userId: string; email?: string; role?: string; institutionId?: string }
    headers?: Record<string, string>
    ip?: string
    tenantPrisma?: TenantPrisma
  }) {
    const req = {
      query: options.query ?? {},
      params: options.params ?? {},
      body: options.body ?? {},
      user: options.user ?? {
        userId: validUserId,
        role: "admin",
        institutionId: "inst-apex-01",
      },
      headers: options.headers ?? {},
      ip: options.ip ?? "127.0.0.1",
      tenantPrisma: options.tenantPrisma ?? fakePrisma,
    } as unknown as Request

    let statusCode = 200
    let jsonBody: any = null
    let statusCallCount = 0
    let jsonCallCount = 0

    const res = {
      status(code: number) {
        statusCallCount++
        if (statusCallCount > 1) {
          assert(false, "createMockReqRes assertion failed: res.status called more than once")
        }
        statusCode = code
        return res
      },
      json(data: any) {
        jsonCallCount++
        if (jsonCallCount > 1) {
          assert(false, "createMockReqRes assertion failed: res.json called more than once")
        }
        jsonBody = data
        return res
      },
    } as unknown as Response

    return {
      req,
      res,
      getStatus: () => statusCode,
      getBody: () => jsonBody,
      getStatusCallCount: () => statusCallCount,
      getJsonCallCount: () => jsonCallCount,
    }
  }

  // 2. GET / (handleListAgentActions) omits inputPayload and outputPayload
  const mockList = createMockReqRes({})
  await handleListAgentActions(mockList.req, mockList.res)
  assert(mockList.getStatus() === 200, "handleListAgentActions returns HTTP 200")
  const listBody = mockList.getBody()
  assert(
    Array.isArray(listBody.data) && listBody.data.length > 0,
    "handleListAgentActions returns action items array"
  )
  const listAllOmittedPayloads = listBody.data.every(
    (item: any) => item.inputPayload === undefined && item.outputPayload === undefined
  )
  assert(
    listAllOmittedPayloads,
    "handleListAgentActions strictly omits inputPayload and outputPayload across all items"
  )

  // 3. GET /pending (handleListPendingActions) omits payloads & orders by createdAt
  // First ensure there is at least one pending Tier 3 action in fakePrisma
  const pendingT3 = await dispatchAgentAction(fakePrisma, {
    actionType: "generate_cbsl_report",
    action: "Generate CBSL test report for route testing",
    reason: "Route verification pending action test",
    inputPayload: { confidential: "secret" },
  })
  const mockPending = createMockReqRes({})
  await handleListPendingActions(mockPending.req, mockPending.res)
  assert(mockPending.getStatus() === 200, "handleListPendingActions returns HTTP 200")
  const pendingBody = mockPending.getBody()
  assert(
    Array.isArray(pendingBody.data) &&
      pendingBody.data.some((a: any) => a.id === pendingT3.actionId),
    "handleListPendingActions contains newly dispatched Tier 3 pending action"
  )
  const pendingAllOmittedPayloads = pendingBody.data.every(
    (item: any) => item.inputPayload === undefined && item.outputPayload === undefined
  )
  assert(
    pendingAllOmittedPayloads,
    "handleListPendingActions strictly omits inputPayload and outputPayload across all items"
  )

  // 4. GET /:id (handleGetActionById) DOES return inputPayload and outputPayload
  const mockGetById = createMockReqRes({ params: { id: pendingT3.actionId } })
  await handleGetActionById(mockGetById.req, mockGetById.res)
  assert(mockGetById.getStatus() === 200, "handleGetActionById returns HTTP 200")
  const singleActionBody = mockGetById.getBody()
  assert(
    singleActionBody.data?.id === pendingT3.actionId &&
      singleActionBody.data?.inputPayload !== undefined,
    "handleGetActionById DOES return inputPayload and outputPayload for human inspection"
  )

  // 5. GET /:id validates UUID (returns 400 for non-UUID, 404 for missing UUID)
  const mockBadUuid = createMockReqRes({ params: { id: "not-a-uuid" } })
  await handleGetActionById(mockBadUuid.req, mockBadUuid.res)
  assert(mockBadUuid.getStatus() === 400, "handleGetActionById returns 400 for non-UUID param")

  const mockNotFoundUuid = createMockReqRes({
    params: { id: "e0000000-0000-4000-a000-000000000000" },
  })
  await handleGetActionById(mockNotFoundUuid.req, mockNotFoundUuid.res)
  assert(mockNotFoundUuid.getStatus() === 404, "handleGetActionById returns 404 when action not found")

  // 6. List filters reject invalid values (400)
  const mockBadTier = createMockReqRes({ query: { tier: "99" } })
  await handleListAgentActions(mockBadTier.req, mockBadTier.res)
  assert(mockBadTier.getStatus() === 400, "handleListAgentActions rejects invalid tier (400)")

  const mockBadStatus = createMockReqRes({ query: { status: "unknown_state" } })
  await handleListAgentActions(mockBadStatus.req, mockBadStatus.res)
  assert(mockBadStatus.getStatus() === 400, "handleListAgentActions rejects invalid status (400)")

  const mockBadAgentId = createMockReqRes({ query: { agentId: "A9" } })
  await handleListAgentActions(mockBadAgentId.req, mockBadAgentId.res)
  assert(mockBadAgentId.getStatus() === 400, "handleListAgentActions rejects invalid agentId (400)")

  const mockBadFromDate = createMockReqRes({ query: { from: "not-an-iso-date" } })
  await handleListAgentActions(mockBadFromDate.req, mockBadFromDate.res)
  assert(mockBadFromDate.getStatus() === 400, "handleListAgentActions rejects invalid from date (400)")

  const mockBadToDate = createMockReqRes({ query: { to: "not-an-iso-date" } })
  await handleListAgentActions(mockBadToDate.req, mockBadToDate.res)
  assert(mockBadToDate.getStatus() === 400, "handleListAgentActions rejects invalid to date (400)")

  // 7. POST /:id/approve maps to 200, 400, 409
  // 400 for short reason
  const mockShortReason = createMockReqRes({
    params: { id: pendingT3.actionId },
    body: { reason: "short" },
  })
  await handleApproveAction(mockShortReason.req, mockShortReason.res)
  assert(mockShortReason.getStatus() === 400, "handleApproveAction returns 400 for short reason")

  // 200 for valid approval
  const mockValidApprove = createMockReqRes({
    params: { id: pendingT3.actionId },
    body: { reason: "Approved after verifying financial figures with controller" },
  })
  await handleApproveAction(mockValidApprove.req, mockValidApprove.res)
  assert(mockValidApprove.getStatus() === 200, "handleApproveAction returns 200 for valid approval")

  // 409 for conflict (attempting to approve already approved action)
  const mockConflictApprove = createMockReqRes({
    params: { id: pendingT3.actionId },
    body: { reason: "Duplicate approval attempt should fail with conflict" },
  })
  await handleApproveAction(mockConflictApprove.req, mockConflictApprove.res)
  assert(
    mockConflictApprove.getStatus() === 409,
    "handleApproveAction returns 409 for state conflict on non-pending action"
  )

  // 8. POST /:id/reject reason validation and conflict mapping
  // Create another pending Tier 3 action to test reject reason validation
  const pendingT3ForReject = await dispatchAgentAction(fakePrisma, {
    actionType: "generate_cbsl_report",
    action: "Generate CBSL test report for reject testing",
    reason: "Pending action created for rejection test",
  })

  // 400 for short reason on reject
  const mockRejectShortReason = createMockReqRes({
    params: { id: pendingT3ForReject.actionId },
    body: { reason: "short" },
  })
  await handleRejectAction(mockRejectShortReason.req, mockRejectShortReason.res)
  assert(mockRejectShortReason.getStatus() === 400, "handleRejectAction returns 400 for short reason")

  // 200 for valid rejection
  const mockValidReject = createMockReqRes({
    params: { id: pendingT3ForReject.actionId },
    body: { reason: "Officer rejected action due to quarterly figure discrepancy" },
  })
  await handleRejectAction(mockValidReject.req, mockValidReject.res)
  assert(mockValidReject.getStatus() === 200, "handleRejectAction returns 200 for valid rejection")

  // Conflict (409) when already decided
  const mockConflictReject = createMockReqRes({
    params: { id: pendingT3.actionId },
    body: { reason: "Rejecting an already approved action should conflict" },
  })
  await handleRejectAction(mockConflictReject.req, mockConflictReject.res)
  assert(
    mockConflictReject.getStatus() === 409,
    "handleRejectAction returns 409 for conflict when action is already decided"
  )

  // 9. POST /:id/override reason validation, execution, and conflict mapping
  // Create a Tier 2 executed action to override
  const t2Action = await dispatchAgentAction(fakePrisma, {
    actionType: "budget_threshold_alert",
    action: "Alert manager of budget limit reached",
    reason: "Monthly budget reached 85% limit threshold",
  })

  // 400 for short reason on override
  const mockOverrideShortReason = createMockReqRes({
    params: { id: t2Action.actionId },
    body: { reason: "short" },
  })
  await handleOverrideAction(mockOverrideShortReason.req, mockOverrideShortReason.res)
  assert(mockOverrideShortReason.getStatus() === 400, "handleOverrideAction returns 400 for short reason")

  // 200 for valid override
  const mockValidOverride = createMockReqRes({
    params: { id: t2Action.actionId },
    body: { reason: "Officer verified extra budget allocation granted" },
  })
  await handleOverrideAction(mockValidOverride.req, mockValidOverride.res)
  assert(mockValidOverride.getStatus() === 200, "handleOverrideAction returns 200 for valid override")

  // Conflict on re-override
  const mockConflictOverride = createMockReqRes({
    params: { id: t2Action.actionId },
    body: { reason: "Second override attempt should fail with conflict" },
  })
  await handleOverrideAction(mockConflictOverride.req, mockConflictOverride.res)
  assert(
    mockConflictOverride.getStatus() === 409,
    "handleOverrideAction returns 409 for conflict when action is already overridden"
  )

  // 10. Actor ID strictly taken from req.user, not req.body
  const t2Action2 = await dispatchAgentAction(fakePrisma, {
    actionType: "budget_threshold_alert",
    action: "Alert manager of budget limit reached 2",
    reason: "Monthly budget reached 90% limit threshold",
  })
  const attackerActorId = "00000000-9999-9999-9999-000000000000"
  const mockSpoofAttempt = createMockReqRes({
    params: { id: t2Action2.actionId },
    body: {
      reason: "Override justification text from legitimate officer",
      userId: attackerActorId,
      actorId: attackerActorId,
    },
  })
  await handleOverrideAction(mockSpoofAttempt.req, mockSpoofAttempt.res)
  assert(
    mockSpoofAttempt.getStatus() === 200 &&
      mockSpoofAttempt.getBody()?.status === "ok" &&
      mockSpoofAttempt.getBody()?.actionId === t2Action2.actionId,
    "handleOverrideAction returns 200 with status ok and actionId"
  )
  const overriddenRow = await fakePrisma.agentAction.findUnique({
    where: { id: t2Action2.actionId },
  })
  assert(
    overriddenRow?.approvedBy === validUserId &&
      overriddenRow?.approvedBy !== attackerActorId &&
      overriddenRow?.isOverride === true &&
      overriddenRow?.decisionReason === "Override justification text from legitimate officer",
    "Actor ID is strictly taken from req.user.userId, never req.body"
  )

  // 11. Override rates endpoint defaults to 30 days
  const mockMetricsDefault = createMockReqRes({})
  await handleGetOverrideRates(mockMetricsDefault.req, mockMetricsDefault.res)
  assert(mockMetricsDefault.getStatus() === 200, "handleGetOverrideRates returns 200")
  const metricsBody = mockMetricsDefault.getBody()
  const fromMs = Date.parse(metricsBody.data.timeRange.from)
  const toMs = Date.parse(metricsBody.data.timeRange.to)
  const dayDiff = (toMs - fromMs) / (1000 * 60 * 60 * 24)
  assert(
    Math.round(dayDiff) === 30,
    "handleGetOverrideRates defaults to 30 days range when no dates provided"
  )

  // 12. Enforced take cap limits (500 rows) on pending and metrics queries
  let lastFindManyArgs: any = null
  const trackingFakePrisma = {
    ...fakePrisma,
    agentAction: {
      ...fakePrisma.agentAction,
      findMany: async (args?: any) => {
        lastFindManyArgs = args
        return fakePrisma.agentAction.findMany(args)
      },
    },
  } as unknown as TenantPrisma

  const mockPendingTracked = createMockReqRes({ tenantPrisma: trackingFakePrisma })
  await handleListPendingActions(mockPendingTracked.req, mockPendingTracked.res)
  assert(
    lastFindManyArgs?.take === 500,
    "handleListPendingActions enforces MAX_PENDING_TAKE cap of 500 rows"
  )

  const mockMetricsTracked = createMockReqRes({ tenantPrisma: trackingFakePrisma })
  await handleGetOverrideRates(mockMetricsTracked.req, mockMetricsTracked.res)
  assert(
    lastFindManyArgs?.take === 501 && lastFindManyArgs?.orderBy?.createdAt === "desc",
    "handleGetOverrideRates fetches take 501 ordered by createdAt desc"
  )

  // 13. Error response sanitization: DB errors return generic 500 with no table/column names
  const leakingFakePrisma = {
    ...fakePrisma,
    agentAction: {
      ...fakePrisma.agentAction,
      findMany: async () => {
        throw new Error("relation \"tenant_apex_demo.agent_actions\" does not exist in schema public")
      },
    },
  } as unknown as TenantPrisma

  const mockLeakingList = createMockReqRes({ tenantPrisma: leakingFakePrisma })
  await handleListAgentActions(mockLeakingList.req, mockLeakingList.res)
  assert(mockLeakingList.getStatus() === 500, "Handler returns HTTP 500 when database error thrown")
  const leakBodyStr = JSON.stringify(mockLeakingList.getBody())
  assert(
    !leakBodyStr.includes("agent_actions") &&
      !leakBodyStr.includes("tenant_apex_demo") &&
      !leakBodyStr.includes("relation") &&
      mockLeakingList.getBody()?.error === "Failed to query agent actions",
    "Database errors return generic message without exposing table or schema names"
  )

  // 14. Router registration order: /metrics/override-rates MUST precede /:id
  const routeLayers = agentGovernanceRouter.stack
    .map((layer: any) => layer.route?.path)
    .filter(Boolean)
  const metricsRouteIdx = routeLayers.indexOf("/metrics/override-rates")
  const idRouteIdx = routeLayers.indexOf("/:id")
  assert(
    metricsRouteIdx !== -1 && idRouteIdx !== -1 && metricsRouteIdx < idRouteIdx,
    "Route /metrics/override-rates is registered BEFORE /:id in agentGovernanceRouter"
  )

  // --------------------------------------------------------------------------
  // Group 11: Policy Routes, Test Dispatch, Provisioning & Capped Metrics
  // --------------------------------------------------------------------------
  console.log("\n--- Group 11: Policy Routes, Test Dispatch, Provisioning & Capped Metrics ---")

  // 1. GET /agent-policies lists all policies
  const mockListPolicies = createMockReqRes({})
  await handleListAgentPolicies(mockListPolicies.req, mockListPolicies.res)
  assert(mockListPolicies.getStatus() === 200, "handleListAgentPolicies returns HTTP 200")
  const listPoliciesBody = mockListPolicies.getBody()
  assert(
    Array.isArray(listPoliciesBody.data) && listPoliciesBody.data.length >= 4,
    "handleListAgentPolicies returns policies array with at least 4 default policies"
  )

  // 2. POST /agent-policies: missing agentName returns 400, exactly one response, no policy created
  const policiesBeforeMissingName = fakePrisma._getPolicies().length
  const mockMissingAgentName = createMockReqRes({
    body: {
      actionType: "missing_name_action",
      agentId: "A1",
      tier: 2,
    },
  })
  await handleCreateAgentPolicy(mockMissingAgentName.req, mockMissingAgentName.res)
  assert(
    mockMissingAgentName.getStatus() === 400,
    "handleCreateAgentPolicy returns 400 for missing agentName"
  )
  assert(
    mockMissingAgentName.getStatusCallCount() === 1 && mockMissingAgentName.getJsonCallCount() === 1,
    "handleCreateAgentPolicy returns exactly one response on missing agentName"
  )
  assert(
    fakePrisma._getPolicies().length === policiesBeforeMissingName,
    "handleCreateAgentPolicy creates no policy on missing agentName"
  )

  // 3. POST /agent-policies: actionType validation
  const mockCreateInvalidType = createMockReqRes({
    body: {
      actionType: "INVALID_UPPERCASE",
      agentId: "A1",
      agentName: "Compliance",
      tier: 3,
    },
  })
  await handleCreateAgentPolicy(mockCreateInvalidType.req, mockCreateInvalidType.res)
  assert(
    mockCreateInvalidType.getStatus() === 400,
    "handleCreateAgentPolicy rejects uppercase/invalid actionType with HTTP 400"
  )

  // 4. POST /agent-policies: agentId validation
  const mockCreateInvalidAgent = createMockReqRes({
    body: {
      actionType: "valid_action_type",
      agentId: "A99",
      agentName: "UnknownAgent",
      tier: 2,
    },
  })
  await handleCreateAgentPolicy(mockCreateInvalidAgent.req, mockCreateInvalidAgent.res)
  assert(
    mockCreateInvalidAgent.getStatus() === 400,
    "handleCreateAgentPolicy rejects invalid agentId with HTTP 400"
  )

  // 5. POST /agent-policies: strict tier validation (rejects strings, booleans, floats, arrays)
  const mockStringTier = createMockReqRes({
    body: {
      actionType: "valid_action_type",
      agentId: "A1",
      agentName: "Compliance",
      tier: "2",
    },
  })
  await handleCreateAgentPolicy(mockStringTier.req, mockStringTier.res)
  assert(
    mockStringTier.getStatus() === 400,
    "handleCreateAgentPolicy rejects string tier with HTTP 400"
  )

  const mockBoolTier = createMockReqRes({
    body: {
      actionType: "valid_action_type",
      agentId: "A1",
      agentName: "Compliance",
      tier: true,
    },
  })
  await handleCreateAgentPolicy(mockBoolTier.req, mockBoolTier.res)
  assert(
    mockBoolTier.getStatus() === 400,
    "handleCreateAgentPolicy rejects boolean tier with HTTP 400"
  )

  const mockFloatTier = createMockReqRes({
    body: {
      actionType: "valid_action_type",
      agentId: "A1",
      agentName: "Compliance",
      tier: 2.5,
    },
  })
  await handleCreateAgentPolicy(mockFloatTier.req, mockFloatTier.res)
  assert(
    mockFloatTier.getStatus() === 400,
    "handleCreateAgentPolicy rejects non-integer float tier with HTTP 400"
  )

  const mockCreateInvalidTier = createMockReqRes({
    body: {
      actionType: "valid_action_type",
      agentId: "A1",
      agentName: "Compliance",
      tier: 5,
    },
  })
  await handleCreateAgentPolicy(mockCreateInvalidTier.req, mockCreateInvalidTier.res)
  assert(
    mockCreateInvalidTier.getStatus() === 400,
    "handleCreateAgentPolicy rejects invalid tier (5) with HTTP 400"
  )

  // 6. POST /agent-policies: agentName max 64 chars and description max 500 chars
  const mockLongAgentName = createMockReqRes({
    body: {
      actionType: "long_name_action",
      agentId: "A1",
      agentName: "A".repeat(65),
      tier: 2,
    },
  })
  await handleCreateAgentPolicy(mockLongAgentName.req, mockLongAgentName.res)
  assert(
    mockLongAgentName.getStatus() === 400,
    "handleCreateAgentPolicy rejects agentName exceeding 64 chars with HTTP 400"
  )

  const mockLongDescription = createMockReqRes({
    body: {
      actionType: "long_desc_action",
      agentId: "A1",
      agentName: "Compliance",
      tier: 2,
      description: "D".repeat(501),
    },
  })
  await handleCreateAgentPolicy(mockLongDescription.req, mockLongDescription.res)
  assert(
    mockLongDescription.getStatus() === 400,
    "handleCreateAgentPolicy rejects description exceeding 500 chars with HTTP 400"
  )

  // 7. POST /agent-policies: duplicate actionType returns 409
  const mockCreateDuplicate = createMockReqRes({
    body: {
      actionType: "nlq_query",
      agentId: "A4",
      agentName: "NLQ",
      tier: 1,
    },
  })
  await handleCreateAgentPolicy(mockCreateDuplicate.req, mockCreateDuplicate.res)
  assert(
    mockCreateDuplicate.getStatus() === 409,
    "handleCreateAgentPolicy returns HTTP 409 for duplicate actionType"
  )

  // 8. POST /agent-policies: catch unique violation (Prisma code P2002) returns 409
  const p2002FakePrisma = {
    ...fakePrisma,
    agentTierPolicy: {
      ...fakePrisma.agentTierPolicy,
      findUnique: async () => null,
    },
    $transaction: async (fn: any) => {
      return fn({
        ...fakePrisma,
        agentTierPolicy: {
          create: async () => {
            const p2002Err: any = new Error("Unique constraint failed on the fields: (`actionType`)")
            p2002Err.code = "P2002"
            throw p2002Err
          },
        },
      })
    },
  } as unknown as TenantPrisma

  const mockP2002Create = createMockReqRes({
    body: {
      actionType: "p2002_unique_test",
      agentId: "A1",
      agentName: "Compliance",
      tier: 3,
    },
    tenantPrisma: p2002FakePrisma,
  })
  await handleCreateAgentPolicy(mockP2002Create.req, mockP2002Create.res)
  assert(
    mockP2002Create.getStatus() === 409,
    "handleCreateAgentPolicy catches Prisma P2002 unique violation and returns HTTP 409"
  )

  // 9. POST /agent-policies: valid policy creation writes policy and audit log in same tx
  const auditLogsBeforeCreate = fakePrisma._getAuditLogs().length
  const newActionType = "loan_repayment_notify"
  const mockCreateValid = createMockReqRes({
    body: {
      actionType: newActionType,
      agentId: "A2",
      agentName: "Workflow",
      tier: 2,
      description: "Send borrower repayment reminder alert",
    },
  })
  await handleCreateAgentPolicy(mockCreateValid.req, mockCreateValid.res)
  assert(
    mockCreateValid.getStatus() === 201,
    "handleCreateAgentPolicy creates policy and returns HTTP 201"
  )
  const createdPolicyBody = mockCreateValid.getBody()
  const createdPolicyId = createdPolicyBody.policy?.id
  assert(
    isValidUuid(createdPolicyId),
    "handleCreateAgentPolicy returns created policy with valid UUID"
  )
  const auditLogsAfterCreate = fakePrisma._getAuditLogs().length
  const latestAuditCreate = fakePrisma._getAuditLogs()[auditLogsAfterCreate - 1]
  assert(
    auditLogsAfterCreate === auditLogsBeforeCreate + 1 &&
      latestAuditCreate.action === "agent_policy.created" &&
      latestAuditCreate.actorId === validUserId &&
      latestAuditCreate.resource === "agent_tier_policies" &&
      (latestAuditCreate.details as any)?.actionType === newActionType &&
      (latestAuditCreate.details as any)?.tier === 2,
    "handleCreateAgentPolicy writes audit log with actorId from req.user.userId and policy details"
  )

  // 10. PUT /agent-policies/:id: UUID validation
  const mockUpdateInvalidUuid = createMockReqRes({
    params: { id: "not-a-uuid" },
    body: { tier: 3, reason: "Valid justification reason here" },
  })
  await handleUpdateAgentPolicy(mockUpdateInvalidUuid.req, mockUpdateInvalidUuid.res)
  assert(
    mockUpdateInvalidUuid.getStatus() === 400,
    "handleUpdateAgentPolicy rejects non-UUID id with HTTP 400"
  )

  // 11. PUT /agent-policies/:id: not found returns 404
  const mockUpdateNotFound = createMockReqRes({
    params: { id: "00000000-0000-4000-a000-000000000000" },
    body: { tier: 3, reason: "Valid justification reason here" },
  })
  await handleUpdateAgentPolicy(mockUpdateNotFound.req, mockUpdateNotFound.res)
  assert(
    mockUpdateNotFound.getStatus() === 404,
    "handleUpdateAgentPolicy returns HTTP 404 for unknown policy UUID"
  )

  // 12. PUT /agent-policies/:id: strict input validations (tier, isActive, no changes)
  const mockUpdateStrTier = createMockReqRes({
    params: { id: createdPolicyId },
    body: { tier: "3", reason: "Valid justification reason here" },
  })
  await handleUpdateAgentPolicy(mockUpdateStrTier.req, mockUpdateStrTier.res)
  assert(
    mockUpdateStrTier.getStatus() === 400,
    "handleUpdateAgentPolicy rejects string tier with HTTP 400"
  )

  const mockUpdateNonBoolActive = createMockReqRes({
    params: { id: createdPolicyId },
    body: { isActive: "true" },
  })
  await handleUpdateAgentPolicy(mockUpdateNonBoolActive.req, mockUpdateNonBoolActive.res)
  assert(
    mockUpdateNonBoolActive.getStatus() === 400,
    "handleUpdateAgentPolicy rejects non-boolean isActive with HTTP 400"
  )

  const auditLogsBeforeEmpty = fakePrisma._getAuditLogs().length
  const mockUpdateEmpty = createMockReqRes({
    params: { id: createdPolicyId },
    body: {},
  })
  await handleUpdateAgentPolicy(mockUpdateEmpty.req, mockUpdateEmpty.res)
  assert(
    mockUpdateEmpty.getStatus() === 400,
    "handleUpdateAgentPolicy returns HTTP 400 when body has no update fields"
  )
  assert(
    fakePrisma._getAuditLogs().length === auditLogsBeforeEmpty,
    "Empty update body writes no audit entry"
  )

  const currentCreatedPolicy = fakePrisma._getPolicies().find((p) => p.id === createdPolicyId)!
  const auditLogsBeforeNoChange = fakePrisma._getAuditLogs().length
  const mockUpdateNoChange = createMockReqRes({
    params: { id: createdPolicyId },
    body: {
      tier: currentCreatedPolicy.tier,
      isActive: currentCreatedPolicy.isActive,
      description: currentCreatedPolicy.description ?? undefined,
    },
  })
  await handleUpdateAgentPolicy(mockUpdateNoChange.req, mockUpdateNoChange.res)
  assert(
    mockUpdateNoChange.getStatus() === 400,
    "handleUpdateAgentPolicy returns HTTP 400 when payload contains no changes"
  )
  assert(
    fakePrisma._getAuditLogs().length === auditLogsBeforeNoChange,
    "No-change update payload writes no audit entry"
  )

  // 13. PUT /agent-policies/:id: tier change WITHOUT reason returns 400
  const mockUpdateNoReason = createMockReqRes({
    params: { id: createdPolicyId },
    body: { tier: 3 },
  })
  await handleUpdateAgentPolicy(mockUpdateNoReason.req, mockUpdateNoReason.res)
  assert(
    mockUpdateNoReason.getStatus() === 400,
    "handleUpdateAgentPolicy returns HTTP 400 when changing tier without reason"
  )

  // 14. PUT /agent-policies/:id: tier change with short reason (< 10 chars) returns 400
  const mockUpdateShortReason = createMockReqRes({
    params: { id: createdPolicyId },
    body: { tier: 3, reason: "too short" },
  })
  await handleUpdateAgentPolicy(mockUpdateShortReason.req, mockUpdateShortReason.res)
  assert(
    mockUpdateShortReason.getStatus() === 400,
    "handleUpdateAgentPolicy returns HTTP 400 when changing tier with reason < 10 chars"
  )

  // 15. PUT /agent-policies/:id: guarded update conflict returns 409 and writes no audit entry
  const conflictUpdatePrisma = {
    ...fakePrisma,
    $transaction: async (fn: any) => {
      return fn({
        ...fakePrisma,
        agentTierPolicy: {
          ...fakePrisma.agentTierPolicy,
          findUnique: async () => ({
            id: createdPolicyId,
            actionType: newActionType,
            agentId: "A2",
            agentName: "Workflow",
            tier: 2,
            isActive: true,
            description: null,
          }),
          updateMany: async () => ({ count: 0 }),
        },
      })
    },
  } as unknown as TenantPrisma

  const auditLogsBeforeConflict = fakePrisma._getAuditLogs().length
  const mockUpdateConflict = createMockReqRes({
    params: { id: createdPolicyId },
    body: { tier: 3, reason: "Valid justification text" },
    tenantPrisma: conflictUpdatePrisma,
  })
  await handleUpdateAgentPolicy(mockUpdateConflict.req, mockUpdateConflict.res)
  assert(
    mockUpdateConflict.getStatus() === 409,
    "handleUpdateAgentPolicy returns HTTP 409 when guarded updateMany count is 0"
  )
  assert(
    fakePrisma._getAuditLogs().length === auditLogsBeforeConflict,
    "Guarded update conflict writes no audit entry"
  )

  // 16. PUT /agent-policies/:id: valid tier change updates policy and stores old/new tier + reason in audit log
  const auditLogsBeforeUpdate = fakePrisma._getAuditLogs().length
  const validReasonText = "Promoting repayment notify from Tier 2 to Tier 3 for risk oversight"
  const mockUpdateValid = createMockReqRes({
    params: { id: createdPolicyId },
    body: {
      tier: 3,
      reason: validReasonText,
      description: "Updated description for Tier 3",
    },
  })
  await handleUpdateAgentPolicy(mockUpdateValid.req, mockUpdateValid.res)
  assert(
    mockUpdateValid.getStatus() === 200,
    "handleUpdateAgentPolicy returns HTTP 200 on valid tier change with justification"
  )
  const auditLogsAfterUpdate = fakePrisma._getAuditLogs().length
  const latestAuditUpdate = fakePrisma._getAuditLogs()[auditLogsAfterUpdate - 1]
  assert(
    auditLogsAfterUpdate === auditLogsBeforeUpdate + 1 &&
      latestAuditUpdate.action === "agent_policy.updated" &&
      latestAuditUpdate.actorId === validUserId &&
      (latestAuditUpdate.details as any)?.oldTier === 2 &&
      (latestAuditUpdate.details as any)?.newTier === 3 &&
      (latestAuditUpdate.details as any)?.reason === validReasonText,
    "handleUpdateAgentPolicy writes audit log with oldTier, newTier, and reason in same transaction"
  )

  // 17. PUT /agent-policies/:id: update without tier change does NOT require reason
  const mockUpdateNoTierChange = createMockReqRes({
    params: { id: createdPolicyId },
    body: {
      isActive: false,
      description: "Temporarily disabled policy",
    },
  })
  await handleUpdateAgentPolicy(mockUpdateNoTierChange.req, mockUpdateNoTierChange.res)
  assert(
    mockUpdateNoTierChange.getStatus() === 200,
    "handleUpdateAgentPolicy does not require reason when tier is unchanged"
  )

  // 18. PERMISSION TESTS: Router stack inspection proving exact allowed roles per route
  function getRouteMiddlewareAllowedRoles(router: any, path: string, method: string): RoleName[] {
    const routeLayer = router.stack.find(
      (l: any) => l.route && l.route.path === path && l.route.methods[method.toLowerCase()]
    )
    if (!routeLayer) {
      throw new Error(`Route ${method.toUpperCase()} ${path} not found in router stack`)
    }
    const mw = routeLayer.route.stack[0].handle
    const allowed: RoleName[] = []
    for (const role of ROLES) {
      let nextCalled = false
      let status = 200
      const req = { user: { role } } as any
      const res = {
        status: (c: number) => {
          status = c
          return res
        },
        json: () => res,
      } as any
      mw(req, res, () => {
        nextCalled = true
      })
      if (nextCalled && status === 200) {
        allowed.push(role)
      }
    }
    return allowed
  }

  // Policy routes RBAC: POST/PUT admin only, GET all 6
  const postPolicyRoles = getRouteMiddlewareAllowedRoles(agentPoliciesRouter, "/", "post")
  const putPolicyRoles = getRouteMiddlewareAllowedRoles(agentPoliciesRouter, "/:id", "put")
  const getPolicyRoles = getRouteMiddlewareAllowedRoles(agentPoliciesRouter, "/", "get")
  assert(
    postPolicyRoles.length === 1 && postPolicyRoles[0] === "admin",
    "policy POST middleware accepts strictly admin only"
  )
  assert(
    putPolicyRoles.length === 1 && putPolicyRoles[0] === "admin",
    "policy PUT middleware accepts strictly admin only"
  )
  assert(
    getPolicyRoles.length === 6 && ROLES.every((r) => getPolicyRoles.includes(r)),
    "policy GET middleware accepts all 6 roles"
  )

  // Agent governance routes RBAC:
  // test-dispatch admin only
  const testDispatchRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/test-dispatch", "post")
  assert(
    testDispatchRoles.length === 1 && testDispatchRoles[0] === "admin",
    "test-dispatch middleware accepts strictly admin only"
  )

  // approve, reject, override, pending, metrics, GET /:id accept only decide_tier3 roles (admin, executive)
  const approveRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/:id/approve", "post")
  const rejectRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/:id/reject", "post")
  const overrideRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/:id/override", "post")
  const pendingRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/pending", "get")
  const metricsRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/metrics/override-rates", "get")
  const getByIdRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/:id", "get")

  assert(
    approveRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => approveRoles.includes(r)),
    "approve middleware accepts strictly decide_tier3 roles"
  )
  assert(
    rejectRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => rejectRoles.includes(r)),
    "reject middleware accepts strictly decide_tier3 roles"
  )
  assert(
    overrideRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => overrideRoles.includes(r)),
    "override middleware accepts strictly decide_tier3 roles"
  )
  assert(
    pendingRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => pendingRoles.includes(r)),
    "pending middleware accepts strictly decide_tier3 roles"
  )
  assert(
    metricsRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => metricsRoles.includes(r)),
    "metrics middleware accepts strictly decide_tier3 roles"
  )
  assert(
    getByIdRoles.length === DECIDE_TIER3_ROLES.length &&
      DECIDE_TIER3_ROLES.every((r) => getByIdRoles.includes(r)),
    "GET /:id middleware accepts strictly decide_tier3 roles"
  )

  // list agent-actions accepts all 6 roles
  const listActionsRoles = getRouteMiddlewareAllowedRoles(agentGovernanceRouter, "/", "get")
  assert(
    listActionsRoles.length === 6 && ROLES.every((r) => listActionsRoles.includes(r)),
    "list agent-actions middleware accepts all 6 roles"
  )

  // 19. POST /agent-actions/test-dispatch: disabled in production (HTTP 403)
  const origEnv = process.env.NODE_ENV
  try {
    process.env.NODE_ENV = "production"
    const mockProdDispatch = createMockReqRes({
      body: {
        actionType: "nlq_query",
        action: "Test query in production",
        reason: "Checking production guard",
      },
    })
    await handleTestDispatchAction(mockProdDispatch.req, mockProdDispatch.res)
    assert(
      mockProdDispatch.getStatus() === 403,
      "handleTestDispatchAction returns HTTP 403 in production"
    )
    assert(
      mockProdDispatch.getBody()?.error === "Test dispatch is disabled in production",
      "handleTestDispatchAction returns clear error message in production"
    )
  } finally {
    process.env.NODE_ENV = origEnv
  }

  // 20. POST /agent-actions/test-dispatch: tier can NEVER come from body
  const mockTestDispatchTierSpoof = createMockReqRes({
    body: {
      actionType: "nlq_query",
      action: "Natural language query",
      reason: "Attempting to force Tier 4 via body parameter",
      inputPayload: { query: "Show overdue loans" },
      tier: 4,
    },
  })
  await handleTestDispatchAction(mockTestDispatchTierSpoof.req, mockTestDispatchTierSpoof.res)
  assert(
    mockTestDispatchTierSpoof.getStatus() === 200,
    "handleTestDispatchAction returns HTTP 200 in non-production"
  )
  const dispatchBody = mockTestDispatchTierSpoof.getBody()
  assert(
    dispatchBody.tier === 1,
    "handleTestDispatchAction resolves tier strictly from policy (Tier 1), ignoring body tier"
  )

  // 21. POST /agent-actions/test-dispatch: maps conflict result to HTTP 409
  const conflictDispatchFakePrisma = {
    ...fakePrisma,
    $transaction: (async (fn: any) => {
      if (typeof fn === "function") {
        return fn(conflictDispatchFakePrisma)
      }
      return Promise.all(fn)
    }) as unknown as TenantPrisma["$transaction"],
    agentTierPolicy: {
      findUnique: async () => ({
        id: "pol-conflict",
        actionType: "conflict_test_action",
        agentId: "A1",
        agentName: "Compliance",
        tier: 1,
        isActive: true,
      }),
    },
    agentAction: {
      ...fakePrisma.agentAction,
      create: async () => ({
        id: "act-conflict",
        actionType: "conflict_test_action",
        agentId: "A1",
        agentName: "Compliance",
        tier: 1,
        status: "running",
      }),
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as TenantPrisma

  const mockTestDispatchConflict = createMockReqRes({
    body: {
      actionType: "conflict_test_action",
      action: "Test conflict execution",
      reason: "Checking conflict mapping",
    },
    tenantPrisma: conflictDispatchFakePrisma,
  })
  await handleTestDispatchAction(mockTestDispatchConflict.req, mockTestDispatchConflict.res)
  assert(
    mockTestDispatchConflict.getStatus() === 409,
    "handleTestDispatchAction maps engine conflict result to HTTP 409"
  )

  // 22. POST /agent-actions/test-dispatch router registration precedes /:id
  const govRouteLayers = agentGovernanceRouter.stack
    .map((layer: any) => layer.route?.path)
    .filter(Boolean)
  const testDispatchIdx = govRouteLayers.indexOf("/test-dispatch")
  const actionIdIdx = govRouteLayers.indexOf("/:id")
  assert(
    testDispatchIdx !== -1 && actionIdIdx !== -1 && testDispatchIdx < actionIdIdx,
    "POST /test-dispatch is registered BEFORE /:id in agentGovernanceRouter"
  )

  // 23. Provisioning bootstrap: creates exactly the 4 default policies
  assert(
    DEFAULT_AGENT_POLICIES.length === 4,
    "DEFAULT_AGENT_POLICIES defines exactly 4 default policies"
  )
  const freshProvisioningPrisma = createFakeTenantPrisma([])
  const bootstrapResult = await freshProvisioningPrisma.agentTierPolicy.createMany({
    data: [...DEFAULT_AGENT_POLICIES],
  })
  assert(
    bootstrapResult.count === 4,
    "Provisioning Step D createMany bootstraps exactly 4 default policies"
  )
  const provisionedPolicies = freshProvisioningPrisma._getPolicies()
  assert(
    provisionedPolicies.length === 4 &&
      provisionedPolicies.some((p) => p.actionType === "nlq_query" && p.tier === 1) &&
      provisionedPolicies.some((p) => p.actionType === "budget_threshold_alert" && p.tier === 2) &&
      provisionedPolicies.some((p) => p.actionType === "generate_cbsl_report" && p.tier === 3) &&
      provisionedPolicies.some((p) => p.actionType === "volume_spike_alert" && p.tier === 4),
    "Provisioned tenant receives exactly A1 (T3), A2 (T2), A3 (T4), and A4 (T1) policies"
  )

  // 24. Metrics cap flag: capped is false for exactly 500 rows, true for 501 rows
  const underCapFakePrisma = {
    ...fakePrisma,
    agentAction: {
      ...fakePrisma.agentAction,
      findMany: async () => [
        { tier: 1, agentId: "A4", isOverride: false, status: "executed" },
        { tier: 2, agentId: "A2", isOverride: false, status: "notified" },
      ],
    },
  } as unknown as TenantPrisma

  const mockUnderCap = createMockReqRes({ tenantPrisma: underCapFakePrisma })
  await handleGetOverrideRates(mockUnderCap.req, mockUnderCap.res)
  assert(
    mockUnderCap.getStatus() === 200,
    "handleGetOverrideRates returns 200 for under-cap query"
  )
  assert(
    mockUnderCap.getBody()?.capped === false,
    "handleGetOverrideRates returns capped: false when rows < 500"
  )

  const exactly500FakePrisma = {
    ...fakePrisma,
    agentAction: {
      ...fakePrisma.agentAction,
      findMany: async () =>
        Array.from({ length: 500 }, () => ({
          tier: 1,
          agentId: "A4",
          isOverride: false,
          status: "executed",
        })),
    },
  } as unknown as TenantPrisma

  const mockExactly500 = createMockReqRes({ tenantPrisma: exactly500FakePrisma })
  await handleGetOverrideRates(mockExactly500.req, mockExactly500.res)
  assert(
    mockExactly500.getStatus() === 200,
    "handleGetOverrideRates returns 200 for exactly 500 rows query"
  )
  assert(
    mockExactly500.getBody()?.capped === false,
    "handleGetOverrideRates returns capped: false when exactly 500 rows returned"
  )

  const atCap501FakePrisma = {
    ...fakePrisma,
    agentAction: {
      ...fakePrisma.agentAction,
      findMany: async () =>
        Array.from({ length: 501 }, () => ({
          tier: 1,
          agentId: "A4",
          isOverride: false,
          status: "executed",
        })),
    },
  } as unknown as TenantPrisma

  const mockAtCap501 = createMockReqRes({ tenantPrisma: atCap501FakePrisma })
  await handleGetOverrideRates(mockAtCap501.req, mockAtCap501.res)
  assert(
    mockAtCap501.getStatus() === 200,
    "handleGetOverrideRates returns 200 for 501 rows query"
  )
  assert(
    mockAtCap501.getBody()?.capped === true,
    "handleGetOverrideRates returns capped: true when 501 rows returned"
  )
  assert(
    mockAtCap501.getBody()?.data?.totalActions === 500,
    "handleGetOverrideRates processes exactly the first 500 rows when capped"
  )

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n==================================================================")
  console.log(`Verification Complete: ${passCount} Passed, ${failCount} Failed`)
  console.log("==================================================================")

  if (failCount > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

runTests().catch((err) => {
  console.error("Unhandled verification error:", err)
  process.exit(1)
})
