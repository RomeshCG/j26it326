import "dotenv/config"
import { centralPrisma } from "../src/lib/prisma-central.js"
import {
  hashPassword,
  signAccessToken,
  validateUserId,
} from "../src/lib/auth.js"
import { invalidateUserAuthCache, clearUserAuthCache } from "../src/middleware/auth.js"
import { disconnectAllTenantClients } from "../src/lib/prisma-tenant.js"

const DEMO_INSTITUTION_ID = "00000000-0000-4000-8000-000000000001"
const FOREIGN_INSTITUTION_ID = "00000000-0000-4000-8000-000000000002"

const API_BASE = "http://localhost:4000"

async function runAuthVerification() {
  console.log("=== IMFS M4: Phase 2 JWT Auth & RBAC Verification ===\n")
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

  // Temporary test user records to create and clean up
  const TEST_PASSWORD = "CorrectHorseBatteryStaple123!"
  const testPasswordHash = await hashPassword(TEST_PASSWORD)

  const adminRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "admin" } })
  const hrRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "hr_officer" } })
  const loanOfficerRole = await centralPrisma.role.findUniqueOrThrow({ where: { name: "loan_officer" } })

  const tempAdminEmail = "temp.verify.admin@apex.lk"
  const tempHrEmail = "temp.verify.hr@apex.lk"
  const tempDisabledEmail = "temp.verify.disabled@apex.lk"

  let tempAdminUser: any
  let tempHrUser: any
  let tempDisabledUser: any
  let tempForeignInstitution: any

  try {
    // Setup temporary test users in central
    tempAdminUser = await centralPrisma.user.upsert({
      where: { email: tempAdminEmail },
      update: { passwordHash: testPasswordHash, status: "active", roleId: adminRole.id },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: adminRole.id,
        fullName: "Temp Admin Verifier",
        email: tempAdminEmail,
        passwordHash: testPasswordHash,
        status: "active",
      },
    })

    tempHrUser = await centralPrisma.user.upsert({
      where: { email: tempHrEmail },
      update: { passwordHash: testPasswordHash, status: "active", roleId: hrRole.id },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: hrRole.id,
        fullName: "Temp HR Verifier",
        email: tempHrEmail,
        passwordHash: testPasswordHash,
        status: "active",
      },
    })

    tempDisabledUser = await centralPrisma.user.upsert({
      where: { email: tempDisabledEmail },
      update: { passwordHash: testPasswordHash, status: "disabled", roleId: loanOfficerRole.id },
      create: {
        institutionId: DEMO_INSTITUTION_ID,
        roleId: loanOfficerRole.id,
        fullName: "Temp Disabled Verifier",
        email: tempDisabledEmail,
        passwordHash: testPasswordHash,
        status: "disabled",
      },
    })

    // Setup temporary foreign institution for cross-tenant isolation test
    tempForeignInstitution = await centralPrisma.institution.upsert({
      where: { id: FOREIGN_INSTITUTION_ID },
      update: { status: "active" },
      create: {
        id: FOREIGN_INSTITUTION_ID,
        name: "Foreign Test MFI Ltd",
        status: "active",
      },
    })

    clearUserAuthCache()

    // -------------------------------------------------------------------------
    // Test 1: Successful login returns JWT token & user info
    // -------------------------------------------------------------------------
    console.log("-> Test 1: Testing valid login...")
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempAdminEmail, password: TEST_PASSWORD }),
    })
    const loginBody: any = await loginRes.json()

    assert(loginRes.status === 200, "Valid credentials return 200 OK")
    assert(typeof loginBody.token === "string" && loginBody.token.length > 20, "Response contains JWT token string")
    assert(loginBody.user?.role === "admin", "User role in response is 'admin'")

    const adminToken = loginBody.token

    // Verify login_audit entry was created for success
    const successAudit = await centralPrisma.loginAudit.findFirst({
      where: { userId: tempAdminUser.id, event: "login_success" },
      orderBy: { createdAt: "desc" },
    })
    assert(Boolean(successAudit), "login_audit records 'login_success' event")

    // -------------------------------------------------------------------------
    // Test 2: Login failure - bad password & unknown email
    // -------------------------------------------------------------------------
    console.log("\n-> Test 2: Testing login failures (bad password & unknown email)...")
    const badPasswordRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempAdminEmail, password: "WrongPassword!" }),
    })
    const badPasswordBody: any = await badPasswordRes.json()
    assert(badPasswordRes.status === 401, "Wrong password returns 401 Unauthorized")
    assert(badPasswordBody.error === "Invalid email or password", "Returns generic invalid error")

    const failedAudit = await centralPrisma.loginAudit.findFirst({
      where: { userId: tempAdminUser.id, event: "login_failed" },
      orderBy: { createdAt: "desc" },
    })
    assert(Boolean(failedAudit), "login_audit records 'login_failed' event")

    const unknownEmailRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "does.not.exist@unknown.lk", password: TEST_PASSWORD }),
    })
    const unknownEmailBody: any = await unknownEmailRes.json()
    assert(unknownEmailRes.status === 401, "Unknown email returns 401 Unauthorized")
    assert(
      unknownEmailBody.error === badPasswordBody.error,
      "Unknown email returns identical error message (no user enumeration)"
    )

    // -------------------------------------------------------------------------
    // Test 3: Disabled user login refusal
    // -------------------------------------------------------------------------
    console.log("\n-> Test 3: Disabled user login refusal...")
    const disabledLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempDisabledEmail, password: TEST_PASSWORD }),
    })
    assert(disabledLoginRes.status === 401, "Disabled user is refused with 401")

    const disabledAudit = await centralPrisma.loginAudit.findFirst({
      where: { userId: tempDisabledUser.id, event: "account_disabled" },
      orderBy: { createdAt: "desc" },
    })
    assert(Boolean(disabledAudit), "login_audit records 'account_disabled' event")

    // -------------------------------------------------------------------------
    // Test 4: GET /auth/me profile inspection
    // -------------------------------------------------------------------------
    console.log("\n-> Test 4: GET /auth/me for authenticated user...")
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const meBody: any = await meRes.json()
    assert(meRes.status === 200, "GET /auth/me returns 200 OK")
    assert(meBody.email === tempAdminEmail, "GET /auth/me returns correct email")
    assert(Array.isArray(meBody.capabilities), "GET /auth/me returns array of capabilities")

    // -------------------------------------------------------------------------
    // Test 5: RBAC Role-Protected Routes (200 vs 403 vs 401)
    // -------------------------------------------------------------------------
    console.log("\n-> Test 5: RBAC Route protection (200 vs 403 vs 401)...")
    // Missing token -> 401
    const noTokenRes = await fetch(`${API_BASE}/auth/test/admin`)
    assert(noTokenRes.status === 401, "Missing token returns 401 Unauthorized")

    // Admin calling admin route -> 200
    const adminAllowedRes = await fetch(`${API_BASE}/auth/test/admin`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    assert(adminAllowedRes.status === 200, "Admin accessing /auth/test/admin returns 200 OK")

    // HR user logging in
    const hrLoginRes = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: tempHrEmail, password: TEST_PASSWORD }),
    })
    const hrLoginBody: any = await hrLoginRes.json()
    const hrToken = hrLoginBody.token

    // HR user calling HR route -> 200
    const hrAllowedRes = await fetch(`${API_BASE}/auth/test/hr`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    })
    assert(hrAllowedRes.status === 200, "HR officer accessing /auth/test/hr returns 200 OK")

    // HR user calling Admin-only route -> 403
    const hrForbiddenRes = await fetch(`${API_BASE}/auth/test/admin`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    })
    assert(hrForbiddenRes.status === 403, "HR officer accessing /auth/test/admin is refused with 403 Forbidden")

    // -------------------------------------------------------------------------
    // Test 6: User disabled while holding valid token
    // -------------------------------------------------------------------------
    console.log("\n-> Test 6: User disabled mid-session with valid token...")
    // Invalidate cache for tempHrUser and update status to disabled
    await centralPrisma.user.update({
      where: { id: tempHrUser.id },
      data: { status: "disabled" },
    })
    invalidateUserAuthCache(tempHrUser.id)

    // Across separate processes (script vs dev server), wait for server in-memory TTL to expire
    const cacheTtlMs = process.env.USER_AUTH_CACHE_TTL_MS
      ? Number.parseInt(process.env.USER_AUTH_CACHE_TTL_MS, 10)
      : 5000
    const waitMs = (Number.isFinite(cacheTtlMs) && cacheTtlMs >= 0 ? cacheTtlMs : 5000) + 500
    console.log(`   Waiting ${waitMs}ms for server-side user auth cache to expire...`)
    await new Promise((resolve) => setTimeout(resolve, waitMs))

    const disabledTokenRes = await fetch(`${API_BASE}/auth/test/hr`, {
      headers: { Authorization: `Bearer ${hrToken}` },
    })
    assert(disabledTokenRes.status === 401, "Disabled user holding valid token is refused with 401")

    // -------------------------------------------------------------------------
    // Test 7: Cross-tenant token and foreign tenant isolation
    // -------------------------------------------------------------------------
    console.log("\n-> Test 7: Cross-tenant token & foreign tenant isolation...")
    // Generate token forging foreign institution ID
    const forgedForeignToken = signAccessToken({
      userId: tempAdminUser.id,
      institutionId: FOREIGN_INSTITUTION_ID,
      role: "admin",
    })

    const foreignTokenRes = await fetch(`${API_BASE}/auth/test/admin`, {
      headers: { Authorization: `Bearer ${forgedForeignToken}` },
    })
    assert(
      foreignTokenRes.status === 403,
      "Token with foreign institutionId is refused with 403 by resolveTenantContext"
    )

    // Admin accessing /api/institutions only receives caller's own institution
    const institutionsRes = await fetch(`${API_BASE}/api/institutions`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    })
    const instBody: any = await institutionsRes.json()
    assert(institutionsRes.status === 200, "GET /api/institutions returns 200 OK")
    const returnedIds = instBody.data?.map((i: any) => i.id) || []
    assert(
      returnedIds.includes(DEMO_INSTITUTION_ID) && !returnedIds.includes(FOREIGN_INSTITUTION_ID),
      "GET /api/institutions returns ONLY the caller's institution, isolating other MFIs"
    )

    // Foreign tenant health check is refused with 403
    const foreignHealthRes = await fetch(
      `${API_BASE}/api/institutions/${FOREIGN_INSTITUTION_ID}/tenant-health`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    )
    assert(
      foreignHealthRes.status === 403,
      "Accessing foreign institution tenant-health returns 403 Forbidden"
    )

    // -------------------------------------------------------------------------
    // Test 8: validateUserId exported helper check
    // -------------------------------------------------------------------------
    console.log("\n-> Test 8: validateUserId shared helper...")
    // Restore admin to active for validation
    const validCheck = await validateUserId(tempAdminUser.id, DEMO_INSTITUTION_ID)
    assert(validCheck.valid === true, "validateUserId confirms valid active user in institution")

    const wrongInstCheck = await validateUserId(tempAdminUser.id, FOREIGN_INSTITUTION_ID)
    assert(wrongInstCheck.valid === false, "validateUserId rejects user when institutionId does not match")

    const unknownUserCheck = await validateUserId("99999999-9999-4999-8999-999999999999", DEMO_INSTITUTION_ID)
    assert(unknownUserCheck.valid === false, "validateUserId rejects unknown userId")

    const disabledUserCheck = await validateUserId(tempDisabledUser.id, DEMO_INSTITUTION_ID)
    assert(disabledUserCheck.valid === false, "validateUserId rejects disabled user")

    console.log(`\n=================================================`)
    console.log(`Results: ${passed} passed out of ${total} tests`)
    console.log(`=================================================`)
  } catch (error) {
    console.error("Test execution failed with error:", error)
  } finally {
    console.log("\nCleaning up temporary test records...")
    // Delete login audits for test users
    if (tempAdminUser?.id || tempHrUser?.id || tempDisabledUser?.id) {
      await centralPrisma.loginAudit.deleteMany({
        where: {
          userId: { in: [tempAdminUser?.id, tempHrUser?.id, tempDisabledUser?.id].filter(Boolean) },
        },
      })
    }
    // Delete temporary test users
    await centralPrisma.user.deleteMany({
      where: {
        email: { in: [tempAdminEmail, tempHrEmail, tempDisabledEmail] },
      },
    })
    // Delete temporary foreign institution
    await centralPrisma.institution.deleteMany({
      where: { id: FOREIGN_INSTITUTION_ID },
    })

    await centralPrisma.$disconnect()
    await disconnectAllTenantClients()
    clearUserAuthCache()
    console.log("Cleanup complete.")
  }
}

runAuthVerification()
