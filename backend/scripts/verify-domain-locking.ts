import "dotenv/config"
import crypto from "crypto"
import { centralPrisma } from "../src/lib/prisma-central.js"
import { hashPassword, logSafeError } from "../src/lib/auth.js"
import { isBlockedDomain } from "../src/lib/freemail-blocklist.js"
import {
  registerDomain,
  verifyDomain,
  resendVerification,
  signupUser,
  approveUser,
  rejectUser,
  revokeDomain,
} from "../src/lib/domain-service.js"
import type { EmailService } from "../src/lib/email.js"

/**
 * IMFS Component 4: Phase 5 Domain Tenant Locking Verification Script
 *
 * NOTE: DO NOT RUN WITHOUT EXPLICIT USER APPROVAL.
 * Exercises real domain service functions with synthetic isolated institutions
 * and domains, cleaning up all artifacts in a finally block in strict FK order.
 */

async function runDomainLockingVerification() {
  // --------------------------------------------------------------------------
  // Safety Guard A: Verify Central Database Port 5436
  // --------------------------------------------------------------------------
  const envVarName = "CENTRAL_DATABASE_URL"
  const rawDbUrl = process.env[envVarName]
  if (!rawDbUrl) {
    console.error(`FATAL: ${envVarName} is not set.`)
    process.exit(1)
  }

  let dbHost = "unknown"
  let dbPort: number | null = null
  try {
    const parsed = new URL(rawDbUrl)
    dbHost = parsed.hostname
    dbPort = parsed.port ? parseInt(parsed.port, 10) : 5432
  } catch {
    console.error(`FATAL: Could not parse ${envVarName}.`)
    process.exit(1)
  }

  // Print variable NAME, host, and port ONLY - never the raw URL or credentials
  console.log(`[Safety Guard] Env Variable: ${envVarName}, Host: ${dbHost}, Port: ${dbPort}`)
  if (dbPort !== 5436) {
    console.error(`FATAL: Verification script is restricted to port 5436 only. (Current port: ${dbPort}). Aborting.`)
    process.exit(1)
  }

  // --------------------------------------------------------------------------
  // Safety Guard B: Record baseline row counts before any write
  // --------------------------------------------------------------------------
  const baselineUsersCount = await centralPrisma.user.count()
  const baselineInstCount = await centralPrisma.institution.count()
  const baselineDomainCount = await centralPrisma.institutionDomain.count()

  console.log(`[Baseline Counts] Institutions: ${baselineInstCount}, Users: ${baselineUsersCount}, Domains: ${baselineDomainCount}\n`)

  const timestamp = Date.now()
  const randomRunPassword = crypto.randomBytes(12).toString("hex") + "A1!"
  const syntheticDomain1 = `test-locking-1-${timestamp}.lk`
  const syntheticDomain2 = `test-locking-2-${timestamp}.lk`
  const conflictDomain = `test-conflict-${timestamp}.lk`
  const staffEmail = `staff@${syntheticDomain1}`
  const isolatedInstName = `test-locking-${timestamp}`

  console.log(`=== Phase 5 Domain Tenant Locking Verification ===`)
  console.log(`Synthetic Isolated Institution: ${isolatedInstName}`)
  console.log(`Synthetic Domains: ${syntheticDomain1}, ${syntheticDomain2}, ${conflictDomain}\n`)

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

  // Token interception mock for capturing raw tokens directly without parsing outside logs
  let capturedToken = ""
  const tokenCapturingEmailService: EmailService = {
    async sendDomainVerification(_to: string, _domain: string, rawToken: string) {
      capturedToken = rawToken
    },
  }

  // Tracking arrays for guaranteed cleanup (push immediately upon creation)
  const createdInstitutionIds: string[] = []
  const createdUserIds: string[] = []
  const createdDomainIds: string[] = []

  try {
    // ------------------------------------------------------------------------
    // 1. Blocklist & Public Suffix Rejection
    // ------------------------------------------------------------------------
    console.log("--- 1. Blocklist & Public Suffix Rejection ---")
    const blkFree = isBlockedDomain("gmail.com")
    assert(blkFree.blocked, "Rejects public free-mail (gmail.com)")

    const blkSub = isBlockedDomain("mail.yahoo.com")
    assert(blkSub.blocked, "Rejects free-mail subdomain (mail.yahoo.com)")

    const blkSuffix = isBlockedDomain("gov.lk")
    assert(blkSuffix.blocked, "Rejects bare public suffix (gov.lk)")

    const blkOk = isBlockedDomain(syntheticDomain1)
    assert(!blkOk.blocked, `Allows valid corporate domain (${syntheticDomain1})`)

    // Load standard roles
    const adminRole = await centralPrisma.role.findFirstOrThrow({ where: { name: "admin" } })
    const loanOfficerRole = await centralPrisma.role.findFirstOrThrow({ where: { name: "loan_officer" } })
    const hrOfficerRole = await centralPrisma.role.findFirstOrThrow({ where: { name: "hr_officer" } })

    // ------------------------------------------------------------------------
    // 2. Setup Synthetic Isolated Institution
    // ------------------------------------------------------------------------
    console.log("\n--- 2. Setting Up Synthetic Isolated Institution ---")
    const testInst = await centralPrisma.institution.create({
      data: {
        name: isolatedInstName,
        status: "active",
      },
    })
    createdInstitutionIds.push(testInst.id)

    // Second isolated institution to test duplicate claim conflict
    const testInst2 = await centralPrisma.institution.create({
      data: {
        name: `${isolatedInstName}-second`,
        status: "active",
      },
    })
    createdInstitutionIds.push(testInst2.id)

    // Create sole admin in primary isolated institution
    const passwordHash = await hashPassword(randomRunPassword)
    const soleAdmin = await centralPrisma.user.create({
      data: {
        email: `admin@${syntheticDomain1}`,
        fullName: "Synthetic Sole Admin",
        passwordHash,
        institutionId: testInst.id,
        roleId: adminRole.id,
        status: "active",
      },
    })
    createdUserIds.push(soleAdmin.id)
    assert(!!testInst.id && !!soleAdmin.id, "Synthetic isolated institution and sole admin created")

    // ------------------------------------------------------------------------
    // 3. Register Domain Claim & Verify
    // ------------------------------------------------------------------------
    console.log("\n--- 3. Register & Verify Domain via Service ---")

    // Test 4(a): registerDomain with admin role id as defaultRoleId returns 400
    const adminDefaultRoleRes = await registerDomain({
      institutionId: testInst.id,
      domain: syntheticDomain1,
      verificationMailbox: "admin",
      defaultRoleId: adminRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })
    assert(
      !adminDefaultRoleRes.success && adminDefaultRoleRes.status === 400,
      "registerDomain with admin role as defaultRoleId returns 400"
    )

    // Test 4(b): registerDomain with invalid verificationMailbox returns 400
    const invalidMailboxRes = await registerDomain({
      institutionId: testInst.id,
      domain: syntheticDomain1,
      verificationMailbox: "bad mailbox!",
      defaultRoleId: loanOfficerRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })
    assert(
      !invalidMailboxRes.success && invalidMailboxRes.status === 400,
      "registerDomain with invalid verificationMailbox returns 400"
    )

    // Valid registerDomain for syntheticDomain1
    capturedToken = ""
    const regResult = await registerDomain({
      institutionId: testInst.id,
      domain: syntheticDomain1,
      verificationMailbox: "admin",
      defaultRoleId: loanOfficerRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })
    if (regResult.data?.id) createdDomainIds.push(regResult.data.id)
    assert(regResult.success && regResult.status === 201, "registerDomain creates pending claim (201)")
    const domain1Id = regResult.data?.id

    // Test 4(f): resendVerification without verificationMailbox returns 400
    if (domain1Id) {
      const resendNoMailbox = await resendVerification({
        institutionId: testInst.id,
        domainId: domain1Id,
        verificationMailbox: "",
        emailServiceOverride: tokenCapturingEmailService,
      })
      assert(
        !resendNoMailbox.success && resendNoMailbox.status === 400,
        "resendVerification without verificationMailbox returns 400"
      )
    }

    // Bad verify token test
    const badVerify = await verifyDomain("invalid-hex-token-12345")
    assert(!badVerify.success && badVerify.status === 400, "verifyDomain rejects invalid token (400)")

    // Verify syntheticDomain1 using the intercepted raw token
    assert(capturedToken.length > 0, "Obtained raw verification token via EmailService interceptor")
    const goodVerify = await verifyDomain(capturedToken)
    assert(goodVerify.success && goodVerify.status === 200, "verifyDomain marks domain verified (200)")

    // ------------------------------------------------------------------------
    // 4. Test 9 Ordering: Both Synthetic Institutions Register Pending Claims Before Verification
    // ------------------------------------------------------------------------
    console.log("\n--- 4. Test 9 Ordering: Duplicate Pending Claims & Partial Unique Index ---")
    // Both synthetic institutions register a pending claim for conflictDomain BEFORE either verifies
    capturedToken = ""
    const conflictClaim1 = await registerDomain({
      institutionId: testInst.id,
      domain: conflictDomain,
      verificationMailbox: "admin",
      defaultRoleId: loanOfficerRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })
    if (conflictClaim1.data?.id) createdDomainIds.push(conflictClaim1.data.id)
    const rawTokenInst1 = capturedToken
    assert(conflictClaim1.success && conflictClaim1.status === 201, "Institution 1 registers pending claim for conflictDomain (201)")

    capturedToken = ""
    const conflictClaim2 = await registerDomain({
      institutionId: testInst2.id,
      domain: conflictDomain,
      verificationMailbox: "admin",
      defaultRoleId: loanOfficerRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })
    if (conflictClaim2.data?.id) createdDomainIds.push(conflictClaim2.data.id)
    const rawTokenInst2 = capturedToken
    assert(conflictClaim2.success && conflictClaim2.status === 201, "Institution 2 registers pending claim for conflictDomain BEFORE either verifies (201)")

    // Now Institution 1 verifies first -> succeeds
    const verifyConflict1 = await verifyDomain(rawTokenInst1)
    assert(verifyConflict1.success && verifyConflict1.status === 200, "Institution 1 verifies conflictDomain first (200)")

    // Institution 2 now attempts to verify its pending claim for the same domain -> hits partial unique index (P2002 -> 409)
    const verifyConflict2 = await verifyDomain(rawTokenInst2)
    assert(
      !verifyConflict2.success && verifyConflict2.status === 409,
      "Institution 2 verify hits partial unique index (P2002 path) returning clear conflict (409)"
    )

    // ------------------------------------------------------------------------
    // 5. Staff Signup Under Verified Domain
    // ------------------------------------------------------------------------
    console.log("\n--- 5. Staff Signup Under Verified Domain ---")
    const signupRes = await signupUser({
      email: staffEmail,
      password: randomRunPassword,
      fullName: "Test Staff Member",
    })
    assert(signupRes.success && signupRes.status === 201, "signupUser returns generic 201 for valid domain")

    const pendingStaff = await centralPrisma.user.findUnique({
      where: { email: staffEmail },
    })
    if (pendingStaff) createdUserIds.push(pendingStaff.id)
    assert(pendingStaff?.status === "pending", "New staff account created in 'pending' status")

    // Signup for existing email returns same generic 201
    const duplicateSignup = await signupUser({
      email: staffEmail,
      password: randomRunPassword,
      fullName: "Duplicate Staff",
    })
    assert(duplicateSignup.success && duplicateSignup.status === 201, "Existing email signup returns identical generic 201")

    // Signup under unverified domain returns 400
    const unverifiedSignup = await signupUser({
      email: `user@unverified-${timestamp}.lk`,
      password: randomRunPassword,
      fullName: "Unverified User",
    })
    assert(!unverifiedSignup.success && unverifiedSignup.status === 400, "Unverified domain signup returns generic 400")

    // ------------------------------------------------------------------------
    // 6. Approve & Reject Staff Lifecycle & Validation
    // ------------------------------------------------------------------------
    console.log("\n--- 6. Staff Approval & Rejection Lifecycle ---")
    if (pendingStaff) {
      // Test 4(c): approveUser with roleId set to admin role returns 400
      const approveAdminRole = await approveUser({
        institutionId: testInst.id,
        userId: pendingStaff.id,
        roleId: adminRole.id,
      })
      assert(
        !approveAdminRole.success && approveAdminRole.status === 400,
        "approveUser with roleId set to admin role returns 400"
      )

      // Valid approval with HR role
      const approveRes = await approveUser({
        institutionId: testInst.id,
        userId: pendingStaff.id,
        roleId: hrOfficerRole.id,
      })
      assert(approveRes.success && approveRes.status === 200, "approveUser activates staff with specified role (200)")

      const reloadedStaff = await centralPrisma.user.findUnique({ where: { id: pendingStaff.id } })
      assert(reloadedStaff?.status === "active" && reloadedStaff?.roleId === hrOfficerRole.id, "Staff status is now 'active'")
    }

    // Create a second pending user to test rejectUser
    const rejectEmail = `reject-me@${syntheticDomain1}`
    const rejectUserRecord = await centralPrisma.user.create({
      data: {
        email: rejectEmail,
        fullName: "Reject Staff",
        passwordHash,
        institutionId: testInst.id,
        roleId: loanOfficerRole.id,
        status: "pending",
      },
    })
    createdUserIds.push(rejectUserRecord.id)

    const rejectRes = await rejectUser({
      institutionId: testInst.id,
      userId: rejectUserRecord.id,
    })
    assert(rejectRes.success && rejectRes.status === 200, "rejectUser sets status to disabled (200)")

    const reloadedReject = await centralPrisma.user.findUnique({ where: { id: rejectUserRecord.id } })
    assert(reloadedReject?.status === "disabled", "Rejected user confirmed 'disabled'")

    // ------------------------------------------------------------------------
    // 7. Revoking a PENDING Domain (Disables 0 Users)
    // ------------------------------------------------------------------------
    console.log("\n--- 7. Revoke Pending Domain (Disables 0 Users) ---")
    const pendingDomainRes = await registerDomain({
      institutionId: testInst.id,
      domain: syntheticDomain2,
      verificationMailbox: "admin",
      defaultRoleId: loanOfficerRole.id,
      emailServiceOverride: tokenCapturingEmailService,
    })

    const pendingDomainId = pendingDomainRes.data?.id
    if (pendingDomainId) createdDomainIds.push(pendingDomainId)

    const revokePendingRes = await revokeDomain({
      institutionId: testInst.id,
      domainId: pendingDomainId,
    })
    assert(
      revokePendingRes.success && revokePendingRes.data?.deactivatedUsersCount === 0,
      "Revoking PENDING domain disables 0 users (deactivatedUsersCount: 0)"
    )

    // ------------------------------------------------------------------------
    // 8. Last-Admin Conflict Guard on Verified Domain Revocation
    // ------------------------------------------------------------------------
    console.log("\n--- 8. Last-Admin Conflict Guard ---")
    // soleAdmin is on syntheticDomain1. If we attempt to revoke syntheticDomain1, it would disable the only admin.
    const lastAdminRevoke = await revokeDomain({
      institutionId: testInst.id,
      domainId: domain1Id,
    })
    assert(
      !lastAdminRevoke.success && lastAdminRevoke.status === 409,
      "Revoking domain with institution's last active admin triggers 409 conflict"
    )

    // Add a backup admin on a different non-domain email to allow verified revocation
    const backupAdmin = await centralPrisma.user.create({
      data: {
        email: `backup-admin@other-domain-${timestamp}.lk`,
        fullName: "Backup Admin",
        passwordHash,
        institutionId: testInst.id,
        roleId: adminRole.id,
        status: "active",
      },
    })
    createdUserIds.push(backupAdmin.id)

    // Test 4(e): In verified-domain revoke, include a PENDING user on that domain and assert it ends up disabled
    const pendingUserOnDomain1 = await centralPrisma.user.create({
      data: {
        email: `pending-test@${syntheticDomain1}`,
        fullName: "Pending User on Domain 1",
        passwordHash,
        institutionId: testInst.id,
        roleId: loanOfficerRole.id,
        status: "pending",
      },
    })
    createdUserIds.push(pendingUserOnDomain1.id)

    // Now revoking syntheticDomain1 should succeed and disable ALL users on syntheticDomain1 (including pending)
    const allowedRevoke = await revokeDomain({
      institutionId: testInst.id,
      domainId: domain1Id,
    })
    assert(
      allowedRevoke.success && (allowedRevoke.data?.deactivatedUsersCount ?? 0) >= 2,
      `Revoking VERIFIED domain succeeds when backup admin exists, deactivating domain users (${allowedRevoke.data?.deactivatedUsersCount})`
    )

    const disabledAdmin = await centralPrisma.user.findUnique({ where: { id: soleAdmin.id } })
    assert(disabledAdmin?.status === "disabled", "Admin on revoked domain is disabled")

    const reloadedPendingUser = await centralPrisma.user.findUnique({ where: { id: pendingUserOnDomain1.id } })
    assert(reloadedPendingUser?.status === "disabled", "Pending user on revoked domain is disabled (Test 4e)")

    // Test 4(d): approveUser for a pending user after their domain was revoked returns 400
    // Reset pendingUserOnDomain1 back to pending status for this test
    await centralPrisma.user.update({
      where: { id: pendingUserOnDomain1.id },
      data: { status: "pending" },
    })
    const approveAfterRevoke = await approveUser({
      institutionId: testInst.id,
      userId: pendingUserOnDomain1.id,
    })
    assert(
      !approveAfterRevoke.success && approveAfterRevoke.status === 400,
      "approveUser for a pending user after domain was revoked returns 400 (Test 4d)"
    )
  } catch (error) {
    logSafeError("[verify-domain-locking] Test execution threw error", error)
    anyTestFailed = true
    total++
  } finally {
    console.log("\n--- Cleaning Up Synthetic Isolated Entities (Strict FK Order) ---")

    // Cleanup Bug Fix: Users created inside signupUser or other paths must be completely tracked.
    // First collect every user id where institutionId is in createdInstitutionIds, union with createdUserIds:
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

    // Step 1: Delete login_audit rows for all tracked synthetic users
    try {
      if (allUserIdsToDelete.length > 0) {
        const audits = await centralPrisma.loginAudit.deleteMany({
          where: { userId: { in: allUserIdsToDelete } },
        })
        console.log(`Cleaned up ${audits.count} login_audit row(s).`)
      }
    } catch (err) {
      logSafeError("[cleanup] Failed to clean up login_audit rows", err)
    }

    // Step 2: Delete synthetic users
    try {
      if (allUserIdsToDelete.length > 0) {
        const users = await centralPrisma.user.deleteMany({
          where: { id: { in: allUserIdsToDelete } },
        })
        console.log(`Cleaned up ${users.count} synthetic user(s).`)
      }
    } catch (err) {
      logSafeError("[cleanup] Failed to clean up synthetic users", err)
    }

    // Step 3: Delete synthetic domains (by institutionId OR id)
    try {
      if (createdInstitutionIds.length > 0 || createdDomainIds.length > 0) {
        const doms = await centralPrisma.institutionDomain.deleteMany({
          where: {
            OR: [
              { institutionId: { in: createdInstitutionIds } },
              { id: { in: createdDomainIds } },
            ],
          },
        })
        console.log(`Cleaned up ${doms.count} synthetic domain(s).`)
      }
    } catch (err) {
      logSafeError("[cleanup] Failed to clean up synthetic domains", err)
    }

    // Step 4: Delete synthetic institutions
    try {
      if (createdInstitutionIds.length > 0) {
        const insts = await centralPrisma.institution.deleteMany({
          where: { id: { in: createdInstitutionIds } },
        })
        console.log(`Cleaned up ${insts.count} synthetic institution(s).`)
      }
    } catch (err) {
      logSafeError("[cleanup] Failed to clean up synthetic institutions", err)
    }

    // ------------------------------------------------------------------------
    // Safety Guard B: Recount and verify cleanup completeness
    // ------------------------------------------------------------------------
    let postUsersCount = -1
    let postInstCount = -1
    let postDomainCount = -1

    try {
      postUsersCount = await centralPrisma.user.count()
      postInstCount = await centralPrisma.institution.count()
      postDomainCount = await centralPrisma.institutionDomain.count()

      console.log(`\n[Cleanup Verification]`)
      console.log(`Institutions: Baseline = ${baselineInstCount}, Post = ${postInstCount} (Diff: ${postInstCount - baselineInstCount})`)
      console.log(`Users:        Baseline = ${baselineUsersCount}, Post = ${postUsersCount} (Diff: ${postUsersCount - baselineUsersCount})`)
      console.log(`Domains:      Baseline = ${baselineDomainCount}, Post = ${postDomainCount} (Diff: ${postDomainCount - baselineDomainCount})`)
    } catch (err) {
      logSafeError("[cleanup] Failed to recount database rows", err)
    }

    const cleanupComplete =
      baselineInstCount === postInstCount &&
      baselineUsersCount === postUsersCount &&
      baselineDomainCount === postDomainCount

    if (cleanupComplete) {
      console.log("Cleanup verified: Row counts restored to baseline perfectly.")
    } else {
      console.error("FAIL: CLEANUP INCOMPLETE! Row counts differ from baseline.")
      console.error("Created institution IDs:", createdInstitutionIds)
      console.error("Created user IDs:", allUserIdsToDelete)
      console.error("Created domain IDs:", createdDomainIds)
    }

    try {
      await centralPrisma.$disconnect()
    } catch (err) {
      logSafeError("[cleanup] Failed to disconnect Prisma client", err)
    }

    console.log(`\nFinal Summary: ${passed}/${total} checks passed.`)

    if (anyTestFailed || !cleanupComplete) {
      process.exitCode = 1
    }
  }
}

// Direct execution guard
if (process.argv[1]?.includes("verify-domain-locking")) {
  runDomainLockingVerification().catch((err) => {
    logSafeError("Verification script failed unexpectedly", err)
    process.exit(1)
  })
}
