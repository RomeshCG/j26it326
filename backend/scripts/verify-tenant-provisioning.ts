import "dotenv/config"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { comparePassword, logSafeError } from "../src/lib/auth.js"
import {
  provisionTenant,
  isSafeToDropDb,
  safelyDropTenantDatabase,
} from "../src/lib/provisioning-service.js"
import { resolveTenantByInstitutionId } from "../src/lib/tenant-context.js"
import { evaluateRegistrationGate } from "../src/routes/registration.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendDir = path.resolve(__dirname, "..")

/**
 * End-to-end verification script for Phase 6 Tenant Provisioning.
 *
 * NOTE: DO NOT RUN WITHOUT EXPLICIT USER APPROVAL.
 * Restricted to port 5436 only.
 */
async function runProvisioningVerification() {
  const envVarName = "CENTRAL_DATABASE_URL"
  const rawDbUrl = process.env[envVarName]
  if (!rawDbUrl) {
    console.error(`FATAL: ${envVarName} is not set.`)
    process.exit(1)
  }

  let dbHost = "unknown"
  let dbPort: number | null = null
  let centralDbName = "neondb"
  try {
    const parsed = new URL(rawDbUrl)
    dbHost = parsed.hostname
    dbPort = parsed.port ? parseInt(parsed.port, 10) : 5432
    centralDbName = parsed.pathname.replace(/^\//, "") || "neondb"
  } catch {
    console.error(`FATAL: Could not parse ${envVarName}.`)
    process.exit(1)
  }

  // Print variable NAME, host, and port ONLY
  console.log(`[Safety Guard] Env Variable: ${envVarName}, Host: ${dbHost}, Port: ${dbPort}`)
  if (dbPort !== 5436) {
    console.error(`FATAL: Verification script is restricted to port 5436 only. (Current port: ${dbPort}). Aborting.`)
    process.exit(1)
  }

  // Baseline row & physical database counts
  const baselineInstitutions = await centralPrisma.institution.count()
  const baselineUsers = await centralPrisma.user.count()
  const baselineSubscriptions = await centralPrisma.subscription.count()
  const baselineConfigs = await centralPrisma.systemConfiguration.count()
  const baselineInstDbs = await centralPrisma.institutionDatabase.count()
  const baselineDomains = await centralPrisma.institutionDomain.count()

  const dbRows = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
    `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
  )
  const baselineTenantDbs = Number(dbRows[0]?.count ?? 0)

  console.log(
    `[Baseline Counts] Institutions: ${baselineInstitutions}, Users: ${baselineUsers}, ` +
    `Subscriptions: ${baselineSubscriptions}, Configs: ${baselineConfigs}, ` +
    `InstDbs: ${baselineInstDbs}, Domains: ${baselineDomains}, Physical Tenant DBs: ${baselineTenantDbs}\n`
  )

  const timestamp = Date.now()
  const randomRunPassword = crypto.randomBytes(12).toString("hex") + "A1!"
  const syntheticInstName = `test-prov-${timestamp}`
  const syntheticAdminEmail = `admin@${syntheticInstName}.lk`
  const syntheticMarkerLicense = "SYNTHETIC-TEST"

  let passed = 0
  let total = 0
  let anyTestFailed = false

  function assert(condition: boolean, testName: string, detail?: string) {
    total++
    if (condition) {
      passed++
      console.log(`[PASS] ${testName}`)
    } else {
      anyTestFailed = true
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`)
    }
  }

  // Tracking arrays for guaranteed cleanup (push immediately upon creation)
  const createdInstitutionIds: string[] = []
  const createdUserIds: string[] = []
  const createdPhysicalDbs: string[] = []
  const createdDomainIds: string[] = []

  try {
    console.log("=== Phase 6 Tenant Provisioning Verification ===")
    console.log(`Synthetic Institution: ${syntheticInstName}`)
    console.log(`Synthetic Admin Email: ${syntheticAdminEmail}`)
    console.log(`Synthetic Marker License: ${syntheticMarkerLicense}\n`)

    // ------------------------------------------------------------------------
    // Test (a): Pure Abuse Gate Matrix & .env.example Validation
    // ------------------------------------------------------------------------
    console.log("--- Test (a): Abuse Gate Pure Matrix & .env.example ---")

    // 1. Assert .env.example contains ENABLE_PUBLIC_TENANT_REGISTRATION=false
    const examplePath = path.resolve(backendDir, ".env.example")
    const exampleContent = fs.readFileSync(examplePath, "utf8")
    assert(
      exampleContent.includes("ENABLE_PUBLIC_TENANT_REGISTRATION=false"),
      ".env.example contains ENABLE_PUBLIC_TENANT_REGISTRATION=false"
    )

    // 2. Disabled -> 403
    const gateDisabled = evaluateRegistrationGate({ enabled: false, nodeEnv: "development" })
    assert(!gateDisabled.allowed && gateDisabled.status === 403, "evaluateRegistrationGate: disabled -> 403")

    // 3. Enabled in development -> allowed
    const gateDev = evaluateRegistrationGate({ enabled: true, nodeEnv: "development" })
    assert(gateDev.allowed && gateDev.status === 200, "evaluateRegistrationGate: enabled in development -> allowed (200)")

    // 4. Enabled in production with no configured key -> refused (403)
    const gateProdNoKey = evaluateRegistrationGate({
      enabled: true,
      nodeEnv: "production",
      configuredKey: null,
      clientKey: "some-key",
    })
    assert(!gateProdNoKey.allowed && gateProdNoKey.status === 403, "evaluateRegistrationGate: production with no configured key -> 403")

    // 5. Enabled in production with wrong key -> 403
    const testSetupKey = crypto.randomBytes(16).toString("hex")
    const testWrongKey = crypto.randomBytes(16).toString("hex")
    const gateProdWrongKey = evaluateRegistrationGate({
      enabled: true,
      nodeEnv: "production",
      configuredKey: testSetupKey,
      clientKey: testWrongKey,
    })
    assert(!gateProdWrongKey.allowed && gateProdWrongKey.status === 403, "evaluateRegistrationGate: production with wrong key -> 403")

    // 6. Enabled in production with right key -> allowed (200)
    const gateProdRightKey = evaluateRegistrationGate({
      enabled: true,
      nodeEnv: "production",
      configuredKey: testSetupKey,
      clientKey: testSetupKey,
    })
    assert(gateProdRightKey.allowed && gateProdRightKey.status === 200, "evaluateRegistrationGate: production with right key -> allowed (200)")

    // ------------------------------------------------------------------------
    // 1. Strict Validation Error Checks (Guards against non-strings & invalid values)
    // ------------------------------------------------------------------------
    console.log("\n--- 1. Strict Input Validation Handling ---")
    const shortNameRes = await provisionTenant({
      institutionName: "Ab",
      adminFullName: "Valid Admin",
      adminEmail: "admin@valid.lk",
      adminPassword: randomRunPassword,
    })
    assert(!shortNameRes.success && shortNameRes.status === 400, "Rejects institutionName shorter than 3 characters (400)")

    const nonStringNameRes = await provisionTenant({
      institutionName: 12345 as any,
      adminFullName: "Valid Admin",
      adminEmail: "admin@valid.lk",
      adminPassword: randomRunPassword,
    })
    assert(!nonStringNameRes.success && nonStringNameRes.status === 400, "Rejects non-string institutionName (400)")

    const invalidEmailRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: "invalid-email-address",
      adminPassword: randomRunPassword,
    })
    assert(!invalidEmailRes.success && invalidEmailRes.status === 400, "Rejects malformed admin email address (400)")

    const shortPassRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: "short",
    })
    assert(!shortPassRes.success && shortPassRes.status === 400, "Rejects adminPassword shorter than 8 bytes (400)")

    const invalidTypeRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
      institutionType: "invalid_unsupported_type",
    })
    assert(!invalidTypeRes.success && invalidTypeRes.status === 400, "Rejects unsupported institutionType (400)")

    const invalidDistrictRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
      district: "Atlantis",
    })
    assert(!invalidDistrictRes.success && invalidDistrictRes.status === 400, "Rejects non-Sri Lankan district (400)")

    const invalidPlanRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
      planName: "MegaPlan",
    })
    assert(!invalidPlanRes.success && invalidPlanRes.status === 400, "Rejects unsupported planName (400)")

    const invalidBillingRes = await provisionTenant({
      institutionName: syntheticInstName,
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
      billingCycle: "weekly",
    })
    assert(!invalidBillingRes.success && invalidBillingRes.status === 400, "Rejects unsupported billingCycle (400)")

    const longLicenseRes = await provisionTenant({
      institutionName: syntheticInstName,
      licenseNumber: "X".repeat(55),
      adminFullName: "Valid Admin",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
    })
    assert(!longLicenseRes.success && longLicenseRes.status === 400, "Rejects licenseNumber longer than 50 characters (400)")

    // ------------------------------------------------------------------------
    // 2. Successful End-to-End Tenant Provisioning
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Successful End-to-End Tenant Provisioning ---")
    const provResult = await provisionTenant({
      institutionName: syntheticInstName,
      licenseNumber: syntheticMarkerLicense,
      adminFullName: "Synthetic Admin User",
      adminEmail: syntheticAdminEmail,
      adminPassword: randomRunPassword,
      institutionType: "microfinance_ngo",
      district: "Colombo",
      planName: "Starter",
      billingCycle: "monthly",
    })

    assert(provResult.success && provResult.status === 201, "Tenant provisioning succeeds with 201 Created")
    const newInstId = provResult.data?.institution.id
    const newAdminId = provResult.data?.admin.id
    if (newInstId) createdInstitutionIds.push(newInstId)
    if (newAdminId) createdUserIds.push(newAdminId)

    // Inspect database record in central and track physical database name immediately
    const dbRecord = await centralPrisma.institutionDatabase.findFirst({
      where: { institutionId: newInstId },
    })
    if (dbRecord) {
      createdPhysicalDbs.push(dbRecord.dbName)
      assert(dbRecord.status === "active", "institution_databases status is 'active'")
      assert(dbRecord.dbPort === 5436, "Tenant database created on port 5436 only")
      assert(/^imfs_tenant_[a-z0-9_]+$/.test(dbRecord.dbName), "Tenant database name matches strict security format")
    }

    // Inspect physical database existence in pg_database
    const pgCheck = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname = $1`,
      dbRecord?.dbName
    )
    assert(Number(pgCheck[0]?.count ?? 0) === 1, "Physical PostgreSQL database confirmed present in pg_database")

    // ------------------------------------------------------------------------
    // 3. Verify Tenant DB Schema & Bootstrap Data
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Verifying Bootstrapped Tenant Data ---")
    const resolution = await resolveTenantByInstitutionId(newInstId!)
    assert(resolution.ok, "Tenant routing resolution succeeds for new institution")

    if (resolution.ok) {
      const tenantPrisma = resolution.prisma
      const tenantInfo = await tenantPrisma.tenantInfo.findUnique({ where: { id: 1 } })
      assert(
        tenantInfo?.institutionName === syntheticInstName && tenantInfo?.institutionId === newInstId,
        "tenant_info table bootstrapped with institutionId and name"
      )

      const hqBranch = await tenantPrisma.branch.findFirst({ where: { name: "Head Office" } })
      assert(hqBranch?.district === "Colombo", "Head Office branch created with district 'Colombo'")

      const adminEmp = await tenantPrisma.employee.findUnique({ where: { userId: newAdminId } })
      assert(
        adminEmp?.position === "Administrator" && adminEmp?.branchId === hqBranch?.id,
        "Admin employee record created in tenant database linked to Head Office"
      )
    }

    // ------------------------------------------------------------------------
    // 4. Test (f): Direct Admin Authentication Verification
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Direct Authentication & Status Verification ---")
    const centralUser = await centralPrisma.user.findUnique({
      where: { email: syntheticAdminEmail },
      include: { institution: true, role: true },
    })
    assert(!!centralUser, "Central user record exists")

    const passwordMatches = await comparePassword(randomRunPassword, centralUser?.passwordHash ?? "")
    assert(passwordMatches, "Stored passwordHash validates with run password")
    assert(centralUser?.status === "active", "Admin user status is 'active'")
    assert(centralUser?.institution.status === "active", "Institution status is 'active'")
    assert(centralUser?.role.name === "admin", "Admin role assigned")

    // ------------------------------------------------------------------------
    // 5. Pre-Hijack and Duplicate Conflict Prevention
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Conflict & Pre-Hijack Prevention ---")
    // (a) Duplicate existing email
    const dupRes = await provisionTenant({
      institutionName: `${syntheticInstName}-dup`,
      licenseNumber: syntheticMarkerLicense,
      adminFullName: "Duplicate Admin",
      adminEmail: syntheticAdminEmail, // Existing email
      adminPassword: randomRunPassword,
    })
    assert(
      !dupRes.success && dupRes.status === 400 && dupRes.error === "Registration request could not be processed",
      "Duplicate email registration rejected with generic 400 timing-safe message"
    )

    // (b) Pre-hijack: Verified domain claim exists for another institution
    const hijackDomainName = `test-prov-hijack-${timestamp}.lk`
    const loanOfficerRole = await centralPrisma.role.findFirstOrThrow({ where: { name: "loan_officer" } })
    const verifiedDomainRecord = await centralPrisma.institutionDomain.create({
      data: {
        institutionId: newInstId!,
        domain: hijackDomainName,
        status: "verified",
        defaultRoleId: loanOfficerRole.id,
      },
    })
    createdDomainIds.push(verifiedDomainRecord.id)

    const instCountBeforeHijack = await centralPrisma.institution.count()
    const dbCountBeforeHijack = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )

    const hijackRes = await provisionTenant({
      institutionName: `${syntheticInstName}-hijack`,
      licenseNumber: syntheticMarkerLicense,
      adminFullName: "Attacker Admin",
      adminEmail: `attacker@${hijackDomainName}`,
      adminPassword: randomRunPassword,
    })

    assert(
      !hijackRes.success && hijackRes.status === 400 && hijackRes.error === "Registration request could not be processed",
      "Pre-hijack attempt with email on verified domain rejected with generic 400"
    )

    const instCountAfterHijack = await centralPrisma.institution.count()
    const dbCountAfterHijack = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )

    assert(instCountBeforeHijack === instCountAfterHijack, "Pre-hijack attempt created NO new institution")
    assert(
      Number(dbCountBeforeHijack[0]?.count ?? 0) === Number(dbCountAfterHijack[0]?.count ?? 0),
      "Pre-hijack attempt created NO new tenant database"
    )

    // ------------------------------------------------------------------------
    // 6. Rollback Test: Simulated Mid-Provisioning Failure via _simulatedFailureStep
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Rollback Verification (Simulated Failure via _simulatedFailureStep) ---")
    const dbsBeforeSim = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )

    const simFailRes = await provisionTenant({
      institutionName: `${syntheticInstName}-simfail`,
      licenseNumber: syntheticMarkerLicense,
      adminFullName: "Simfail Admin",
      adminEmail: `simfail@${syntheticInstName}.lk`,
      adminPassword: randomRunPassword,
      _simulatedFailureStep: "migration", // Triggers rollback after physical DB creation
    })

    assert(!simFailRes.success && simFailRes.status === 500, "Simulated migration failure triggers 500 response")

    const dbsAfterSim = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )
    assert(
      Number(dbsBeforeSim[0]?.count ?? 0) === Number(dbsAfterSim[0]?.count ?? 0),
      "Rollback dropped physical database: physical DB count unchanged"
    )

    const leftoverInst = await centralPrisma.institution.findFirst({
      where: { name: `${syntheticInstName}-simfail` },
    })
    assert(!leftoverInst, "Rollback removed central institution row")
  } catch (error) {
    logSafeError("[verify-tenant-provisioning] Test failed unexpectedly", error)
    anyTestFailed = true
  } finally {
    console.log("\n--- Cleaning Up Synthetic Entities & Physical Databases ---")

    // 1. Drop physical databases created by this script with isSafeToDropDb guard
    for (const dbName of createdPhysicalDbs) {
      if (isSafeToDropDb(dbName, centralDbName)) {
        console.log(`Dropping synthetic tenant database: ${dbName}`)
        await safelyDropTenantDatabase(dbName, centralDbName)
      } else {
        console.warn(`Skipping unsafe database name: ${dbName}`)
      }
    }

    // 2. Union all users whose institutionId is in createdInstitutionIds with createdUserIds
    let allUserIdsToDelete: string[] = [...createdUserIds]
    try {
      if (createdInstitutionIds.length > 0) {
        const instUsers = await centralPrisma.user.findMany({
          where: { institutionId: { in: createdInstitutionIds } },
          select: { id: true },
        })
        const instUserIds = instUsers.map((u) => u.id)
        allUserIdsToDelete = Array.from(new Set([...allUserIdsToDelete, ...instUserIds]))
      }
    } catch (err) {
      logSafeError("[cleanup] Failed to collect institution users", err)
    }

    // 3. Delete login_audit rows
    if (allUserIdsToDelete.length > 0) {
      try {
        const audits = await centralPrisma.loginAudit.deleteMany({
          where: { userId: { in: allUserIdsToDelete } },
        })
        console.log(`Cleaned up ${audits.count} login_audit row(s).`)
      } catch (err) {
        logSafeError("[cleanup] loginAudit", err)
      }

      // 4. Delete users
      try {
        const users = await centralPrisma.user.deleteMany({
          where: { id: { in: allUserIdsToDelete } },
        })
        console.log(`Cleaned up ${users.count} synthetic user(s).`)
      } catch (err) {
        logSafeError("[cleanup] user", err)
      }
    }

    // 5. Delete synthetic institution_domains
    if (createdDomainIds.length > 0 || createdInstitutionIds.length > 0) {
      try {
        const doms = await centralPrisma.institutionDomain.deleteMany({
          where: {
            OR: [
              { id: { in: createdDomainIds } },
              { institutionId: { in: createdInstitutionIds } },
            ],
          },
        })
        console.log(`Cleaned up ${doms.count} synthetic domain(s).`)
      } catch (err) {
        logSafeError("[cleanup] institutionDomain", err)
      }
    }

    // 6. Delete central institution metadata
    if (createdInstitutionIds.length > 0) {
      try {
        const dbs = await centralPrisma.institutionDatabase.deleteMany({
          where: { institutionId: { in: createdInstitutionIds } },
        })
        console.log(`Cleaned up ${dbs.count} institution_database row(s).`)
      } catch (err) {
        logSafeError("[cleanup] institutionDatabase", err)
      }

      try {
        const cfgs = await centralPrisma.systemConfiguration.deleteMany({
          where: { institutionId: { in: createdInstitutionIds } },
        })
        console.log(`Cleaned up ${cfgs.count} system_configuration row(s).`)
      } catch (err) {
        logSafeError("[cleanup] systemConfiguration", err)
      }

      try {
        const subs = await centralPrisma.subscription.deleteMany({
          where: { institutionId: { in: createdInstitutionIds } },
        })
        console.log(`Cleaned up ${subs.count} subscription row(s).`)
      } catch (err) {
        logSafeError("[cleanup] subscription", err)
      }

      try {
        const insts = await centralPrisma.institution.deleteMany({
          where: { id: { in: createdInstitutionIds } },
        })
        console.log(`Cleaned up ${insts.count} institution row(s).`)
      } catch (err) {
        logSafeError("[cleanup] institution", err)
      }
    }

    // ------------------------------------------------------------------------
    // Baseline Recount & Cleanup Completeness Check
    // ------------------------------------------------------------------------
    const postInstitutions = await centralPrisma.institution.count()
    const postUsers = await centralPrisma.user.count()
    const postSubscriptions = await centralPrisma.subscription.count()
    const postConfigs = await centralPrisma.systemConfiguration.count()
    const postInstDbs = await centralPrisma.institutionDatabase.count()
    const postDomains = await centralPrisma.institutionDomain.count()

    const postDbRows = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )
    const postTenantDbs = Number(postDbRows[0]?.count ?? 0)

    console.log(`\n[Cleanup Verification]`)
    console.log(`Institutions: Baseline = ${baselineInstitutions}, Post = ${postInstitutions} (Diff: ${postInstitutions - baselineInstitutions})`)
    console.log(`Users:        Baseline = ${baselineUsers}, Post = ${postUsers} (Diff: ${postUsers - baselineUsers})`)
    console.log(`Subs:         Baseline = ${baselineSubscriptions}, Post = ${postSubscriptions} (Diff: ${postSubscriptions - baselineSubscriptions})`)
    console.log(`Configs:      Baseline = ${baselineConfigs}, Post = ${postConfigs} (Diff: ${postConfigs - baselineConfigs})`)
    console.log(`InstDbs:      Baseline = ${baselineInstDbs}, Post = ${postInstDbs} (Diff: ${postInstDbs - baselineInstDbs})`)
    console.log(`Domains:      Baseline = ${baselineDomains}, Post = ${postDomains} (Diff: ${postDomains - baselineDomains})`)
    console.log(`Tenant DBs:   Baseline = ${baselineTenantDbs}, Post = ${postTenantDbs} (Diff: ${postTenantDbs - baselineTenantDbs})`)

    const cleanupComplete =
      baselineInstitutions === postInstitutions &&
      baselineUsers === postUsers &&
      baselineSubscriptions === postSubscriptions &&
      baselineConfigs === postConfigs &&
      baselineInstDbs === postInstDbs &&
      baselineDomains === postDomains &&
      baselineTenantDbs === postTenantDbs

    if (cleanupComplete) {
      console.log("Cleanup verified: Row counts and physical databases restored to baseline perfectly.")
    } else {
      console.error("FAIL: CLEANUP INCOMPLETE! Leftover entities or databases detected.")
    }

    await centralPrisma.$disconnect()
    console.log(`\nFinal Summary: ${passed}/${total} checks passed.`)

    if (anyTestFailed || !cleanupComplete) {
      process.exitCode = 1
    }
  }
}

if (process.argv[1]?.includes("verify-tenant-provisioning")) {
  runProvisioningVerification().catch((err) => {
    logSafeError("Verification script failed unexpectedly", err)
    process.exit(1)
  })
}
