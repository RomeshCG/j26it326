import "dotenv/config"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { hashPassword, signAccessToken } from "../src/lib/auth.js"
import { disconnectAllTenantClients } from "../src/lib/prisma-tenant.js"

const DEMO_INSTITUTION_ID = "00000000-0000-4000-8000-000000000001"
const FOREIGN_INSTITUTION_ID = "00000000-0000-4000-8000-000000000002"
const API_BASE = "http://localhost:4000"

async function runStubApiVerification() {
  console.log("=== IMFS M4: Phase 3 Stub API & Integration Kit Verification ===\n")
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

  const TEST_PASSWORD = "StubVerificationPassword123!"
  const passwordHash = await hashPassword(TEST_PASSWORD)
  const adminRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "admin" } })
  const loanOfficerRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "loan_officer" } })

  const tempAdminEmail = "temp.stub.admin@apex.lk"
  const tempOfficerEmail = "temp.stub.officer@apex.lk"

  let tempAdminUser: any
  let tempOfficerUser: any
  let tempForeignInstitution: any

  try {
    // -------------------------------------------------------------------------
    // Setup temporary users and records
    // -------------------------------------------------------------------------
    tempAdminUser = await centralPrisma.user.upsert({
      where: { email: tempAdminEmail },
      update: { passwordHash, status: "active", roleId: adminRole.id },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: adminRole.id,
        fullName: "Temp Stub Admin",
        email: tempAdminEmail,
        passwordHash,
        status: "active",
      },
    })

    tempOfficerUser = await centralPrisma.user.upsert({
      where: { email: tempOfficerEmail },
      update: { passwordHash, status: "active", roleId: loanOfficerRole.id },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: loanOfficerRole.id,
        fullName: "Temp Stub Officer",
        email: tempOfficerEmail,
        passwordHash,
        status: "active",
      },
    })

    tempForeignInstitution = await centralPrisma.institution.upsert({
      where: { id: FOREIGN_INSTITUTION_ID },
      update: { status: "active" },
      create: {
        id: FOREIGN_INSTITUTION_ID,
        name: "Foreign MFI Stub Test",
        status: "active",
      },
    })

    const validToken = signAccessToken({
      userId: tempAdminUser.id,
      institutionId: DEMO_INSTITUTION_ID,
      role: "admin",
    })

    const foreignToken = signAccessToken({
      userId: tempAdminUser.id,
      institutionId: FOREIGN_INSTITUTION_ID,
      role: "admin",
    })

    // -------------------------------------------------------------------------
    // Test 1: OpenAPI JSON document serves valid specification
    // -------------------------------------------------------------------------
    console.log("-> Test 1: Verifying /openapi.json specification...")
    const openApiRes = await fetch(`${API_BASE}/openapi.json`)
    assert(openApiRes.status === 200, "GET /openapi.json returns 200 OK")

    const spec: any = await openApiRes.json()
    assert(spec.openapi === "3.0.3", "Spec declares OpenAPI version 3.0.3")

    const requiredPaths = [
      "/auth/login",
      "/auth/me",
      "/api/tenant/info",
      "/api/tenant/branches",
      "/api/tenant/users/{userId}/validate",
    ]
    const allPathsPresent = requiredPaths.every((p) => Boolean(spec.paths?.[p]))
    assert(allPathsPresent, "All 5 required core M4 paths are documented in openapi.json")

    // Check Swagger UI route
    const docsRes = await fetch(`${API_BASE}/docs`)
    assert(docsRes.status === 200 || docsRes.status === 301, "GET /docs serves Swagger UI (200/301)")

    // -------------------------------------------------------------------------
    // Test 2: GET /api/tenant/info
    // -------------------------------------------------------------------------
    console.log("\n-> Test 2: Verifying GET /api/tenant/info...")
    // Missing token
    const infoNoAuthRes = await fetch(`${API_BASE}/api/tenant/info`)
    assert(infoNoAuthRes.status === 401, "GET /api/tenant/info without token returns 401 Unauthorized")

    // Valid token
    const infoRes = await fetch(`${API_BASE}/api/tenant/info`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const infoBody: any = await infoRes.json()
    assert(infoRes.status === 200, "GET /api/tenant/info returns 200 OK with valid token")
    assert(infoBody.institutionId === DEMO_INSTITUTION_ID, "Returns caller's institutionId")
    assert(Boolean(infoBody.info), "Contains tenant_info record")

    // Foreign token
    const infoForeignRes = await fetch(`${API_BASE}/api/tenant/info`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
    })
    assert(infoForeignRes.status === 403, "GET /api/tenant/info with foreign token returns 403 Forbidden")

    // -------------------------------------------------------------------------
    // Test 3: GET /api/tenant/branches
    // -------------------------------------------------------------------------
    console.log("\n-> Test 3: Verifying GET /api/tenant/branches...")
    // Missing token
    const branchesNoAuthRes = await fetch(`${API_BASE}/api/tenant/branches`)
    assert(branchesNoAuthRes.status === 401, "GET /api/tenant/branches without token returns 401 Unauthorized")

    // Valid token
    const branchesRes = await fetch(`${API_BASE}/api/tenant/branches`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const branchesBody: any = await branchesRes.json()
    assert(branchesRes.status === 200, "GET /api/tenant/branches returns 200 OK with valid token")
    assert(Array.isArray(branchesBody.data), "Returns array of branches")
    assert(typeof branchesBody.count === "number" && branchesBody.count >= 1, "Returns valid branch count")

    // Foreign token
    const branchesForeignRes = await fetch(`${API_BASE}/api/tenant/branches`, {
      headers: { Authorization: `Bearer ${foreignToken}` },
    })
    assert(branchesForeignRes.status === 403, "GET /api/tenant/branches with foreign token returns 403 Forbidden")

    // -------------------------------------------------------------------------
    // Test 4: GET /api/tenant/users/:userId/validate (Uniform return, no enumeration)
    // -------------------------------------------------------------------------
    console.log("\n-> Test 4: Verifying GET /api/tenant/users/:userId/validate...")
    // Missing token
    const valNoAuthRes = await fetch(`${API_BASE}/api/tenant/users/${tempOfficerUser.id}/validate`)
    assert(valNoAuthRes.status === 401, "Validate without token returns 401 Unauthorized")

    // Known active user in same institution
    const valKnownRes = await fetch(`${API_BASE}/api/tenant/users/${tempOfficerUser.id}/validate`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const valKnownBody: any = await valKnownRes.json()
    assert(valKnownRes.status === 200, "Validate known active user returns 200 OK")
    assert(valKnownBody.valid === true, "Known active user returns valid: true")
    assert(
      Object.keys(valKnownBody).length === 1,
      "Response contains strictly only the 'valid' property (no leaked user details)"
    )

    // Unknown user
    const unknownUserId = "00000000-0000-4000-8000-999999999999"
    const valUnknownRes = await fetch(`${API_BASE}/api/tenant/users/${unknownUserId}/validate`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const valUnknownBody: any = await valUnknownRes.json()
    assert(valUnknownRes.status === 200, "Validate unknown user returns 200 OK")
    assert(valUnknownBody.valid === false, "Unknown user returns valid: false")
    assert(
      Object.keys(valUnknownBody).length === 1,
      "Unknown user returns strictly only the 'valid' property"
    )

    // Disabled user check
    await centralPrisma.user.update({
      where: { id: tempOfficerUser.id },
      data: { status: "disabled" },
    })
    const valDisabledRes = await fetch(`${API_BASE}/api/tenant/users/${tempOfficerUser.id}/validate`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const valDisabledBody: any = await valDisabledRes.json()
    assert(valDisabledBody.valid === false, "Disabled user returns valid: false")
    assert(
      JSON.stringify(valDisabledBody) === JSON.stringify(valUnknownBody),
      "Disabled user response is completely identical to unknown user response"
    )

    // -------------------------------------------------------------------------
    // Test 5: Integration example router (/api/example) in development
    // -------------------------------------------------------------------------
    console.log("\n-> Test 5: Verifying integration example router (/api/example)...")
    const exampleRes = await fetch(`${API_BASE}/api/example/any-user`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    assert(exampleRes.status === 200, "GET /api/example/any-user returns 200 OK")

    const exampleTenantRes = await fetch(`${API_BASE}/api/example/tenant-data-read`, {
      headers: { Authorization: `Bearer ${validToken}` },
    })
    const exampleTenantBody: any = await exampleTenantRes.json()
    assert(exampleTenantRes.status === 200, "GET /api/example/tenant-data-read returns 200 OK")
    assert(typeof exampleTenantBody.branchCount === "number", "Reads branch count via req.tenantPrisma")

    console.log(`\n=================================================`)
    console.log(`Results: ${passed} passed out of ${total} tests`)
    console.log(`=================================================`)
  } catch (error) {
    console.error("Test execution failed with error:", error)
  } finally {
    console.log("\nCleaning up temporary test records...")
    if (tempAdminUser?.id || tempOfficerUser?.id) {
      await centralPrisma.loginAudit.deleteMany({
        where: {
          userId: { in: [tempAdminUser?.id, tempOfficerUser?.id].filter(Boolean) },
        },
      })
      await centralPrisma.user.deleteMany({
        where: {
          email: { in: [tempAdminEmail, tempOfficerEmail] },
        },
      })
    }
    await centralPrisma.institution.deleteMany({
      where: { id: FOREIGN_INSTITUTION_ID },
    })

    await centralPrisma.$disconnect()
    await disconnectAllTenantClients()
    console.log("Cleanup complete.")
  }
}

runStubApiVerification()
