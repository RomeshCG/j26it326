/**
 * One-shot, idempotent repair: insert missing DEFAULT_AGENT_POLICIES into the
 * Apex demo tenant DB resolved the same way as the running API.
 *
 * Safety:
 * - Resolves via central institution id (not TENANT_DATABASE_URL alone).
 * - Refuses unless institution name / dbIdentifier match Apex demo expectations.
 * - createMany skipDuplicates / only missing actionTypes.
 * - Never prints connection strings or secrets.
 *
 * Run: npx tsx scripts/_repair-apex-gt-policies.ts
 */
import "dotenv/config"
import { DEFAULT_AGENT_POLICIES } from "../src/lib/agent-defaults.js"
import { resolveTenantByInstitutionId } from "../src/lib/tenant-context.js"
import { centralPrisma } from "../src/lib/prisma-central.js"

const APEX_INSTITUTION_ID = "00000000-0000-4000-8000-000000000001"
const EXPECTED_DB_IDENTIFIER = "tenant_apex_demo"
const ZZ_INSTITUTION_ID = "33b6545d-7c78-4354-a017-d0717efba3b8"

async function main(): Promise<number> {
  const institution = await centralPrisma.institution.findUnique({
    where: { id: APEX_INSTITUTION_ID },
    select: { id: true, name: true, status: true },
  })
  if (!institution) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "apex_institution_not_found",
        institutionId: APEX_INSTITUTION_ID,
      })
    )
    return 2
  }

  const nameOk = /apex/i.test(institution.name)
  if (!nameOk || institution.id === ZZ_INSTITUTION_ID) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "institution_identity_mismatch",
        nameLooksLikeApex: nameOk,
        status: institution.status,
      })
    )
    return 2
  }

  // Confirm apex.lk admin (if present) maps to this institution
  const apexAdmin = await centralPrisma.user.findFirst({
    where: { email: { endsWith: "@apex.lk" }, status: "active" },
    select: { email: true, institutionId: true },
    orderBy: { email: "asc" },
  })
  if (apexAdmin && apexAdmin.institutionId !== APEX_INSTITUTION_ID) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "apex_user_institution_mismatch",
        adminEmailDomain: "@apex.lk",
        mapsToApexDemoId: false,
      })
    )
    return 2
  }

  const resolved = await resolveTenantByInstitutionId(APEX_INSTITUTION_ID)
  if (!resolved.ok) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "tenant_resolve_failed",
        status: resolved.status,
        message: resolved.message,
      })
    )
    return 2
  }

  if (resolved.dbIdentifier !== EXPECTED_DB_IDENTIFIER) {
    console.log(
      JSON.stringify({
        ok: false,
        error: "db_identifier_not_apex_demo",
        dbIdentifier: resolved.dbIdentifier,
        expected: EXPECTED_DB_IDENTIFIER,
      })
    )
    return 2
  }

  const before = await resolved.prisma.agentTierPolicy.findMany({
    select: {
      actionType: true,
      agentId: true,
      agentName: true,
      tier: true,
      isActive: true,
    },
    orderBy: { actionType: "asc" },
  })
  const existingTypes = new Set(before.map((p) => p.actionType))
  const missing = DEFAULT_AGENT_POLICIES.filter(
    (p) => !existingTypes.has(p.actionType)
  )

  console.log(
    JSON.stringify(
      {
        phase: "pre_write",
        institutionName: institution.name,
        institutionStatus: institution.status,
        dbIdentifier: resolved.dbIdentifier,
        apexAdminPresent: !!apexAdmin,
        apexAdminMapsToDemoId: apexAdmin
          ? apexAdmin.institutionId === APEX_INSTITUTION_ID
          : null,
        policyCountBefore: before.length,
        existingActionTypes: before.map((p) => p.actionType),
        missingActionTypes: missing.map((p) => p.actionType),
      },
      null,
      2
    )
  )

  if (missing.length === 0) {
    console.log(
      JSON.stringify({
        phase: "skip_write",
        reason: "all_default_policies_already_present",
        policies: before,
      })
    )
    return 0
  }

  const created = await resolved.prisma.agentTierPolicy.createMany({
    data: missing.map((p) => ({ ...p })),
    skipDuplicates: true,
  })

  const after = await resolved.prisma.agentTierPolicy.findMany({
    select: {
      actionType: true,
      agentId: true,
      agentName: true,
      tier: true,
      isActive: true,
    },
    orderBy: { actionType: "asc" },
  })
  const nlq = after.find((p) => p.actionType === "nlq_query") ?? null

  console.log(
    JSON.stringify(
      {
        phase: "post_write",
        createdCount: created.count,
        policyCountAfter: after.length,
        policies: after,
        nlq_query_ok:
          !!nlq &&
          nlq.isActive === true &&
          nlq.tier === 1 &&
          nlq.agentId === "A4" &&
          nlq.agentName === "NLQ",
      },
      null,
      2
    )
  )

  return nlq &&
    nlq.isActive &&
    nlq.tier === 1 &&
    nlq.agentId === "A4" &&
    nlq.agentName === "NLQ"
    ? 0
    : 1
}

main()
  .then(async (code) => {
    await centralPrisma.$disconnect()
    process.exit(code)
  })
  .catch(async (e) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message.slice(0, 200) : "fatal",
      })
    )
    await centralPrisma.$disconnect()
    process.exit(2)
  })
