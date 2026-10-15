/**
 * Security Hardening A: Rate Limiting & Account Lockout Verification Script
 *
 * COMPLETELY DATABASE-FREE:
 * - No centralPrisma or tenantPrisma imports
 * - No database connection or port guard required
 * - Runs in < 1 second purely in-process
 */

import {
  BoundedStore,
  checkAndIncrementRateLimit,
  checkLoginIpFailLimit,
  checkLoginLockout,
  handleLoginFailure,
  clearLoginCounters,
  resetRateLimits,
  isRateLimitingEnabled,
  maskEmail,
  loginPairLockoutStore,
  loginEmailLockoutStore,
  loginIpFailStore,
  loginIpTotalStore,
  signupIpStore,
  verifyDomainIpStore,
  registerInstitutionIpStore,
  adminTenantIpStore,
  GENERIC_RATE_LIMIT_ERROR,
  configureTrustProxy,
  getAdminTenantKey,
} from "../src/middleware/rate-limit.js"

let passCount = 0
let failCount = 0

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passCount++
    console.log(`[PASS] Test ${passCount + failCount}: ${testName}`)
  } else {
    failCount++
    console.error(`[FAIL] Test ${passCount + failCount}: ${testName} ${detail ? `- ${detail}` : ""}`)
  }
}

async function runTests() {
  console.log("==================================================================")
  console.log("Security Hardening A: Pure In-Memory Verification (Database-Free)")
  console.log("==================================================================\n")

  // --------------------------------------------------------------------------
  // Test 1: resetRateLimits() clears all stores
  // --------------------------------------------------------------------------
  loginIpTotalStore.set("k1", { count: 1, windowResetTime: 9999999999999, lockedUntil: null, lastSeen: 1 })
  signupIpStore.set("k2", { count: 1, windowResetTime: 9999999999999, lockedUntil: null, lastSeen: 1 })
  resetRateLimits()
  assert(
    loginIpTotalStore.size === 0 &&
      signupIpStore.size === 0 &&
      loginPairLockoutStore.size === 0 &&
      loginEmailLockoutStore.size === 0 &&
      verifyDomainIpStore.size === 0 &&
      registerInstitutionIpStore.size === 0 &&
      adminTenantIpStore.size === 0,
    "resetRateLimits() clears all internal stores"
  )

  // --------------------------------------------------------------------------
  // Test 2: Standard IP rate limit and Retry-After
  // --------------------------------------------------------------------------
  resetRateLimits()
  const now = 1000000000
  const store = new BoundedStore("test-ip", 100)
  const max = 3
  const windowMs = 10000 // 10s

  const r1 = checkAndIncrementRateLimit(store, "1.2.3.4", max, windowMs, now)
  const r2 = checkAndIncrementRateLimit(store, "1.2.3.4", max, windowMs, now + 1000)
  const r3 = checkAndIncrementRateLimit(store, "1.2.3.4", max, windowMs, now + 2000)
  const r4 = checkAndIncrementRateLimit(store, "1.2.3.4", max, windowMs, now + 3000)

  assert(
    r1.allowed && r2.allowed && r3.allowed && !r4.allowed,
    "Rate limiter allows requests up to max and blocks subsequent requests"
  )
  assert(
    r4.retryAfter === 7 && GENERIC_RATE_LIMIT_ERROR === "Too many requests. Please try again later.",
    "Blocked request returns accurate Retry-After backoff and generic error message"
  )

  // --------------------------------------------------------------------------
  // Test 3: Pair lockout (email|ip) and recovery after expiry
  // --------------------------------------------------------------------------
  resetRateLimits()
  const baseTime = 2000000000
  const targetEmail = "alice@apex.lk"
  const clientIpA = "192.168.1.100"
  const clientIpB = "192.168.1.200"

  // Simulate 4 failures (1 under threshold of 5)
  for (let i = 0; i < 4; i++) {
    handleLoginFailure(targetEmail, clientIpA, baseTime + i * 1000)
  }
  const checkPreLock = checkLoginLockout(targetEmail, clientIpA, baseTime + 4000)
  assert(!checkPreLock.locked, "4 failed attempts do not trigger lockout (threshold: 5)")

  // 5th failure triggers lockout
  const fail5 = handleLoginFailure(targetEmail, clientIpA, baseTime + 5000)
  assert(fail5.justLocked && fail5.tierLocked === "pair", "5th failed attempt triggers pair lockout")

  const checkLocked = checkLoginLockout(targetEmail, clientIpA, baseTime + 6000)
  assert(
    checkLocked.locked && checkLocked.retryAfter > 0 && checkLocked.tier === "pair",
    "Pair (email|ip) is locked with valid retryAfter"
  )

  // Critical security check: Attacker on IpB cannot lock victim on IpA
  const checkDifferentIp = checkLoginLockout(targetEmail, clientIpB, baseTime + 6000)
  assert(
    !checkDifferentIp.locked,
    "Pair lockout is IP-scoped: victim account is not locked from another IP"
  )

  // Recovery after 15 minutes (900,000 ms)
  const afterExpiry = baseTime + 5000 + 900000 + 1000
  const checkRecovered = checkLoginLockout(targetEmail, clientIpA, afterExpiry)
  assert(!checkRecovered.locked, "Pair lockout automatically recovers after lockout duration expires")

  // --------------------------------------------------------------------------
  // Test 4: Aggregate per-email lockout across multiple IPs (threshold: 100)
  // --------------------------------------------------------------------------
  resetRateLimits()
  const aggEmail = "victim@apex.lk"
  const aggBaseTime = 3000000000

  // 99 failures across 99 unique IPs (pair limit is never exceeded)
  for (let i = 1; i <= 99; i++) {
    handleLoginFailure(aggEmail, `10.0.1.${i}`, aggBaseTime + i * 100)
  }
  const aggCheckPre = checkLoginLockout(aggEmail, "10.0.1.250", aggBaseTime + 10000)
  assert(!aggCheckPre.locked, "99 failures across distributed IPs do not trigger aggregate lock (threshold: 100)")

  // 100th failure on 100th IP triggers aggregate lockout
  const agg100 = handleLoginFailure(aggEmail, "10.0.1.100", aggBaseTime + 10100)
  assert(agg100.justLocked && agg100.tierLocked === "aggregate", "100th failure triggers aggregate email lockout")

  // Every IP is now locked for this email
  const aggCheckLocked = checkLoginLockout(aggEmail, "10.0.99.99", aggBaseTime + 10200)
  assert(
    aggCheckLocked.locked && aggCheckLocked.tier === "aggregate",
    "Aggregate lockout blocks attempts from ANY IP for targeted email"
  )

  // Aggregate lock recovery after 15 min
  const aggRecoverTime = aggBaseTime + 10100 + 900000 + 1000
  const aggRecovered = checkLoginLockout(aggEmail, "10.0.99.99", aggRecoverTime)
  assert(!aggRecovered.locked, "Aggregate lockout recovers after 15 minutes")

  // --------------------------------------------------------------------------
  // Test 5: Identical lockout behavior for unknown vs existing emails
  // --------------------------------------------------------------------------
  resetRateLimits()
  const unknownEmail = "nonexistent-user-xyz@example.com"
  for (let i = 0; i < 5; i++) {
    handleLoginFailure(unknownEmail, "127.0.0.1", baseTime + i * 1000)
  }
  const unknownLock = checkLoginLockout(unknownEmail, "127.0.0.1", baseTime + 5000)
  assert(
    unknownLock.locked && unknownLock.retryAfter > 0,
    "Lockout operates identically on non-existent emails (prevents account enumeration)"
  )

  // --------------------------------------------------------------------------
  // Test 6: Counters clear on authenticated success while preserving IP failures (Fix 1)
  // --------------------------------------------------------------------------
  resetRateLimits()
  const userBob = "bob@apex.lk"
  const userBobIp = "172.16.0.5"

  // 4 failures from userBobIp for userBob
  for (let i = 0; i < 4; i++) {
    handleLoginFailure(userBob, userBobIp, baseTime + i * 1000)
  }
  const ipFailEntryBefore = loginIpFailStore.get(userBobIp)
  assert(ipFailEntryBefore?.count === 4, "IP failed counter has 4 failures before login success")

  // Authenticated login succeeds -> clears pair and aggregate email counters,
  // but intentionally preserves IP failed-attempts counter
  clearLoginCounters(userBob, userBobIp)

  const ipFailEntryAfter = loginIpFailStore.get(userBobIp)
  assert(
    ipFailEntryAfter?.count === 4,
    "clearLoginCounters() preserves IP failed-attempts counter to prevent attacker resetting IP count with valid credentials"
  )

  // Pair counter for Bob was cleared, so 4 more failures can happen without locking pair
  for (let i = 0; i < 4; i++) {
    handleLoginFailure(userBob, userBobIp, baseTime + 10000 + i * 1000)
  }
  const checkBob = checkLoginLockout(userBob, userBobIp, baseTime + 15000)
  assert(!checkBob.locked, "clearLoginCounters() resets pair counter for the authenticated email")

  // --------------------------------------------------------------------------
  // Test 7: Bounded memory eviction (never exceeds cap, active locks evicted last)
  // --------------------------------------------------------------------------
  const cap = 3
  const bStore = new BoundedStore("test-bounded", cap)
  const t = 4000000000

  // 1. Insert expired entry (windowResetTime <= t, no lock)
  bStore.set("entry-expired", { count: 1, windowResetTime: t - 100, lockedUntil: null, lastSeen: t - 500 }, t)
  // 2. Insert unlocked active entry (windowResetTime > t)
  bStore.set("entry-unlocked", { count: 1, windowResetTime: t + 10000, lockedUntil: null, lastSeen: t - 200 }, t)
  // 3. Insert active lock entry (lockedUntil > t)
  bStore.set("entry-locked", { count: 5, windowResetTime: t + 10000, lockedUntil: t + 50000, lastSeen: t - 100 }, t)

  assert(bStore.size === 3, "Bounded store filled to capacity (3 entries)")

  // Insert 4th entry: Expired entry should be evicted first
  bStore.set("entry-new1", { count: 1, windowResetTime: t + 10000, lockedUntil: null, lastSeen: t }, t)
  assert(
    bStore.size === 3 && !bStore.get("entry-expired", t) && Boolean(bStore.get("entry-locked", t)),
    "Eviction sweeps expired entries first, retaining active lock and size <= cap"
  )

  // Insert 5th entry: Unlocked entry should be evicted second (LRU)
  bStore.set("entry-new2", { count: 1, windowResetTime: t + 10000, lockedUntil: null, lastSeen: t + 1 }, t + 1)
  assert(
    bStore.size === 3 && !bStore.get("entry-unlocked", t) && Boolean(bStore.get("entry-locked", t)),
    "Eviction sweeps unlocked entries before active locks"
  )

  // Fill store completely with active locks
  bStore.set("lock-A", { count: 5, windowResetTime: t + 10000, lockedUntil: t + 90000, lastSeen: t + 2 }, t + 2)
  bStore.set("lock-B", { count: 5, windowResetTime: t + 10000, lockedUntil: t + 90000, lastSeen: t + 3 }, t + 3)
  bStore.set("lock-C", { count: 5, windowResetTime: t + 10000, lockedUntil: t + 90000, lastSeen: t + 4 }, t + 4)
  assert(bStore.size === 3, "Store successfully filled with 3 active locks")

  // Insert 4th lock: active lock evicted only as last resort
  bStore.set("lock-D", { count: 5, windowResetTime: t + 10000, lockedUntil: t + 90000, lastSeen: t + 5 }, t + 5)
  assert(bStore.size === 3, "Store never exceeds maximum capacity cap even under lock pressure")

  // --------------------------------------------------------------------------
  // Test 8: Production ignores ENABLE_RATE_LIMITING=false (Amendment 5)
  // --------------------------------------------------------------------------
  const prodDisabled = isRateLimitingEnabled({ NODE_ENV: "production", ENABLE_RATE_LIMITING: "false" })
  assert(prodDisabled === true, "isRateLimitingEnabled ignores ENABLE_RATE_LIMITING=false in production")

  const devDisabled = isRateLimitingEnabled({ NODE_ENV: "development", ENABLE_RATE_LIMITING: "false" })
  assert(devDisabled === false, "isRateLimitingEnabled honors ENABLE_RATE_LIMITING=false in development")

  const defaultEnabled = isRateLimitingEnabled({})
  assert(defaultEnabled === true, "isRateLimitingEnabled defaults to true when unset")

  // --------------------------------------------------------------------------
  // Test 9: IP failed attempts limit on /auth/login (Amendment 3)
  // --------------------------------------------------------------------------
  resetRateLimits()
  const failIp = "192.168.50.10"
  for (let i = 0; i < 20; i++) {
    handleLoginFailure("any-user@apex.lk", failIp, baseTime + i * 100)
  }
  const ipFailBlocked = checkLoginIpFailLimit(failIp, baseTime + 2500)
  assert(!ipFailBlocked.allowed && ipFailBlocked.retryAfter > 0, "IP with 20 failed attempts is blocked")

  const otherIpAllowed = checkLoginIpFailLimit("192.168.50.11", baseTime + 2500)
  assert(otherIpAllowed.allowed, "Different IP is unaffected by failed attempts limit")

  // --------------------------------------------------------------------------
  // Test 10: TRUST_PROXY configuration validation & fail-closed (Amendment 6)
  // --------------------------------------------------------------------------
  const dummyApp: any = {
    settings: {},
    set(key: string, val: any) {
      this.settings[key] = val
    },
  }

  configureTrustProxy(dummyApp, "false")
  assert(dummyApp.settings["trust proxy"] === false, "TRUST_PROXY='false' sets trust proxy false")

  configureTrustProxy(dummyApp, "1")
  assert(dummyApp.settings["trust proxy"] === 1, "TRUST_PROXY='1' parses hop count integer 1")

  configureTrustProxy(dummyApp, "true")
  assert(dummyApp.settings["trust proxy"] === true, "TRUST_PROXY='true' sets trust proxy true")

  configureTrustProxy(dummyApp, "invalid_value_xyz")
  assert(dummyApp.settings["trust proxy"] === false, "Invalid TRUST_PROXY value fails closed to false")

  // --------------------------------------------------------------------------
  // Test 11: Email masking helper for structured security logs
  // --------------------------------------------------------------------------
  assert(maskEmail("admin@apex.lk") === "ad***@apex.lk", "Email masking preserves first 2 chars and domain")
  assert(maskEmail("a@apex.lk") === "a***@apex.lk", "Email masking handles single-char local part")

  // --------------------------------------------------------------------------
  // Test 12: Admin tenant key generation helper is pure (Fix 2)
  // --------------------------------------------------------------------------
  const instKey1 = getAdminTenantKey("tenant-uuid-1234")
  assert(instKey1 === "admin:inst:tenant-uuid-1234", "getAdminTenantKey formats expected admin:inst:<institutionId> key")
  const instKey2 = getAdminTenantKey("apex-mfi")
  assert(instKey2 === "admin:inst:apex-mfi", "getAdminTenantKey correctly handles arbitrary tenant identifier strings")

  // Summary
  console.log("\n==================================================================")
  console.log(`Results: ${passCount} passed, ${failCount} failed. Total tests: ${passCount + failCount}`)
  console.log("==================================================================")

  if (failCount > 0) {
    process.exitCode = 1
  }
}

runTests().catch((err) => {
  console.error("Unexpected error running tests:", err)
  process.exit(1)
})
