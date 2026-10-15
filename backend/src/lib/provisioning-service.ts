import crypto from "crypto"
import path from "path"
import { fileURLToPath } from "url"
import { execFile } from "child_process"
import { promisify } from "util"
import { centralPrisma } from "./prisma-central.js"
import { getTenantPrisma, evictTenantClient } from "./prisma-tenant.js"
import { buildTenantDatabaseUrl } from "./tenant-context.js"
import { hashPassword, comparePassword, logSafeError, DUMMY_HASH } from "./auth.js"
import { DEFAULT_AGENT_POLICIES } from "./agent-defaults.js"

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
// backend/src/lib -> backend root is at ../..
const backendDir = path.resolve(__dirname, "../..")

export const SRI_LANKAN_DISTRICTS = [
  "ampara", "anuradhapura", "badulla", "batticaloa", "colombo",
  "galle", "gampaha", "hambantota", "jaffna", "kalutara",
  "kandy", "kegalle", "kilinochchi", "kurunegala", "mannar",
  "matale", "matara", "monaragala", "mullaitivu", "nuwara eliya",
  "polonnaruwa", "puttalam", "ratnapura", "trincomalee", "vavuniya"
] as const

export const INSTITUTION_TYPES = [
  "licensed_finance_company",
  "microfinance_ngo",
  "rural_development_bank",
  "cooperative_society"
] as const

export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export interface ProvisioningInput {
  institutionName: string
  licenseNumber?: string | null
  adminFullName: string
  adminEmail: string
  adminPassword: string
  institutionType?: string
  district?: string | null
  planName?: string
  billingCycle?: string
  // Module/test hook unreachable from HTTP requests
  _simulatedFailureStep?: "migration" | "bootstrap"
}

export interface ProvisioningResult {
  success: boolean
  status: number
  data?: {
    message: string
    institution: {
      id: string
      name: string
      status: string
    }
    admin: {
      id: string
      email: string
      fullName: string
      role: string
    }
  }
  error?: string
}

/**
 * Validates and sanitizes a tenant database name.
 * Format: imfs_tenant_<slug>_<8hex>
 * Must be <= 63 characters (PostgreSQL identifier limit).
 */
export function sanitizeTenantDbName(rawName: string): string {
  const slug = rawName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 36)

  const randomSuffix = crypto.randomBytes(4).toString("hex") // 8 hex chars
  const dbName = `imfs_tenant_${slug || "org"}_${randomSuffix}`

  if (!/^imfs_tenant_[a-z0-9_]{5,51}$/.test(dbName) || dbName.length > 63) {
    throw new Error("Generated database name failed security validation.")
  }

  return dbName
}

/**
 * Validates whether a database name is safe to drop.
 * Must match ^imfs_tenant_[a-z0-9_]+$ and NOT equal central database name.
 */
export function isSafeToDropDb(dbName: string, centralDbName: string): boolean {
  if (!/^imfs_tenant_[a-z0-9_]+$/.test(dbName)) {
    return false
  }
  if (dbName.toLowerCase() === centralDbName.toLowerCase()) {
    return false
  }
  return true
}

/**
 * Drops a physical tenant database safely with connection termination.
 */
export async function safelyDropTenantDatabase(dbName: string, centralDbName: string): Promise<boolean> {
  if (!isSafeToDropDb(dbName, centralDbName)) {
    console.error(`[provisioning-guard] Refusing to drop unsafe database name: ${dbName}`)
    return false
  }

  try {
    // Terminate existing connections first
    await centralPrisma.$queryRawUnsafe(
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
      dbName
    )

    // Execute DROP DATABASE
    await centralPrisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`)
    console.log(`[provisioning-guard] Dropped database "${dbName}" successfully.`)
    return true
  } catch (err) {
    logSafeError(`[provisioning-guard] Failed to drop database "${dbName}"`, err)
    return false
  }
}

/**
 * In-process concurrency cap tracker
 */
let inFlightProvisioningCount = 0

export function getMaxConcurrentProvisioning(): number {
  const envVal = process.env.MAX_CONCURRENT_PROVISIONING
  const parsed = envVal ? Number.parseInt(envVal, 10) : 2
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 2
}

/**
 * End-to-end tenant provisioning orchestration.
 */
export async function provisionTenant(input: ProvisioningInput): Promise<ProvisioningResult> {
  const maxConcurrent = getMaxConcurrentProvisioning()
  if (inFlightProvisioningCount >= maxConcurrent) {
    return {
      success: false,
      status: 503,
      error: "Service temporarily busy. Please retry shortly.",
    }
  }

  inFlightProvisioningCount++
  try {
    return await executeProvisioning(input)
  } finally {
    inFlightProvisioningCount--
  }
}

async function executeProvisioning(input: ProvisioningInput): Promise<ProvisioningResult> {
  const {
    institutionName,
    licenseNumber,
    adminFullName,
    adminEmail,
    adminPassword,
    institutionType = "microfinance_ngo",
    district,
    planName = "Starter",
    billingCycle = "monthly",
    _simulatedFailureStep,
  } = input

  // 1. Strict Input Validation (Guards against non-strings and invalid values)
  if (typeof institutionName !== "string" || institutionName.trim().length < 3 || institutionName.trim().length > 100) {
    return { success: false, status: 400, error: "Institution name must be a string between 3 and 100 characters" }
  }

  if (licenseNumber !== undefined && licenseNumber !== null) {
    if (typeof licenseNumber !== "string" || licenseNumber.length > 50) {
      return { success: false, status: 400, error: "License number must be a string of at most 50 characters" }
    }
  }

  if (typeof adminFullName !== "string" || adminFullName.trim().length < 2 || adminFullName.trim().length > 100) {
    return { success: false, status: 400, error: "Admin full name must be a string between 2 and 100 characters" }
  }

  if (typeof adminEmail !== "string" || !EMAIL_REGEX.test(adminEmail.trim())) {
    return { success: false, status: 400, error: "Admin email must be a valid email address string" }
  }
  const normalizedEmail = adminEmail.trim().toLowerCase()

  if (typeof adminPassword !== "string") {
    return { success: false, status: 400, error: "Admin password must be a string" }
  }
  const passwordBytes = Buffer.byteLength(adminPassword, "utf8")
  if (passwordBytes < 8 || passwordBytes > 72) {
    return { success: false, status: 400, error: "Admin password must be between 8 and 72 UTF-8 bytes" }
  }

  if (typeof institutionType !== "string" || !INSTITUTION_TYPES.includes(institutionType as any)) {
    return { success: false, status: 400, error: `Invalid institution type. Allowed: ${INSTITUTION_TYPES.join(", ")}` }
  }

  const allowedPlans = ["Starter", "Standard", "Professional", "Enterprise"]
  if (typeof planName !== "string" || !allowedPlans.includes(planName)) {
    return { success: false, status: 400, error: `Invalid plan name. Allowed: ${allowedPlans.join(", ")}` }
  }

  const allowedBillingCycles = ["monthly", "annual"]
  if (typeof billingCycle !== "string" || !allowedBillingCycles.includes(billingCycle)) {
    return { success: false, status: 400, error: `Invalid billing cycle. Allowed: ${allowedBillingCycles.join(", ")}` }
  }

  let normalizedDistrict: string | null = null
  if (district !== undefined && district !== null) {
    if (typeof district !== "string") {
      return { success: false, status: 400, error: "District must be a string" }
    }
    const dLower = district.trim().toLowerCase()
    if (!SRI_LANKAN_DISTRICTS.includes(dLower as any)) {
      return { success: false, status: 400, error: "District must be one of the 25 Sri Lankan districts" }
    }
    // Capitalize for display
    normalizedDistrict = dLower.charAt(0).toUpperCase() + dLower.slice(1)
  }

  // 2. Pre-hijack and Existing Email Verification
  // Check if email already exists
  const existingUser = await centralPrisma.user.findUnique({
    where: { email: normalizedEmail },
  })

  // Check if admin email domain is verified by an existing institution (pre-hijack mitigation)
  const emailDomain = normalizedEmail.split("@")[1]
  const verifiedDomain = await centralPrisma.institutionDomain.findFirst({
    where: {
      domain: { equals: emailDomain, mode: "insensitive" },
      status: "verified",
    },
  })

  if (existingUser || verifiedDomain) {
    // Perform dummy bcrypt comparison to preserve constant timing
    await comparePassword("dummy-password", DUMMY_HASH)
    console.log(
      "[tenant-audit]",
      JSON.stringify({
        event: "registration_conflict",
        email: normalizedEmail,
        hasExistingUser: !!existingUser,
        hasVerifiedDomain: !!verifiedDomain,
        timestamp: new Date().toISOString(),
      })
    )
    return { success: false, status: 400, error: "Registration request could not be processed" }
  }

  // 3. Resolve Database Host and Port from CENTRAL_DATABASE_URL
  const centralUrlStr = process.env.CENTRAL_DATABASE_URL
  if (!centralUrlStr) {
    logSafeError("[provisioning] Missing CENTRAL_DATABASE_URL", new Error("CENTRAL_DATABASE_URL not configured"))
    return { success: false, status: 500, error: "Failed to provision institution. Please try again." }
  }

  let dbHost = "localhost"
  let dbPort = 5436
  let centralDbName = "neondb"
  try {
    const parsed = new URL(centralUrlStr)
    dbHost = parsed.hostname
    dbPort = parsed.port ? parseInt(parsed.port, 10) : 5432
    centralDbName = parsed.pathname.replace(/^\//, "") || "neondb"
  } catch (err) {
    logSafeError("[provisioning] Failed to parse CENTRAL_DATABASE_URL", err)
    return { success: false, status: 500, error: "Failed to provision institution. Please try again." }
  }

  const adminRole = await centralPrisma.role.findUnique({ where: { name: "admin" } })
  if (!adminRole) {
    logSafeError("[provisioning] Role 'admin' missing in central database", new Error("admin role not found"))
    return { success: false, status: 500, error: "Failed to provision institution. Please try again." }
  }

  const passwordHash = await hashPassword(adminPassword)

  // 4. Creation Tracking Variables for Guaranteed Rollback
  let createdInstitutionId: string | null = null
  let createdUserId: string | null = null
  let createdDbRecordId: string | null = null
  let createdSubscriptionId: string | null = null
  let createdConfigId: string | null = null
  let physicalDbName: string | null = null
  let dbCreatedByThisRequest = false

  try {
    // ------------------------------------------------------------------------
    // Step A: Generate unique database name (up to 3 attempts on collision)
    // ------------------------------------------------------------------------
    let dbCreated = false
    let attempts = 0
    while (!dbCreated && attempts < 3) {
      attempts++
      const candidateDbName = sanitizeTenantDbName(institutionName)
      try {
        await centralPrisma.$executeRawUnsafe(`CREATE DATABASE "${candidateDbName}"`)
        physicalDbName = candidateDbName
        dbCreatedByThisRequest = true
        dbCreated = true
      } catch (createErr: any) {
        const msg = String(createErr?.message ?? "")
        if (msg.includes("already exists") || createErr?.code === "42P04") {
          console.log(`[provisioning] Database name collision for "${candidateDbName}", retrying attempt ${attempts}...`)
          continue
        }
        throw createErr
      }
    }

    if (!dbCreated || !physicalDbName) {
      throw new Error("Failed to create physical database after 3 attempts.")
    }

    // ------------------------------------------------------------------------
    // Step B: Create central metadata in a single transaction
    // ------------------------------------------------------------------------
    const centralTx = await centralPrisma.$transaction(async (tx) => {
      const inst = await tx.institution.create({
        data: {
          name: institutionName.trim(),
          licenseNumber: licenseNumber ? licenseNumber.trim() : null,
          status: "provisioning",
        },
      })

      const sub = await tx.subscription.create({
        data: {
          institutionId: inst.id,
          planName,
          billingCycle,
          status: "active",
          startDate: new Date(),
          endDate: null,
        },
      })

      const cfg = await tx.systemConfiguration.create({
        data: {
          institutionId: inst.id,
          configKey: "institution_type",
          configValue: { type: institutionType },
        },
      })

      const adm = await tx.user.create({
        data: {
          institutionId: inst.id,
          roleId: adminRole.id,
          fullName: adminFullName.trim(),
          email: normalizedEmail,
          passwordHash,
          status: "active",
        },
      })

      const dbr = await tx.institutionDatabase.create({
        data: {
          institutionId: inst.id,
          dbIdentifier: physicalDbName!,
          dbHost,
          dbPort,
          dbName: physicalDbName!,
          connectionUrl: null, // Derived dynamically at runtime
          status: "provisioning",
        },
      })

      return { inst, sub, cfg, adm, dbr }
    })

    createdInstitutionId = centralTx.inst.id
    createdSubscriptionId = centralTx.sub.id
    createdConfigId = centralTx.cfg.id
    createdUserId = centralTx.adm.id
    createdDbRecordId = centralTx.dbr.id

    // Hook: Simulated migration failure test
    if (_simulatedFailureStep === "migration") {
      throw new Error("SIMULATED_MIGRATION_FAILURE")
    }

    // ------------------------------------------------------------------------
    // Step C: Run tenant schema migrations on the physical database
    // ------------------------------------------------------------------------
    const tenantUrl = buildTenantDatabaseUrl(dbHost, dbPort, physicalDbName)
    const prismaCliPath = path.resolve(backendDir, "node_modules/prisma/build/index.js")

    await execFileAsync(
      process.execPath,
      [
        prismaCliPath,
        "migrate",
        "deploy",
        "--schema",
        "prisma/tenant/schema.prisma",
      ],
      {
        cwd: backendDir,
        env: {
          ...process.env,
          TENANT_DATABASE_URL: tenantUrl,
        },
        timeout: 30000,
        // Redact and discard stdout/stderr
        encoding: "utf8",
      }
    )

    // Hook: Simulated bootstrap failure test
    if (_simulatedFailureStep === "bootstrap") {
      throw new Error("SIMULATED_BOOTSTRAP_FAILURE")
    }

    // ------------------------------------------------------------------------
    // Step D: Bootstrap tenant database records
    // ------------------------------------------------------------------------
    const tenantPrisma = await getTenantPrisma(tenantUrl)

    // 1. tenant_info
    await tenantPrisma.tenantInfo.create({
      data: {
        id: 1,
        institutionId: centralTx.inst.id,
        institutionName: institutionName.trim(),
      },
    })

    // 2. Head Office branch
    const hqBranch = await tenantPrisma.branch.create({
      data: {
        name: "Head Office",
        district: normalizedDistrict,
        location: normalizedDistrict ? `${normalizedDistrict} HQ` : "Main Office",
        isActive: true,
      },
    })

    // 3. Admin employee record linked to Head Office branch
    await tenantPrisma.employee.create({
      data: {
        userId: centralTx.adm.id,
        branchId: hqBranch.id,
        position: "Administrator",
        employmentStatus: "active",
      },
    })

    // 4. Default Graduated Trust agent tier policies (A1-A4)
    await tenantPrisma.agentTierPolicy.createMany({
      data: [...DEFAULT_AGENT_POLICIES],
    })

    // ------------------------------------------------------------------------
    // Step E: Finalize central statuses to 'active'
    // ------------------------------------------------------------------------
    await centralPrisma.$transaction([
      centralPrisma.institution.update({
        where: { id: centralTx.inst.id },
        data: { status: "active" },
      }),
      centralPrisma.institutionDatabase.update({
        where: { id: centralTx.dbr.id },
        data: { status: "active" },
      }),
    ])

    console.log(
      "[tenant-audit]",
      JSON.stringify({
        event: "tenant_provisioned",
        institutionId: centralTx.inst.id,
        adminUserId: centralTx.adm.id,
        dbIdentifier: physicalDbName,
        timestamp: new Date().toISOString(),
      })
    )

    return {
      success: true,
      status: 201,
      data: {
        message: "Institution registered and provisioned successfully",
        institution: {
          id: centralTx.inst.id,
          name: centralTx.inst.name,
          status: "active",
        },
        admin: {
          id: centralTx.adm.id,
          email: centralTx.adm.email,
          fullName: centralTx.adm.fullName,
          role: "admin",
        },
      },
    }
  } catch (error) {
    logSafeError("[provisioning] Provisioning failed, executing cleanup", error)

    // ------------------------------------------------------------------------
    // Rollback Execution: Drop physical database ONLY if created by this request
    // ------------------------------------------------------------------------
    if (dbCreatedByThisRequest && physicalDbName) {
      // Evict any cached tenant Prisma client for this physical database before dropping
      try {
        const tenantUrlToEvict = buildTenantDatabaseUrl(dbHost, dbPort, physicalDbName)
        await evictTenantClient(tenantUrlToEvict)
      } catch {
        // Ignore URL construction failures during cleanup
      }

      await safelyDropTenantDatabase(physicalDbName, centralDbName)
    }

    // Clean up central rows in strict FK order
    if (createdUserId) {
      await centralPrisma.loginAudit.deleteMany({ where: { userId: createdUserId } }).catch((e) => logSafeError("[rollback] loginAudit cleanup", e))
      await centralPrisma.user.delete({ where: { id: createdUserId } }).catch((e) => logSafeError("[rollback] user cleanup", e))
    }

    if (createdDbRecordId) {
      await centralPrisma.institutionDatabase.delete({ where: { id: createdDbRecordId } }).catch((e) => logSafeError("[rollback] institutionDatabase cleanup", e))
    }

    if (createdConfigId) {
      await centralPrisma.systemConfiguration.delete({ where: { id: createdConfigId } }).catch((e) => logSafeError("[rollback] systemConfiguration cleanup", e))
    }

    if (createdSubscriptionId) {
      await centralPrisma.subscription.delete({ where: { id: createdSubscriptionId } }).catch((e) => logSafeError("[rollback] subscription cleanup", e))
    }

    if (createdInstitutionId) {
      const deleteInst = await centralPrisma.institution.delete({ where: { id: createdInstitutionId } }).catch(async (e) => {
        logSafeError("[rollback] institution delete failed, marking failed", e)
        // If deletion fails, mark status as 'failed'
        await centralPrisma.institution.update({
          where: { id: createdInstitutionId! },
          data: { status: "failed" },
        }).catch(() => {})
        return null
      })
      if (!deleteInst) {
        console.error(`[provisioning-fatal] Leftover institution marked as failed: ${createdInstitutionId}`)
      }
    }

    // Check if error was a unique violation (P2002) on admin email (race condition)
    const err = error as any
    if (err?.code === "P2002" || String(err?.message ?? "").includes("Unique constraint failed")) {
      return {
        success: false,
        status: 400,
        error: "Registration request could not be processed",
      }
    }

    return {
      success: false,
      status: 500,
      error: "Failed to provision institution. Please try again.",
    }
  }
}
