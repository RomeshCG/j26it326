import type { Request, Response, NextFunction } from "express"

/**
 * Security Hardening A: In-Memory Bounded Rate Limiting & Account Lockout
 *
 * Provides in-process sliding-window rate limiters and multi-tier login lockout:
 * 1. IP total request cap on /auth/login (default 200 per 15 min)
 * 2. IP failed attempts limit on /auth/login (default 20 per 15 min)
 * 3. Pair lockout per (email|ip) (default 5 failures per 15 min -> 15 min lock)
 * 4. Aggregate email lockout across all IPs (default 30 failures per hour -> 15 min lock)
 * 5. IP limiters for /auth/signup, /auth/domains/verify, /auth/register-institution, and admin endpoints
 *
 * Limitation: Counters are stored in-process. When running multiple backend
 * instances behind a load balancer, a distributed store such as Redis is required.
 */

export interface StoreEntry {
  count: number
  windowResetTime: number
  lockedUntil: number | null
  lastSeen: number
}

/**
 * Trust proxy configuration helper (Amendment 6).
 * Documents hop count (e.g. 1) as recommended production value for Railway/Render/Fly.
 * Warns that 'true' trusts any forwarded header and must not be used if app is directly reachable.
 * Validates value at startup and fails closed to false on invalid input.
 */
export function configureTrustProxy(application: { set: (key: string, val: any) => void }, rawVal: string | undefined): void {
  if (!rawVal || rawVal === "false") {
    application.set("trust proxy", false)
    return
  }
  if (rawVal === "true") {
    console.warn(
      "[security-audit] WARNING: TRUST_PROXY='true' trusts all forwarded headers. Do not use if application is directly reachable."
    )
    application.set("trust proxy", true)
    return
  }
  if (/^\d+$/.test(rawVal)) {
    const hops = parseInt(rawVal, 10)
    if (hops >= 1) {
      application.set("trust proxy", hops)
      return
    }
  }
  const knownSubnetKeywords = ["loopback", "linklocal", "uniquelocal"]
  if (knownSubnetKeywords.includes(rawVal.toLowerCase())) {
    application.set("trust proxy", rawVal.toLowerCase())
    return
  }
  console.warn(`[security-audit] Invalid TRUST_PROXY value '${rawVal}'. Failing closed to false.`)
  application.set("trust proxy", false)
}

/**
 * Bounded Map store with 3-tier eviction:
 * 1. Expired entries (windowResetTime <= now && (!lockedUntil || lockedUntil <= now))
 * 2. Unlocked entries (LRU by lastSeen)
 * 3. Active locks (evicted only if 100% of the map capacity is active locks)
 */
export class BoundedStore {
  private map: Map<string, StoreEntry> = new Map()
  public readonly name: string
  public readonly maxEntries: number

  constructor(name: string, maxEntries: number = 10000) {
    this.name = name
    this.maxEntries = maxEntries
  }

  get size(): number {
    return this.map.size
  }

  get(key: string, now: number = Date.now()): StoreEntry | undefined {
    const entry = this.map.get(key)
    if (entry) {
      entry.lastSeen = now
    }
    return entry
  }

  set(key: string, entry: StoreEntry, now: number = Date.now()): void {
    entry.lastSeen = now
    if (this.map.has(key)) {
      this.map.set(key, entry)
      return
    }

    if (this.map.size >= this.maxEntries) {
      this.evict(now)
    }

    this.map.set(key, entry)
  }

  delete(key: string): boolean {
    return this.map.delete(key)
  }

  clear(): void {
    this.map.clear()
  }

  entries(): IterableIterator<[string, StoreEntry]> {
    return this.map.entries()
  }

  /**
   * Eviction algorithm meeting Amendment 4:
   * Evicts expired first, then unlocked entries (LRU), then active locks last.
   */
  evict(now: number = Date.now()): void {
    // 1. Evict expired entries
    for (const [k, v] of this.map.entries()) {
      const isWindowExpired = v.windowResetTime <= now
      const isLockExpired = !v.lockedUntil || v.lockedUntil <= now
      if (isWindowExpired && isLockExpired) {
        this.map.delete(k)
      }
    }

    if (this.map.size < this.maxEntries) {
      return
    }

    // 2. Evict unlocked entries (LRU by lastSeen)
    let oldestUnlockedKey: string | null = null
    let oldestUnlockedTime = Infinity

    for (const [k, v] of this.map.entries()) {
      const isLocked = Boolean(v.lockedUntil && v.lockedUntil > now)
      if (!isLocked) {
        if (v.lastSeen < oldestUnlockedTime) {
          oldestUnlockedTime = v.lastSeen
          oldestUnlockedKey = k
        }
      }
    }

    if (oldestUnlockedKey) {
      this.map.delete(oldestUnlockedKey)
      return
    }

    // 3. Evict active lock only if nothing else can be evicted (LRU)
    let oldestLockKey: string | null = null
    let oldestLockTime = Infinity

    for (const [k, v] of this.map.entries()) {
      if (v.lastSeen < oldestLockTime) {
        oldestLockTime = v.lastSeen
        oldestLockKey = k
      }
    }

    if (oldestLockKey) {
      this.map.delete(oldestLockKey)
    }
  }
}

/**
 * Check if rate limiting is enabled.
 * Amendment 5: ENABLE_RATE_LIMITING=false is IGNORED when NODE_ENV=production.
 */
export function isRateLimitingEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV === "production") {
    return true
  }
  return env.ENABLE_RATE_LIMITING !== "false"
}

// Global configuration helpers with safe fallback parsing
function parseEnvInt(val: string | undefined, defaultVal: number): number {
  if (!val) return defaultVal
  const parsed = parseInt(val, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultVal
}

const DEFAULT_MAX_ENTRIES = 10000

function getMaxEntries(): number {
  return parseEnvInt(process.env.RATE_LIMIT_MAX_ENTRIES, DEFAULT_MAX_ENTRIES)
}

// Separate stores per limiter (Amendment 4)
export const loginIpTotalStore = new BoundedStore("login-ip-total", getMaxEntries())
export const loginIpFailStore = new BoundedStore("login-ip-fail", getMaxEntries())
export const loginPairLockoutStore = new BoundedStore("login-pair-lockout", getMaxEntries())
export const loginEmailLockoutStore = new BoundedStore("login-email-lockout", getMaxEntries())
export const signupIpStore = new BoundedStore("signup-ip", getMaxEntries())
export const verifyDomainIpStore = new BoundedStore("verify-domain-ip", getMaxEntries())
export const registerInstitutionIpStore = new BoundedStore("register-institution-ip", getMaxEntries())
export const adminTenantIpStore = new BoundedStore("admin-tenant-ip", getMaxEntries())

/**
 * Resets all rate limit and lockout stores (for test isolation)
 */
export function resetRateLimits(): void {
  loginIpTotalStore.clear()
  loginIpFailStore.clear()
  loginPairLockoutStore.clear()
  loginEmailLockoutStore.clear()
  signupIpStore.clear()
  verifyDomainIpStore.clear()
  registerInstitutionIpStore.clear()
  adminTenantIpStore.clear()
}

/**
 * Mask email for structured security audit logs (e.g. ad***@apex.lk)
 */
export function maskEmail(email: string): string {
  const parts = email.split("@")
  if (parts.length !== 2) return "***"
  const [local, domain] = parts
  const prefix = local.length > 2 ? local.substring(0, 2) : local.substring(0, 1)
  return `${prefix}***@${domain}`
}

export interface RateLimitResult {
  allowed: boolean
  retryAfter: number // in seconds
  currentCount: number
  max: number
}

/**
 * Standard sliding-window rate limit evaluation
 */
export function checkAndIncrementRateLimit(
  store: BoundedStore,
  key: string,
  max: number,
  windowMs: number,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): RateLimitResult {
  if (!isRateLimitingEnabled(env)) {
    return { allowed: true, retryAfter: 0, currentCount: 1, max }
  }

  let entry = store.get(key, now)
  if (!entry || entry.windowResetTime <= now) {
    entry = {
      count: 1,
      windowResetTime: now + windowMs,
      lockedUntil: null,
      lastSeen: now,
    }
    store.set(key, entry, now)
    return { allowed: true, retryAfter: 0, currentCount: 1, max }
  }

  if (entry.count >= max) {
    const retryAfter = Math.max(1, Math.ceil((entry.windowResetTime - now) / 1000))
    return { allowed: false, retryAfter, currentCount: entry.count, max }
  }

  entry.count += 1
  store.set(key, entry, now)
  return { allowed: true, retryAfter: 0, currentCount: entry.count, max }
}

// ----------------------------------------------------------------------------
// Login Route Rate Limiting & Lockout Engine
// ----------------------------------------------------------------------------

export interface LoginLimitsConfig {
  ipTotalMax: number
  ipTotalWindowMs: number
  ipFailMax: number
  ipFailWindowMs: number
  pairFailMax: number
  pairWindowMs: number
  pairDurationMs: number
  emailFailMax: number
  emailWindowMs: number
  emailDurationMs: number
}

export function getLoginLimitsConfig(env: NodeJS.ProcessEnv = process.env): LoginLimitsConfig {
  return {
    ipTotalMax: parseEnvInt(env.RATE_LIMIT_LOGIN_IP_TOTAL_MAX, 200),
    ipTotalWindowMs: parseEnvInt(env.RATE_LIMIT_LOGIN_IP_TOTAL_WINDOW_MS, 15 * 60 * 1000), // 15 min
    ipFailMax: parseEnvInt(env.RATE_LIMIT_LOGIN_IP_FAIL_MAX, 20),
    ipFailWindowMs: parseEnvInt(env.RATE_LIMIT_LOGIN_IP_FAIL_WINDOW_MS, 15 * 60 * 1000), // 15 min
    pairFailMax: parseEnvInt(env.LOCKOUT_PAIR_FAIL_MAX, 5),
    pairWindowMs: parseEnvInt(env.LOCKOUT_PAIR_WINDOW_MS, 15 * 60 * 1000), // 15 min
    pairDurationMs: parseEnvInt(env.LOCKOUT_PAIR_DURATION_MS, 15 * 60 * 1000), // 15 min
    emailFailMax: parseEnvInt(env.LOCKOUT_EMAIL_FAIL_MAX, 100),
    emailWindowMs: parseEnvInt(env.LOCKOUT_EMAIL_WINDOW_MS, 60 * 60 * 1000), // 1 hour
    emailDurationMs: parseEnvInt(env.LOCKOUT_EMAIL_DURATION_MS, 15 * 60 * 1000), // 15 min
  }
}

/**
 * Check if the client IP has exceeded the failed attempts cap (Amendment 3)
 */
export function checkLoginIpFailLimit(
  clientIp: string,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): { allowed: boolean; retryAfter: number } {
  if (!isRateLimitingEnabled(env)) return { allowed: true, retryAfter: 0 }
  const cfg = getLoginLimitsConfig(env)
  const entry = loginIpFailStore.get(clientIp, now)
  if (!entry || entry.windowResetTime <= now) {
    return { allowed: true, retryAfter: 0 }
  }

  if (entry.count >= cfg.ipFailMax) {
    const retryAfter = Math.max(1, Math.ceil((entry.windowResetTime - now) / 1000))
    return { allowed: false, retryAfter }
  }

  return { allowed: true, retryAfter: 0 }
}

export interface LockoutCheckResult {
  locked: boolean
  retryAfter: number
  tier?: "pair" | "aggregate"
}

/**
 * Check if the given email/IP pair OR aggregate email is currently locked (Amendment 1)
 */
export function checkLoginLockout(
  normalizedEmail: string,
  clientIp: string,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): LockoutCheckResult {
  if (!isRateLimitingEnabled(env)) return { locked: false, retryAfter: 0 }

  const pairKey = `${normalizedEmail}|${clientIp}`
  const emailKey = normalizedEmail

  // 1. Check pair lock
  const pairEntry = loginPairLockoutStore.get(pairKey, now)
  const isPairLocked = Boolean(pairEntry?.lockedUntil && pairEntry.lockedUntil > now)
  const pairRetry = isPairLocked ? Math.max(1, Math.ceil((pairEntry!.lockedUntil! - now) / 1000)) : 0

  // 2. Check aggregate email lock
  const emailEntry = loginEmailLockoutStore.get(emailKey, now)
  const isEmailLocked = Boolean(emailEntry?.lockedUntil && emailEntry.lockedUntil > now)
  const emailRetry = isEmailLocked ? Math.max(1, Math.ceil((emailEntry!.lockedUntil! - now) / 1000)) : 0

  if (isPairLocked || isEmailLocked) {
    const maxRetry = Math.max(pairRetry, emailRetry)
    const tier = isEmailLocked ? "aggregate" : "pair"
    return { locked: true, retryAfter: maxRetry, tier }
  }

  return { locked: false, retryAfter: 0 }
}

export interface LoginFailureResult {
  justLocked: boolean
  tierLocked?: "pair" | "aggregate"
  retryAfter: number
}

/**
 * Register a failed login attempt (Amendment 1 & 2).
 * Counted for unknown emails, bad passwords, pending accounts, disabled accounts, and inactive institutions.
 */
export function handleLoginFailure(
  normalizedEmail: string,
  clientIp: string,
  now: number = Date.now(),
  env: NodeJS.ProcessEnv = process.env
): LoginFailureResult {
  if (!isRateLimitingEnabled(env)) {
    return { justLocked: false, retryAfter: 0 }
  }

  const cfg = getLoginLimitsConfig(env)
  const pairKey = `${normalizedEmail}|${clientIp}`
  const emailKey = normalizedEmail

  // 1. Increment IP failed attempts
  let ipEntry = loginIpFailStore.get(clientIp, now)
  if (!ipEntry || ipEntry.windowResetTime <= now) {
    loginIpFailStore.set(
      clientIp,
      { count: 1, windowResetTime: now + cfg.ipFailWindowMs, lockedUntil: null, lastSeen: now },
      now
    )
  } else {
    ipEntry.count += 1
    loginIpFailStore.set(clientIp, ipEntry, now)
  }

  // 2. Increment pair counter
  let justLockedPair = false
  let pairRetry = 0
  let pairEntry = loginPairLockoutStore.get(pairKey, now)
  if (!pairEntry || (pairEntry.windowResetTime <= now && (!pairEntry.lockedUntil || pairEntry.lockedUntil <= now))) {
    pairEntry = {
      count: 1,
      windowResetTime: now + cfg.pairWindowMs,
      lockedUntil: null,
      lastSeen: now,
    }
  } else {
    pairEntry.count += 1
  }

  if (pairEntry.count >= cfg.pairFailMax && (!pairEntry.lockedUntil || pairEntry.lockedUntil <= now)) {
    pairEntry.lockedUntil = now + cfg.pairDurationMs
    justLockedPair = true
    pairRetry = Math.ceil(cfg.pairDurationMs / 1000)
  }
  loginPairLockoutStore.set(pairKey, pairEntry, now)

  // 3. Increment aggregate email counter
  let justLockedEmail = false
  let emailRetry = 0
  let emailEntry = loginEmailLockoutStore.get(emailKey, now)
  if (!emailEntry || (emailEntry.windowResetTime <= now && (!emailEntry.lockedUntil || emailEntry.lockedUntil <= now))) {
    emailEntry = {
      count: 1,
      windowResetTime: now + cfg.emailWindowMs,
      lockedUntil: null,
      lastSeen: now,
    }
  } else {
    emailEntry.count += 1
  }

  if (emailEntry.count >= cfg.emailFailMax && (!emailEntry.lockedUntil || emailEntry.lockedUntil <= now)) {
    emailEntry.lockedUntil = now + cfg.emailDurationMs
    justLockedEmail = true
    emailRetry = Math.ceil(cfg.emailDurationMs / 1000)
  }
  loginEmailLockoutStore.set(emailKey, emailEntry, now)

  if (justLockedPair || justLockedEmail) {
    const tier = justLockedEmail ? "aggregate" : "pair"
    const retryAfter = Math.max(pairRetry, emailRetry)
    console.warn(
      `[security-audit] Login lockout triggered: tier=${tier} email=${maskEmail(normalizedEmail)} ip=${clientIp} duration=${retryAfter}s`
    )
    return { justLocked: true, tierLocked: tier, retryAfter }
  }

  return { justLocked: false, retryAfter: 0 }
}

/**
 * Clear pair counter and aggregate email counter upon authenticated login success.
 * Crucial security rule: does NOT delete the IP failed-attempts counter.
 * Reason: An attacker who possesses a legitimate account could otherwise alternate
 * between failed attempts on a victim account and successful logins with their own credentials
 * to repeatedly reset their IP's failure count, evading IP-level brute-force throttling.
 */
export function clearLoginCounters(normalizedEmail: string, clientIp: string): void {
  loginPairLockoutStore.delete(`${normalizedEmail}|${clientIp}`)
  loginEmailLockoutStore.delete(normalizedEmail)
  // Intentionally do NOT delete loginIpFailStore.delete(clientIp)
}

// ----------------------------------------------------------------------------
// Express Middleware Factories
// ----------------------------------------------------------------------------

export const GENERIC_RATE_LIMIT_ERROR = "Too many requests. Please try again later."

/**
 * Pure helper to generate admin rate-limit store key by institution (Fix 2)
 */
export function getAdminTenantKey(institutionId: string): string {
  return `admin:inst:${institutionId}`
}

export interface RateLimitMiddlewareOptions {
  store: BoundedStore
  max: number | ((env: NodeJS.ProcessEnv) => number)
  windowMs: number | ((env: NodeJS.ProcessEnv) => number)
  keyGenerator?: (req: Request) => string
  actionName?: string
}

export function createRateLimiter(options: RateLimitMiddlewareOptions) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const env = process.env
    if (!isRateLimitingEnabled(env)) {
      next()
      return
    }

    const key = options.keyGenerator ? options.keyGenerator(req) : (req.ip || req.socket.remoteAddress || "127.0.0.1")
    const max = typeof options.max === "function" ? options.max(env) : options.max
    const windowMs = typeof options.windowMs === "function" ? options.windowMs(env) : options.windowMs

    const result = checkAndIncrementRateLimit(options.store, key, max, windowMs, Date.now(), env)
    if (!result.allowed) {
      console.warn(
        `[security-audit] Rate limit hit: action=${options.actionName ?? req.path} key=${key} retryAfter=${result.retryAfter}s`
      )
      res.setHeader("Retry-After", String(result.retryAfter))
      res.status(429).json({ error: GENERIC_RATE_LIMIT_ERROR })
      return
    }

    next()
  }
}

// 1. Total requests cap on /auth/login (200 / 15m)
export const loginIpTotalLimiter = createRateLimiter({
  store: loginIpTotalStore,
  actionName: "login-ip-total",
  max: (env) => parseEnvInt(env.RATE_LIMIT_LOGIN_IP_TOTAL_MAX, 200),
  windowMs: (env) => parseEnvInt(env.RATE_LIMIT_LOGIN_IP_TOTAL_WINDOW_MS, 15 * 60 * 1000),
})

// 2. Staff signup limiter (10 / 1h)
export const signupLimiter = createRateLimiter({
  store: signupIpStore,
  actionName: "staff-signup",
  max: (env) => parseEnvInt(env.RATE_LIMIT_SIGNUP_MAX, 10),
  windowMs: (env) => parseEnvInt(env.RATE_LIMIT_SIGNUP_WINDOW_MS, 60 * 60 * 1000),
})

// 3. Domain verification limiter (20 / 1h)
export const verifyDomainLimiter = createRateLimiter({
  store: verifyDomainIpStore,
  actionName: "domain-verify",
  max: (env) => parseEnvInt(env.RATE_LIMIT_VERIFY_DOMAIN_MAX, 20),
  windowMs: (env) => parseEnvInt(env.RATE_LIMIT_VERIFY_DOMAIN_WINDOW_MS, 60 * 60 * 1000),
})

// 4. Register institution limiter (3 / 1h)
export const registerInstitutionLimiter = createRateLimiter({
  store: registerInstitutionIpStore,
  actionName: "register-institution",
  max: (env) => parseEnvInt(env.RATE_LIMIT_REGISTER_INSTITUTION_MAX, 3),
  windowMs: (env) => parseEnvInt(env.RATE_LIMIT_REGISTER_INSTITUTION_WINDOW_MS, 60 * 60 * 1000),
})

// 5. Admin tenant endpoints limiter (mutating actions: default 30 / 15m per institution)
export const adminTenantLimiter = createRateLimiter({
  store: adminTenantIpStore,
  actionName: "admin-tenant",
  max: (env) => parseEnvInt(env.RATE_LIMIT_ADMIN_TENANT_MAX, 30),
  windowMs: (env) => parseEnvInt(env.RATE_LIMIT_ADMIN_TENANT_WINDOW_MS, 15 * 60 * 1000),
  keyGenerator: (req) => {
    const institutionId = (req as any).user?.institutionId || req.ip || req.socket.remoteAddress || "unknown"
    return getAdminTenantKey(institutionId)
  },
})
