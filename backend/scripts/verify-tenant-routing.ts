import "dotenv/config"
import { centralPrisma } from "../src/lib/prisma-central.js"
import {
  resolveTenantByInstitutionId,
  resolveTenantByDbIdentifier,
  invalidateTenantRouting,
  clearRoutingCache,
} from "../src/lib/tenant-context.js"
import {
  getTenantPrisma,
  acquireTenantClient,
  releaseTenantClient,
  disconnectAllTenantClients,
  getTenantPoolStats,
} from "../src/lib/prisma-tenant.js"

const DEMO_INSTITUTION_ID = "00000000-0000-4000-8000-000000000001"
const NON_EXISTENT_ID = "99999999-9999-4999-8999-999999999999"

async function runTests() {
  console.log("=== IMFS M4: Phase 1 Tenant Routing Verification ===\n")
  let passed = 0
  let total = 0

  function assert(condition: boolean, testName: string, detail?: string) {
    total++
    if (condition) {
      passed++
      console.log(`[PASS] ${testName}`)
    } else {
      console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ""}`)
    }
  }

  try {
    // -------------------------------------------------------------------------
    // Test 1: Resolve demo institution and read tenant_info from imfs_tenant_apex
    // -------------------------------------------------------------------------
    console.log("-> Test 1: Resolving demo institution...")
    const demoResolution = await resolveTenantByInstitutionId(DEMO_INSTITUTION_ID)
    assert(
      demoResolution.ok === true,
      "Demo institution resolves successfully",
      demoResolution.ok ? undefined : demoResolution.message
    )

    if (demoResolution.ok) {
      console.log(`   Connected to db: ${demoResolution.dbIdentifier}`)
      const tenantInfo = await demoResolution.prisma.tenantInfo.findFirst()
      assert(
        Boolean(tenantInfo),
        "Reads tenant_info record from imfs_tenant_apex",
        JSON.stringify(tenantInfo)
      )
      console.log(`   Tenant info: institutionName = '${tenantInfo?.institutionName}', id = ${tenantInfo?.id}`)
    }

    // -------------------------------------------------------------------------
    // Test 2: Resolve by dbIdentifier
    // -------------------------------------------------------------------------
    console.log("\n-> Test 2: Resolving demo institution by dbIdentifier...")
    const dbIdentResolution = await resolveTenantByDbIdentifier("tenant_apex_demo")
    assert(
      dbIdentResolution.ok === true,
      "Resolves demo institution by dbIdentifier ('tenant_apex_demo')",
      dbIdentResolution.ok ? undefined : dbIdentResolution.message
    )

    // -------------------------------------------------------------------------
    // Test 3: Refuse unknown institution ID
    // -------------------------------------------------------------------------
    console.log("\n-> Test 3: Requesting non-existent institution ID...")
    const unknownResolution = await resolveTenantByInstitutionId(NON_EXISTENT_ID)
    assert(
      unknownResolution.ok === false && unknownResolution.status === 404,
      "Unknown institution ID is refused with 404",
      `Got status: ${unknownResolution.status}, message: ${unknownResolution.message}`
    )

    // -------------------------------------------------------------------------
    // Test 4: Refuse non-active tenant (temporary test records in central)
    // -------------------------------------------------------------------------
    console.log("\n-> Test 4: Non-active tenant status check...")
    const tempInactiveId = "00000000-0000-4000-8000-000000000099"
    // Create temporary inactive institution
    await centralPrisma.institution.upsert({
      where: { id: tempInactiveId },
      update: { status: "suspended" },
      create: {
        id: tempInactiveId,
        name: "Temporary Inactive MFI",
        status: "suspended",
      },
    })
    await centralPrisma.institutionDatabase.upsert({
      where: { dbIdentifier: "tenant_temp_inactive" },
      update: {
        status: "active",
        institutionId: tempInactiveId,
      },
      create: {
        institutionId: tempInactiveId,
        dbIdentifier: "tenant_temp_inactive",
        dbHost: "100.98.191.25",
        dbPort: 5436,
        dbName: "imfs_tenant_apex",
        status: "active",
      },
    })

    const inactiveInstResolution = await resolveTenantByInstitutionId(tempInactiveId)
    assert(
      inactiveInstResolution.ok === false && inactiveInstResolution.status === 403,
      "Suspended institution is refused with 403",
      `Got status: ${inactiveInstResolution.status}, message: ${inactiveInstResolution.message}`
    )

    // Inactive database record check
    const tempInactiveDbId = "00000000-0000-4000-8000-000000000098"
    await centralPrisma.institution.upsert({
      where: { id: tempInactiveDbId },
      update: { status: "active" },
      create: {
        id: tempInactiveDbId,
        name: "Temporary Active MFI Inactive DB",
        status: "active",
      },
    })
    await centralPrisma.institutionDatabase.upsert({
      where: { dbIdentifier: "tenant_temp_inactive_db" },
      update: {
        status: "provisioning",
        institutionId: tempInactiveDbId,
      },
      create: {
        institutionId: tempInactiveDbId,
        dbIdentifier: "tenant_temp_inactive_db",
        dbHost: "100.98.191.25",
        dbPort: 5436,
        dbName: "imfs_tenant_apex",
        status: "provisioning",
      },
    })

    const inactiveDbResolution = await resolveTenantByInstitutionId(tempInactiveDbId)
    assert(
      inactiveDbResolution.ok === false && inactiveDbResolution.status === 403,
      "Provisioning/inactive database is refused with 403",
      `Got status: ${inactiveDbResolution.status}, message: ${inactiveDbResolution.message}`
    )

    // Cleanup temporary test records
    await centralPrisma.institutionDatabase.deleteMany({
      where: { dbIdentifier: { in: ["tenant_temp_inactive", "tenant_temp_inactive_db"] } },
    })
    await centralPrisma.institution.deleteMany({
      where: { id: { in: [tempInactiveId, tempInactiveDbId] } },
    })
    clearRoutingCache()

    // -------------------------------------------------------------------------
    // Test 5: Client pool cap and idle eviction
    // -------------------------------------------------------------------------
    console.log("\n-> Test 5: Client pool cap and idle eviction...")
    // Configure MAX_TENANT_CLIENTS to 2 for this test
    process.env.MAX_TENANT_CLIENTS = "2"

    const baseCentralUrl = process.env.CENTRAL_DATABASE_URL!
    const testUrl1 = new URL(baseCentralUrl)
    testUrl1.pathname = "/imfs_tenant_apex"
    testUrl1.searchParams.set("test_client", "1")

    const testUrl2 = new URL(baseCentralUrl)
    testUrl2.pathname = "/imfs_tenant_apex"
    testUrl2.searchParams.set("test_client", "2")

    const testUrl3 = new URL(baseCentralUrl)
    testUrl3.pathname = "/imfs_tenant_apex"
    testUrl3.searchParams.set("test_client", "3")

    // Allocate 1st and 2nd client
    await getTenantPrisma(testUrl1.toString())
    await getTenantPrisma(testUrl2.toString())

    let stats = getTenantPoolStats()
    assert(stats.size === 2, "Pool size holds 2 clients", `Current size: ${stats.size}`)

    // Allocate 3rd client, should evict least recently used idle client (testUrl1)
    await getTenantPrisma(testUrl3.toString())
    stats = getTenantPoolStats()
    assert(
      stats.size <= 2,
      "Pool size respects cap of 2 after 3rd allocation",
      `Current size: ${stats.size}`
    )

    const urlsInPool = stats.entries.map((e) => e.url)
    assert(
      !urlsInPool.includes(testUrl1.toString()),
      "Oldest idle client (client 1) was evicted from pool"
    )
    assert(
      urlsInPool.includes(testUrl3.toString()),
      "Newest client (client 3) is present in pool"
    )

    // -------------------------------------------------------------------------
    // Test 6: Invalidate routing and explicit client eviction assertions
    // -------------------------------------------------------------------------
    console.log("\n-> Test 6: Invalidate routing and explicit client eviction...")
    // First, resolve demo institution so client is present in cache
    const initialResolve = await resolveTenantByInstitutionId(DEMO_INSTITUTION_ID)
    if (initialResolve.ok) {
      const clientUrl = initialResolve.connectionUrl
      const initialClientInstance = initialResolve.prisma

      let poolAfterResolve = getTenantPoolStats()
      assert(
        poolAfterResolve.entries.some((e) => e.url === clientUrl),
        "Demo tenant client is present in the pool before invalidation"
      )

      // Invalidate routing and evict client
      await invalidateTenantRouting(DEMO_INSTITUTION_ID)

      let poolAfterInvalidate = getTenantPoolStats()
      assert(
        !poolAfterInvalidate.entries.some((e) => e.url === clientUrl),
        "Demo tenant client is successfully evicted from pool after invalidateTenantRouting"
      )

      // Re-resolving must recreate a fresh client
      const freshResolve = await resolveTenantByInstitutionId(DEMO_INSTITUTION_ID)
      assert(
        freshResolve.ok === true,
        "Tenant resolves again after invalidation"
      )
      if (freshResolve.ok) {
        assert(
          freshResolve.prisma !== initialClientInstance,
          "Next resolution creates a new Prisma client instance after eviction"
        )
      }
    }

    // -------------------------------------------------------------------------
    // Test 7: Pool at cap with all clients in-flight (in-flight never evicted)
    // -------------------------------------------------------------------------
    console.log("\n-> Test 7: Pool at cap with all clients in-flight...")
    // Reset pool
    await disconnectAllTenantClients()
    process.env.MAX_TENANT_CLIENTS = "2"

    const inflightUrlA = new URL(baseCentralUrl)
    inflightUrlA.pathname = "/imfs_tenant_apex"
    inflightUrlA.searchParams.set("inflight_client", "A")

    const inflightUrlB = new URL(baseCentralUrl)
    inflightUrlB.pathname = "/imfs_tenant_apex"
    inflightUrlB.searchParams.set("inflight_client", "B")

    const inflightUrlC = new URL(baseCentralUrl)
    inflightUrlC.pathname = "/imfs_tenant_apex"
    inflightUrlC.searchParams.set("inflight_client", "C")

    // Acquire A and B to set inFlight = 1
    const clientA = await acquireTenantClient(inflightUrlA.toString())
    const clientB = await acquireTenantClient(inflightUrlB.toString())

    let capStats = getTenantPoolStats()
    assert(capStats.size === 2, "Pool reached cap of 2 with 2 in-flight clients")

    // Allocate 3rd client C while A & B are both in-flight
    // Since both A & B are active, neither can be evicted. The pool temporarily accommodates C.
    const clientC = await getTenantPrisma(inflightUrlC.toString())
    capStats = getTenantPoolStats()

    const poolUrls = capStats.entries.map((e) => e.url)
    assert(
      poolUrls.includes(inflightUrlA.toString()) && poolUrls.includes(inflightUrlB.toString()),
      "In-flight clients (A & B) were NOT evicted"
    )
    assert(
      poolUrls.includes(inflightUrlC.toString()),
      "New client C is allocated, temporarily exceeding cap to protect active requests"
    )
    assert(
      capStats.size === 3,
      "Pool size temporarily equals 3 while all prior entries are active"
    )

    // Release in-flight client A
    releaseTenantClient(inflightUrlA.toString())
    releaseTenantClient(inflightUrlB.toString())

    // Now requesting a 4th client D should evict newly-idle client A and bring size down
    const inflightUrlD = new URL(baseCentralUrl)
    inflightUrlD.pathname = "/imfs_tenant_apex"
    inflightUrlD.searchParams.set("inflight_client", "D")

    await getTenantPrisma(inflightUrlD.toString())
    capStats = getTenantPoolStats()
    const poolUrlsAfter = capStats.entries.map((e) => e.url)
    assert(
      !poolUrlsAfter.includes(inflightUrlA.toString()),
      "Released client A was evicted once it became idle when cap was enforced"
    )

    console.log(`\n=================================================`)
    console.log(`Results: ${passed} passed out of ${total} tests`)
    console.log(`=================================================`)
  } catch (error) {
    console.error("Test execution failed with error:", error)
  } finally {
    await centralPrisma.$disconnect()
    await disconnectAllTenantClients()
  }
}

runTests()
