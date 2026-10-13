import "dotenv/config"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { logSafeError } from "../src/lib/auth.js"
import { isSafeToDropDb, safelyDropTenantDatabase } from "../src/lib/provisioning-service.js"

/**
 * Cleanup script for synthetic test tenants created during testing.
 *
 * NOTE: DO NOT RUN WITHOUT EXPLICIT USER APPROVAL.
 * Restricted to port 5436 only.
 * Only targets institutions matching test prefixes ('test-prov-%' or 'test-cleanup-%').
 */
async function runTenantCleanup() {
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

  console.log(`[Safety Guard] Env Variable: ${envVarName}, Host: ${dbHost}, Port: ${dbPort}`)
  if (dbPort !== 5436) {
    console.error(`FATAL: Cleanup script is restricted to port 5436 only. (Current port: ${dbPort}). Aborting.`)
    process.exit(1)
  }

  // Baseline database & central entity counts
  const baselineInstitutions = await centralPrisma.institution.count()
  const baselineUsers = await centralPrisma.user.count()
  const dbRows = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
    `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
  )
  const baselineTenantDbs = Number(dbRows[0]?.count ?? 0)

  console.log(`[Baseline Counts] Institutions: ${baselineInstitutions}, Users: ${baselineUsers}, Tenant DBs: ${baselineTenantDbs}\n`)

  try {
    // Find synthetic test institutions matching BOTH name prefix AND licenseNumber marker 'SYNTHETIC-TEST'
    const testInstitutions = await centralPrisma.institution.findMany({
      where: {
        licenseNumber: "SYNTHETIC-TEST",
        OR: [
          { name: { startsWith: "test-prov-" } },
          { name: { startsWith: "test-cleanup-" } },
        ],
      },
      include: {
        databases: true,
        users: true,
      },
    })

    console.log(`Found ${testInstitutions.length} synthetic test institution(s) to clean up.`)

    for (const inst of testInstitutions) {
      console.log(`\nCleaning up institution: ${inst.name} (${inst.id})`)

      // 1. Drop physical tenant databases registered to this test institution
      for (const dbRec of inst.databases) {
        if (isSafeToDropDb(dbRec.dbName, centralDbName)) {
          console.log(`Dropping verified tenant DB: ${dbRec.dbName}`)
          await safelyDropTenantDatabase(dbRec.dbName, centralDbName)
        } else {
          console.warn(`Skipping unsafe database name: ${dbRec.dbName}`)
        }
      }

      // 2. Delete login_audit rows
      const userIds = inst.users.map((u) => u.id)
      if (userIds.length > 0) {
        try {
          const audits = await centralPrisma.loginAudit.deleteMany({
            where: { userId: { in: userIds } },
          })
          console.log(`Cleaned up ${audits.count} login_audit row(s).`)
        } catch (err) {
          logSafeError("[cleanup] loginAudit delete", err)
        }

        // 3. Delete users
        try {
          const deletedUsers = await centralPrisma.user.deleteMany({
            where: { id: { in: userIds } },
          })
          console.log(`Cleaned up ${deletedUsers.count} user(s).`)
        } catch (err) {
          logSafeError("[cleanup] user delete", err)
        }
      }

      // 4. Delete institution_databases
      try {
        const deletedDbs = await centralPrisma.institutionDatabase.deleteMany({
          where: { institutionId: inst.id },
        })
        console.log(`Cleaned up ${deletedDbs.count} institution_database record(s).`)
      } catch (err) {
        logSafeError("[cleanup] institutionDatabase delete", err)
      }

      // 5. Delete system_configurations
      try {
        const deletedConfigs = await centralPrisma.systemConfiguration.deleteMany({
          where: { institutionId: inst.id },
        })
        console.log(`Cleaned up ${deletedConfigs.count} system_configuration record(s).`)
      } catch (err) {
        logSafeError("[cleanup] systemConfiguration delete", err)
      }

      // 6. Delete subscriptions
      try {
        const deletedSubs = await centralPrisma.subscription.deleteMany({
          where: { institutionId: inst.id },
        })
        console.log(`Cleaned up ${deletedSubs.count} subscription record(s).`)
      } catch (err) {
        logSafeError("[cleanup] subscription delete", err)
      }

      // 7. Delete institution
      try {
        await centralPrisma.institution.delete({
          where: { id: inst.id },
        })
        console.log(`Cleaned up institution record ${inst.id}.`)
      } catch (err) {
        logSafeError("[cleanup] institution delete", err)
      }
    }

    // Recount
    const postInstitutions = await centralPrisma.institution.count()
    const postUsers = await centralPrisma.user.count()
    const postDbRows = await centralPrisma.$queryRawUnsafe<Array<{ count: string | number }>>(
      `SELECT count(*) FROM pg_database WHERE datname LIKE 'imfs_tenant_%'`
    )
    const postTenantDbs = Number(postDbRows[0]?.count ?? 0)

    console.log(`\n[Post Cleanup Counts]`)
    console.log(`Institutions: ${postInstitutions} (was ${baselineInstitutions})`)
    console.log(`Users:        ${postUsers} (was ${baselineUsers})`)
    console.log(`Tenant DBs:   ${postTenantDbs} (was ${baselineTenantDbs})`)
  } catch (error) {
    logSafeError("[cleanup-test-tenants] Unexpected fatal error", error)
    process.exitCode = 1
  } finally {
    await centralPrisma.$disconnect()
  }
}

if (process.argv[1]?.includes("cleanup-test-tenants")) {
  runTenantCleanup().catch((err) => {
    logSafeError("Cleanup script failed", err)
    process.exit(1)
  })
}
