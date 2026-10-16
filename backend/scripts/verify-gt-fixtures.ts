/**
 * GT Slice 2D — labelled Graduated Trust governance fixtures (rule agreement).
 *
 * Oracle: backend/eval-fixtures/gt/SPEC.md (gt-governance-oracle-v1)
 * Run: npm run verify:gt-fixtures
 *
 * Pure helpers only (no Prisma, no HTTP). Not production-wide security /
 * CBSL compliance accuracy.
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  resolveTier,
  isValidTransition,
  nextStatusAfterHandler,
  type AgentActionStatus,
} from "../src/lib/agent-engine-core.js"
import { DEFAULT_AGENT_POLICIES } from "../src/lib/agent-defaults.js"
import {
  buildA1InputPayload,
  buildA1PrepareAuditDetails,
  buildA1ReadinessReport,
  evaluateA1ApproveGate,
  type A1ReadinessFacts,
} from "../src/lib/agent-a1-compliance.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packPath = path.join(
  __dirname,
  "../eval-fixtures/gt/gt-governance-fixtures.v1.json"
)

export const GT_RULESET_VERSION = "gt-governance-rules-v1" as const

export const ALLOWED_CATEGORIES = [
  "tier_routing",
  "status_transition",
  "post_handler_status",
  "a1_approve_gate",
] as const
export type FixtureCategory = (typeof ALLOWED_CATEGORIES)[number]

export const ALLOWED_GATE_SCENARIOS = [
  "self_approval",
  "audit_hash_mismatch",
  "valid_separate_users",
] as const
export type GateScenario = (typeof ALLOWED_GATE_SCENARIOS)[number]

/** SPEC G1 — independent of DEFAULT_AGENT_POLICIES array identity. */
export const ORACLE_DEFAULT_ROUTES: Readonly<
  Record<string, { agentId: string; tier: 1 | 2 | 3 | 4 }>
> = {
  nlq_query: { agentId: "A4", tier: 1 },
  budget_threshold_alert: { agentId: "A2", tier: 2 },
  generate_cbsl_report: { agentId: "A1", tier: 3 },
  volume_spike_alert: { agentId: "A3", tier: 4 },
}

const PREPARER_ID = "11111111-1111-4111-8111-111111111111"
const APPROVER_ID = "22222222-2222-4222-8222-222222222222"
const ACTION_ID = "33333333-3333-4333-8333-333333333333"

type Fixture = {
  id: string
  category: string
  description: string
  oracleRef: string
  duplicateOfVerify?: boolean
  input: Record<string, unknown>
  expect: Record<string, unknown>
}

type Pack = {
  specId: string
  rulesetVersion: string
  fixtures: Fixture[]
}

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

export function parseFixtureCategory(
  category: unknown
): { ok: true; value: FixtureCategory } | { ok: false; error: string } {
  if (typeof category !== "string") {
    return { ok: false, error: "category must be a string" }
  }
  if ((ALLOWED_CATEGORIES as readonly string[]).includes(category)) {
    return { ok: true, value: category as FixtureCategory }
  }
  return {
    ok: false,
    error: `unknown category "${category}" (allowed: ${ALLOWED_CATEGORIES.join(", ")})`,
  }
}

export function parseGateScenario(
  scenario: unknown
): { ok: true; value: GateScenario } | { ok: false; error: string } {
  if (typeof scenario !== "string") {
    return { ok: false, error: "scenario must be a string" }
  }
  if ((ALLOWED_GATE_SCENARIOS as readonly string[]).includes(scenario)) {
    return { ok: true, value: scenario as GateScenario }
  }
  return {
    ok: false,
    error: `unknown gate scenario "${scenario}" (allowed: ${ALLOWED_GATE_SCENARIOS.join(", ")})`,
  }
}

/** SPEC G2 — independent of resolveTier implementation. */
export function oracleResolveTier(policy: {
  tier?: number
  isActive?: boolean
} | null | undefined): { tier: 1 | 2 | 3 | 4; isFallback: boolean } {
  if (!policy || policy.isActive !== true) {
    return { tier: 4, isFallback: true }
  }
  const t = policy.tier
  if (t === 1 || t === 2 || t === 3 || t === 4) {
    return { tier: t, isFallback: false }
  }
  return { tier: 4, isFallback: true }
}

/** SPEC G3 — independent of isValidTransition implementation. */
export function oracleValidTransition(
  from: AgentActionStatus,
  to: AgentActionStatus
): boolean {
  if (from === to) return false
  switch (from) {
    case "running":
      return to === "executed" || to === "notified" || to === "failed"
    case "pending_approval":
      return to === "approved" || to === "rejected"
    case "approved":
      return to === "executed" || to === "failed"
    case "rejected":
    case "executed":
    case "notified":
    case "alert_only":
    case "failed":
      return false
    default:
      return false
  }
}

/** SPEC G4 — independent of nextStatusAfterHandler implementation. */
export function oracleNextStatusAfterHandler(
  tier: number,
  handlerSucceeded: boolean
): "executed" | "notified" | "failed" {
  if (!handlerSucceeded) return "failed"
  if (tier === 2) return "notified"
  return "executed"
}

/** SPEC G5 scenario outcomes — independent of evaluateA1ApproveGate. */
export function oracleGateExpect(scenario: GateScenario): {
  ok: boolean
  httpStatus?: 403 | 409
} {
  switch (scenario) {
    case "self_approval":
      return { ok: false, httpStatus: 403 }
    case "audit_hash_mismatch":
      return { ok: false, httpStatus: 409 }
    case "valid_separate_users":
      return { ok: true }
  }
}

/** Minimal synthetic facts for gate fixtures (not a live tenant snapshot). */
function gateSyntheticFacts(): A1ReadinessFacts {
  return {
    institution: {
      tenantInstitutionName: "GT Fixture MFI",
      centralInstitutionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      tenantInfoPresent: true,
    },
    organizational: {
      activeBranchCount: 1,
      totalBranchCount: 1,
      branches: [
        { id: "b1", name: "HQ", district: "Colombo", isActive: true },
      ],
      employeeCount: 1,
      employeesByStatus: { active: 1 },
      employeesMissingEpfNumber: 1,
      employeesMissingEtfNumber: 0,
      payrollRecordCount: 0,
      payrollRecordCountInPeriod: 0,
    },
    governance: {
      generateCbslPolicyActive: true,
      generateCbslPolicyTier: 3,
      agentActionsInPeriod: 0,
      tier3PendingCount: 0,
      tier3ApprovedInPeriod: 0,
      tier3RejectedInPeriod: 0,
      auditLogEntriesInPeriod: 1,
    },
    financialAndPortfolioSlots: {
      status: "not_available",
      loanCount: 0,
      borrowerCount: 0,
      journalEntryCountInPeriod: 0,
      note: "gt-fixture-synthetic",
    },
  }
}

function buildGateCase(scenario: GateScenario): {
  inputPayload: Record<string, unknown>
  approverUserId: string
  prepareAuditDetails: Record<string, unknown>
} {
  const report = buildA1ReadinessReport({
    facts: gateSyntheticFacts(),
    period: {
      startIso: "2026-09-01T00:00:00.000Z",
      endIso: "2026-09-30T23:59:59.000Z",
    },
    generatedAt: "2026-10-16T12:00:00.000Z",
  })
  const inputPayload = buildA1InputPayload(report, {
    preparedByUserId: PREPARER_ID,
  })
  const hash = String(inputPayload.proposalHash)
  const prepareAuditDetails = buildA1PrepareAuditDetails({
    actionId: ACTION_ID,
    proposalHash: hash,
    preparedByUserId: PREPARER_ID,
    overallStatus: report.overallStatus,
  })

  if (scenario === "self_approval") {
    return {
      inputPayload,
      approverUserId: PREPARER_ID,
      prepareAuditDetails,
    }
  }
  if (scenario === "audit_hash_mismatch") {
    return {
      inputPayload,
      approverUserId: APPROVER_ID,
      prepareAuditDetails: {
        ...prepareAuditDetails,
        proposalHash: "a".repeat(64),
      },
    }
  }
  return {
    inputPayload,
    approverUserId: APPROVER_ID,
    prepareAuditDetails,
  }
}

function rate(ok: number, total: number): string {
  if (total === 0) return "n/a"
  return `${ok}/${total} (${((ok / total) * 100).toFixed(1)}%)`
}

function main(): void {
  const raw = fs.readFileSync(packPath, "utf8")
  const pack = JSON.parse(raw) as Pack

  console.log("\n=== GT fixture pack (governance rule agreement) ===")
  console.log(`Spec: ${pack.specId}`)
  console.log(`Pack rulesetVersion: ${pack.rulesetVersion}`)
  console.log(`Eval GT_RULESET_VERSION: ${GT_RULESET_VERSION}`)
  console.log(`Fixtures: ${pack.fixtures.length}`)
  console.log(
    "Disclaimer: not live HTTP auth / not production security / not CBSL compliance.\n"
  )

  assert(
    pack.rulesetVersion === GT_RULESET_VERSION,
    "fixture pack rulesetVersion matches GT_RULESET_VERSION"
  )

  const tallies: Record<
    FixtureCategory,
    { total: number; ok: number }
  > = {
    tier_routing: { total: 0, ok: 0 },
    status_transition: { total: 0, ok: 0 },
    post_handler_status: { total: 0, ok: 0 },
    a1_approve_gate: { total: 0, ok: 0 },
  }
  const mismatches: string[] = []

  for (const f of pack.fixtures) {
    const cat = parseFixtureCategory(f.category)
    if (!cat.ok) {
      mismatches.push(`${f.id}: ${cat.error}`)
      assert(false, `${f.id} category`, cat.error)
      continue
    }

    if (cat.value === "tier_routing") {
      const kind = f.input.kind
      if (kind === "default_policy") {
        const actionType = String(f.input.actionType ?? "")
        const oracle = ORACLE_DEFAULT_ROUTES[actionType]
        if (!oracle) {
          mismatches.push(`${f.id}: unknown actionType in oracle table`)
          assert(false, `${f.id} oracle route`, actionType)
          continue
        }
        const expectAgent = f.expect.agentId
        const expectTier = f.expect.tier
        const expectActive = f.expect.isActive
        if (
          expectAgent !== oracle.agentId ||
          expectTier !== oracle.tier ||
          expectActive !== true
        ) {
          mismatches.push(`${f.id}: expect disagrees with SPEC G1`)
          assert(false, `${f.id} G1 consistency`, "fixture expect ≠ SPEC table")
          continue
        }
        const pol = DEFAULT_AGENT_POLICIES.find((p) => p.actionType === actionType)
        tallies.tier_routing.total++
        const agree =
          pol != null &&
          pol.agentId === oracle.agentId &&
          pol.tier === oracle.tier &&
          pol.isActive === true
        if (agree) {
          tallies.tier_routing.ok++
          assert(true, `${f.id} route ${actionType}→${pol!.agentId}/T${pol!.tier}`)
        } else {
          mismatches.push(`${f.id}: DEFAULT_AGENT_POLICIES mismatch`)
          assert(false, `${f.id} default policy`, "agent/tier/active mismatch")
        }
        continue
      }

      if (kind === "resolve_tier") {
        const policy = f.input.policy as
          | { tier?: number; isActive?: boolean }
          | null
          | undefined
        const o = oracleResolveTier(policy)
        if (
          f.expect.tier !== o.tier ||
          f.expect.isFallback !== o.isFallback
        ) {
          mismatches.push(`${f.id}: expect disagrees with SPEC G2`)
          assert(false, `${f.id} G2 consistency`, "fixture expect ≠ oracle")
          continue
        }
        const actual = resolveTier(policy)
        tallies.tier_routing.total++
        const agree =
          actual.tier === o.tier && actual.isFallback === o.isFallback
        if (agree) {
          tallies.tier_routing.ok++
          assert(
            true,
            `${f.id} resolveTier → T${actual.tier} fallback=${actual.isFallback}`
          )
        } else {
          mismatches.push(
            `${f.id}: resolveTier expected T${o.tier}/${o.isFallback}, got T${actual.tier}/${actual.isFallback}`
          )
          assert(false, `${f.id} resolveTier`)
        }
        continue
      }

      mismatches.push(`${f.id}: unknown tier_routing kind`)
      assert(false, `${f.id} kind`, String(kind))
      continue
    }

    if (cat.value === "status_transition") {
      const from = f.input.from as AgentActionStatus
      const to = f.input.to as AgentActionStatus
      const oAllowed = oracleValidTransition(from, to)
      if (f.expect.allowed !== oAllowed) {
        mismatches.push(`${f.id}: expect disagrees with SPEC G3`)
        assert(false, `${f.id} G3 consistency`)
        continue
      }
      const actual = isValidTransition(from, to)
      tallies.status_transition.total++
      if (actual === oAllowed) {
        tallies.status_transition.ok++
        assert(true, `${f.id} ${from}→${to} allowed=${actual}`)
      } else {
        mismatches.push(
          `${f.id}: transition expected ${oAllowed}, got ${actual}`
        )
        assert(false, `${f.id} transition`)
      }
      continue
    }

    if (cat.value === "post_handler_status") {
      const tier = Number(f.input.tier)
      const handlerSucceeded = Boolean(f.input.handlerSucceeded)
      const oStatus = oracleNextStatusAfterHandler(tier, handlerSucceeded)
      if (f.expect.status !== oStatus) {
        mismatches.push(`${f.id}: expect disagrees with SPEC G4`)
        assert(false, `${f.id} G4 consistency`)
        continue
      }
      const actual = nextStatusAfterHandler(tier, handlerSucceeded)
      tallies.post_handler_status.total++
      if (actual === oStatus) {
        tallies.post_handler_status.ok++
        assert(true, `${f.id} tier=${tier} → ${actual}`)
      } else {
        mismatches.push(
          `${f.id}: post-handler expected ${oStatus}, got ${actual}`
        )
        assert(false, `${f.id} post-handler`)
      }
      continue
    }

    if (cat.value === "a1_approve_gate") {
      const sc = parseGateScenario(f.input.scenario)
      if (!sc.ok) {
        mismatches.push(`${f.id}: ${sc.error}`)
        assert(false, `${f.id} scenario`, sc.error)
        continue
      }
      const o = oracleGateExpect(sc.value)
      if (f.expect.ok !== o.ok) {
        mismatches.push(`${f.id}: expect.ok disagrees with SPEC G5`)
        assert(false, `${f.id} G5 consistency`)
        continue
      }
      if (o.httpStatus != null && f.expect.httpStatus !== o.httpStatus) {
        mismatches.push(`${f.id}: expect.httpStatus disagrees with SPEC G5`)
        assert(false, `${f.id} G5 httpStatus consistency`)
        continue
      }
      const gateInput = buildGateCase(sc.value)
      const actual = evaluateA1ApproveGate(gateInput)
      tallies.a1_approve_gate.total++
      const agree =
        actual.ok === o.ok &&
        (o.ok ||
          (!actual.ok &&
            o.httpStatus != null &&
            actual.httpStatus === o.httpStatus))
      if (agree) {
        tallies.a1_approve_gate.ok++
        assert(
          true,
          `${f.id} gate ${sc.value} ok=${actual.ok}` +
            (!actual.ok ? ` http=${actual.httpStatus}` : "")
        )
      } else {
        mismatches.push(
          `${f.id}: gate expected ok=${o.ok}` +
            (o.httpStatus != null ? ` http=${o.httpStatus}` : "") +
            `, got ok=${actual.ok}` +
            (!actual.ok ? ` http=${actual.httpStatus}` : "")
        )
        assert(false, `${f.id} approve gate`)
      }
      continue
    }
  }

  console.log("\n=== Agreement by category (not security / not CBSL) ===")
  console.log(`  Tier routing:     ${rate(tallies.tier_routing.ok, tallies.tier_routing.total)}`)
  console.log(
    `  Transitions:      ${rate(tallies.status_transition.ok, tallies.status_transition.total)}`
  )
  console.log(
    `  Post-handler:     ${rate(tallies.post_handler_status.ok, tallies.post_handler_status.total)}`
  )
  console.log(
    `  Approve gates:    ${rate(tallies.a1_approve_gate.ok, tallies.a1_approve_gate.total)}`
  )

  if (mismatches.length > 0) {
    console.log("\n=== Mismatches ===")
    for (const m of mismatches) console.log(`  - ${m}`)
  }

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed === 0 ? 0 : 1)
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
