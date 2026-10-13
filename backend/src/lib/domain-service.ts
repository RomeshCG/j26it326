import crypto from "crypto"
import { centralPrisma } from "./prisma-central.js"
import { invalidateUserAuthCache } from "../middleware/auth.js"
import { hashPassword, comparePassword, logSafeError } from "./auth.js"
import { normalizeDomain, isValidDomainFormat, isBlockedDomain } from "./freemail-blocklist.js"
import { emailService, type EmailService } from "./email.js"

export const MAILBOX_REGEX = /^[a-z0-9._-]{1,64}$/
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex")
}

export interface DomainServiceResult<T = any> {
  success: boolean
  status: number
  data?: T
  error?: string
}

/**
 * Helper: Validate that a given role is not 'admin'
 */
export async function validateNonAdminRole(roleId: number): Promise<boolean> {
  const role = await centralPrisma.role.findUnique({ where: { id: roleId } })
  if (!role || role.name === "admin") {
    return false
  }
  return true
}

/**
 * Verify a domain using a raw token.
 * Sets status to verified and clears the token hash & expiry.
 */
export async function verifyDomain(rawToken: string): Promise<DomainServiceResult> {
  if (!rawToken || typeof rawToken !== "string" || rawToken.trim().length === 0) {
    return { success: false, status: 400, error: "Verification token is required" }
  }

  const tokenHash = hashToken(rawToken.trim())

  try {
    const domainRecord = await centralPrisma.institutionDomain.findUnique({
      where: { verificationTokenHash: tokenHash },
    })

    if (!domainRecord) {
      return { success: false, status: 400, error: "Invalid or expired verification token" }
    }

    if (domainRecord.tokenExpiresAt && domainRecord.tokenExpiresAt.getTime() < Date.now()) {
      return { success: false, status: 400, error: "Verification token has expired" }
    }

    if (domainRecord.status === "verified") {
      return {
        success: true,
        status: 200,
        data: { message: "Domain has already been verified", domain: domainRecord.domain },
      }
    }

    if (domainRecord.status !== "pending") {
      return { success: false, status: 400, error: "Domain claim is not in a pending state" }
    }

    try {
      const updated = await centralPrisma.institutionDomain.update({
        where: { id: domainRecord.id },
        data: {
          status: "verified",
          verifiedAt: new Date(),
          verificationTokenHash: null,
          tokenExpiresAt: null,
        },
      })

      console.log(
        "[domain-audit]",
        JSON.stringify({
          event: "domain_verified",
          domainId: updated.id,
          domain: updated.domain,
          institutionId: updated.institutionId,
          timestamp: new Date().toISOString(),
        })
      )

      return {
        success: true,
        status: 200,
        data: {
          message: "Domain verified successfully",
          domain: updated.domain,
        },
      }
    } catch (updateErr: any) {
      if (updateErr?.code === "P2002" || String(updateErr?.message).includes("institution_domains_domain_verified_idx")) {
        return {
          success: false,
          status: 409,
          error: "This domain has already been claimed and verified by another institution.",
        }
      }
      throw updateErr
    }
  } catch (error) {
    logSafeError("[domain-service] Verify error", error)
    return { success: false, status: 500, error: "Internal verification error" }
  }
}

/**
 * Register a corporate domain claim for an institution.
 * Sends a verification email.
 */
export async function registerDomain(params: {
  institutionId: string
  domain: string
  verificationMailbox: string
  defaultRoleId: number
  emailServiceOverride?: EmailService
}): Promise<DomainServiceResult> {
  const { institutionId, domain, verificationMailbox, defaultRoleId, emailServiceOverride } = params
  const mailer = emailServiceOverride ?? emailService

  if (!domain || typeof domain !== "string" || !isValidDomainFormat(domain)) {
    return { success: false, status: 400, error: "Invalid domain format. Provide a valid fully qualified domain name." }
  }
  const normalized = normalizeDomain(domain)

  const blockCheck = isBlockedDomain(normalized)
  if (blockCheck.blocked) {
    return { success: false, status: 400, error: blockCheck.reason }
  }

  if (!verificationMailbox || typeof verificationMailbox !== "string") {
    return { success: false, status: 400, error: "verificationMailbox is required" }
  }
  const mailboxLocal = verificationMailbox.trim().toLowerCase()
  if (!MAILBOX_REGEX.test(mailboxLocal)) {
    return {
      success: false,
      status: 400,
      error: "Invalid verificationMailbox. Must contain 1-64 characters (lowercase letters, digits, '.', '_', '-')",
    }
  }

  if (!Number.isInteger(defaultRoleId) || defaultRoleId <= 0) {
    return { success: false, status: 400, error: "defaultRoleId must be a positive integer role ID" }
  }
  const roleOk = await validateNonAdminRole(defaultRoleId)
  if (!roleOk) {
    return { success: false, status: 400, error: "Invalid default role ID. The admin role cannot be configured as default." }
  }

  const targetEmail = `${mailboxLocal}@${normalized}`
  const rawToken = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashToken(rawToken)
  const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  try {
    const existingVerified = await centralPrisma.institutionDomain.findFirst({
      where: { domain: normalized, status: "verified" },
    })
    if (existingVerified) {
      return { success: false, status: 409, error: "This domain has already been claimed and verified." }
    }

    const existingPending = await centralPrisma.institutionDomain.findFirst({
      where: { domain: normalized, institutionId, status: "pending" },
    })

    let recordId: string
    const isNewClaim = !existingPending
    if (existingPending) {
      const updated = await centralPrisma.institutionDomain.update({
        where: { id: existingPending.id },
        data: {
          defaultRoleId,
          verificationTokenHash: tokenHash,
          tokenExpiresAt,
        },
      })
      recordId = updated.id
    } else {
      const created = await centralPrisma.institutionDomain.create({
        data: {
          institutionId,
          domain: normalized,
          status: "pending",
          defaultRoleId,
          verificationTokenHash: tokenHash,
          tokenExpiresAt,
        },
      })
      recordId = created.id
    }

    try {
      await mailer.sendDomainVerification(targetEmail, normalized, rawToken)
    } catch (emailErr) {
      if (isNewClaim) {
        await centralPrisma.institutionDomain.delete({ where: { id: recordId } }).catch(() => {})
      } else {
        await centralPrisma.institutionDomain.update({
          where: { id: recordId },
          data: { verificationTokenHash: null, tokenExpiresAt: null },
        }).catch(() => {})
      }
      logSafeError("[domain-service] Failed to dispatch verification email", emailErr)
      return { success: false, status: 500, error: "Failed to dispatch verification email. Please try again." }
    }

    console.log(
      "[domain-audit]",
      JSON.stringify({
        event: "domain_registration_initiated",
        domainId: recordId,
        domain: normalized,
        institutionId,
        recipientMailbox: targetEmail,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 201,
      data: {
        id: recordId,
        domain: normalized,
        status: "pending",
        defaultRoleId,
        recipientEmail: targetEmail,
        tokenExpiresAt,
      },
    }
  } catch (error) {
    logSafeError("[domain-service] Register domain error", error)
    return { success: false, status: 500, error: "Failed to register domain" }
  }
}

/**
 * Resend domain verification email for an unverified pending domain claim.
 */
export async function resendVerification(params: {
  institutionId: string
  domainId: string
  verificationMailbox: string
  emailServiceOverride?: EmailService
}): Promise<DomainServiceResult> {
  const { institutionId, domainId, verificationMailbox, emailServiceOverride } = params
  const mailer = emailServiceOverride ?? emailService

  if (!verificationMailbox || typeof verificationMailbox !== "string") {
    return { success: false, status: 400, error: "verificationMailbox is required" }
  }
  const mailboxLocal = verificationMailbox.trim().toLowerCase()
  if (!MAILBOX_REGEX.test(mailboxLocal)) {
    return {
      success: false,
      status: 400,
      error: "Invalid verificationMailbox. Must contain 1-64 characters (lowercase letters, digits, '.', '_', '-')",
    }
  }

  try {
    const domainRecord = await centralPrisma.institutionDomain.findFirst({
      where: { id: domainId, institutionId },
    })

    if (!domainRecord) {
      return { success: false, status: 404, error: "Domain not found" }
    }

    if (domainRecord.status !== "pending") {
      return { success: false, status: 400, error: `Cannot resend verification for a ${domainRecord.status} domain` }
    }

    const targetEmail = `${mailboxLocal}@${domainRecord.domain}`
    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = hashToken(rawToken)
    const tokenExpiresAt = new Date(Date.now() + TOKEN_TTL_MS)

    await centralPrisma.institutionDomain.update({
      where: { id: domainRecord.id },
      data: {
        verificationTokenHash: tokenHash,
        tokenExpiresAt,
      },
    })

    try {
      await emailService.sendDomainVerification(targetEmail, domainRecord.domain, rawToken)
    } catch (emailErr) {
      await centralPrisma.institutionDomain.update({
        where: { id: domainRecord.id },
        data: { verificationTokenHash: null, tokenExpiresAt: null },
      }).catch(() => {})
      logSafeError("[domain-service] Failed to dispatch resend verification email", emailErr)
      return { success: false, status: 500, error: "Failed to send verification email" }
    }

    console.log(
      "[domain-audit]",
      JSON.stringify({
        event: "domain_verification_resent",
        domainId: domainRecord.id,
        domain: domainRecord.domain,
        institutionId,
        recipientMailbox: targetEmail,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 200,
      data: { message: "Verification link resent successfully" },
    }
  } catch (error) {
    logSafeError("[domain-service] Resend verification error", error)
    return { success: false, status: 500, error: "Failed to resend verification link" }
  }
}

/**
 * Revoke a domain claim.
 * If the domain was verified, disables all active and pending users on that domain,
 * guarded by the last-admin check. If pending, disables 0 users.
 */
export async function revokeDomain(params: {
  institutionId: string
  domainId: string
}): Promise<DomainServiceResult> {
  const { institutionId, domainId } = params

  try {
    const domainRecord = await centralPrisma.institutionDomain.findFirst({
      where: { id: domainId, institutionId },
    })

    if (!domainRecord) {
      return { success: false, status: 404, error: "Domain not found" }
    }

    if (domainRecord.status === "revoked") {
      return { success: false, status: 400, error: "Domain is already revoked" }
    }

    const domainSuffix = `@${domainRecord.domain}`
    const isVerifiedDomain = domainRecord.status === "verified"

    const result = await centralPrisma.$transaction(async (tx) => {
      let userIdsToDisable: string[] = []

      if (isVerifiedDomain) {
        const domainUsers = await tx.user.findMany({
          where: {
            institutionId,
            email: { endsWith: domainSuffix, mode: "insensitive" },
            status: { in: ["active", "pending"] },
          },
          include: { role: true },
        })

        const totalActiveAdmins = await tx.user.count({
          where: {
            institutionId,
            role: { name: "admin" },
            status: "active",
          },
        })

        const adminsInRevokedDomain = domainUsers.filter((u) => u.role.name === "admin" && u.status === "active").length

        if (totalActiveAdmins - adminsInRevokedDomain <= 0) {
          throw new Error("LAST_ADMIN_CONFLICT")
        }

        userIdsToDisable = domainUsers.map((u) => u.id)
        if (userIdsToDisable.length > 0) {
          await tx.user.updateMany({
            where: { id: { in: userIdsToDisable } },
            data: { status: "disabled" },
          })
        }
      }

      const updatedDomain = await tx.institutionDomain.update({
        where: { id: domainRecord.id },
        data: {
          status: "revoked",
          verificationTokenHash: null,
          tokenExpiresAt: null,
        },
      })

      return {
        updatedDomain,
        disabledUserIds: userIdsToDisable,
      }
    })

    for (const uid of result.disabledUserIds) {
      invalidateUserAuthCache(uid)
    }

    console.log(
      "[domain-audit]",
      JSON.stringify({
        event: "domain_revoked",
        domainId: result.updatedDomain.id,
        domain: result.updatedDomain.domain,
        institutionId,
        disabledUsersCount: result.disabledUserIds.length,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 200,
      data: {
        id: result.updatedDomain.id,
        domain: result.updatedDomain.domain,
        status: "revoked",
        deactivatedUsersCount: result.disabledUserIds.length,
      },
    }
  } catch (error: any) {
    if (error?.message === "LAST_ADMIN_CONFLICT") {
      return {
        success: false,
        status: 409,
        error: "Cannot revoke domain: operation would deactivate the last active administrator for this institution.",
      }
    }
    logSafeError("[domain-service] Revoke domain error", error)
    return { success: false, status: 500, error: "Failed to revoke domain" }
  }
}

/**
 * Approve a pending staff user.
 * Re-checks that the user's domain is still verified, and allows optional roleId override.
 */
export async function approveUser(params: {
  institutionId: string
  userId: string
  roleId?: number
}): Promise<DomainServiceResult> {
  const { institutionId, userId, roleId } = params

  try {
    const user = await centralPrisma.user.findFirst({
      where: { id: userId, institutionId },
      include: { role: true },
    })

    if (!user) {
      return { success: false, status: 404, error: "User not found" }
    }

    if (user.status !== "pending") {
      return { success: false, status: 400, error: `User is not in pending status (current status: ${user.status})` }
    }

    const userDomain = user.email.split("@")[1]?.toLowerCase()
    const verifiedDomain = await centralPrisma.institutionDomain.findFirst({
      where: {
        institutionId,
        domain: { equals: userDomain, mode: "insensitive" },
        status: "verified",
      },
    })

    if (!verifiedDomain) {
      return { success: false, status: 400, error: "Cannot approve user: domain is no longer verified for this institution" }
    }

    let targetRoleId = user.roleId
    if (roleId !== undefined) {
      if (!Number.isInteger(roleId) || roleId <= 0) {
        return { success: false, status: 400, error: "roleId must be a positive integer role ID" }
      }
      const roleOk = await validateNonAdminRole(roleId)
      if (!roleOk) {
        return { success: false, status: 400, error: "Invalid roleId. The admin role cannot be assigned to staff approvals." }
      }
      targetRoleId = roleId
    }

    const updatedUser = await centralPrisma.user.update({
      where: { id: user.id },
      data: {
        status: "active",
        roleId: targetRoleId,
      },
      include: { role: true },
    })

    invalidateUserAuthCache(updatedUser.id)

    console.log(
      "[domain-audit]",
      JSON.stringify({
        event: "user_approved",
        userId: updatedUser.id,
        email: updatedUser.email,
        institutionId,
        role: updatedUser.role.name,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 200,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        fullName: updatedUser.fullName,
        role: updatedUser.role.name,
        status: updatedUser.status,
      },
    }
  } catch (error) {
    logSafeError("[domain-service] Approve user error", error)
    return { success: false, status: 500, error: "Failed to approve user" }
  }
}

/**
 * Reject a pending staff user.
 * Sets status to disabled and invalidates cache.
 */
export async function rejectUser(params: {
  institutionId: string
  userId: string
}): Promise<DomainServiceResult> {
  const { institutionId, userId } = params

  try {
    const user = await centralPrisma.user.findFirst({
      where: { id: userId, institutionId },
    })

    if (!user) {
      return { success: false, status: 404, error: "User not found" }
    }

    if (user.status !== "pending") {
      return { success: false, status: 400, error: `User is not in pending status (current status: ${user.status})` }
    }

    const updatedUser = await centralPrisma.user.update({
      where: { id: user.id },
      data: { status: "disabled" },
    })

    invalidateUserAuthCache(updatedUser.id)

    console.log(
      "[domain-audit]",
      JSON.stringify({
        event: "user_rejected",
        userId: updatedUser.id,
        email: updatedUser.email,
        institutionId,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 200,
      data: {
        id: updatedUser.id,
        email: updatedUser.email,
        status: updatedUser.status,
      },
    }
  } catch (error) {
    logSafeError("[domain-service] Reject user error", error)
    return { success: false, status: 500, error: "Failed to reject user" }
  }
}

/**
 * Self-service staff registration under a verified domain.
 * Enforces timing parity and generic 201 responses.
 */
export async function signupUser(params: {
  email: string
  password: string
  fullName: string
}): Promise<DomainServiceResult> {
  const { email, password, fullName } = params

  if (!fullName || typeof fullName !== "string" || fullName.trim().length === 0 || fullName.trim().length > 100) {
    return { success: false, status: 400, error: "Full name is required (max 100 characters)" }
  }

  if (!email || typeof email !== "string" || email.trim().length > 255 || !EMAIL_REGEX.test(email.trim())) {
    return { success: false, status: 400, error: "Valid email address is required" }
  }

  if (!password || typeof password !== "string") {
    return { success: false, status: 400, error: "Password is required" }
  }
  const passwordBytes = Buffer.byteLength(password, "utf8")
  if (passwordBytes < 8 || passwordBytes > 72) {
    return { success: false, status: 400, error: "Password must be between 8 and 72 bytes" }
  }

  const normalizedEmail = email.trim().toLowerCase()
  const domainPart = normalizedEmail.split("@")[1]

  try {
    const verifiedDomain = await centralPrisma.institutionDomain.findFirst({
      where: {
        domain: domainPart,
        status: "verified",
      },
      include: {
        institution: true,
      },
    })

    if (!verifiedDomain || verifiedDomain.institution.status !== "active") {
      return { success: false, status: 400, error: "Registration is not available for this email address" }
    }

    const existingUser = await centralPrisma.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      await comparePassword(password, null)
      return {
        success: true,
        status: 201,
        data: { message: "Registration received. Awaiting administrator approval" },
      }
    }

    const passwordHash = await hashPassword(password)
    try {
      const newUser = await centralPrisma.user.create({
        data: {
          email: normalizedEmail,
          fullName: fullName.trim(),
          passwordHash,
          institutionId: verifiedDomain.institutionId,
          roleId: verifiedDomain.defaultRoleId,
          status: "pending",
        },
      })

      console.log(
        "[domain-audit]",
        JSON.stringify({
          event: "user_registered_pending",
          userId: newUser.id,
          email: newUser.email,
          institutionId: newUser.institutionId,
          domain: verifiedDomain.domain,
          timestamp: new Date().toISOString(),
        })
      )
    } catch (createErr: any) {
      if (createErr?.code === "P2002") {
        return {
          success: true,
          status: 201,
          data: { message: "Registration received. Awaiting administrator approval" },
        }
      }
      throw createErr
    }

    return {
      success: true,
      status: 201,
      data: { message: "Registration received. Awaiting administrator approval" },
    }
  } catch (error) {
    logSafeError("[domain-service] Signup error", error)
    return { success: false, status: 500, error: "Internal registration error" }
  }
}
