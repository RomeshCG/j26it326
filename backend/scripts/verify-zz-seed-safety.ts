/**
 * Offline safety checks for ZZ test-user seed helpers (no DB, no seed execution).
 * Run: npm run verify:zz-seed-safety
 */
import {
  ZZ_ADMIN_EMAIL,
  ZZ_INSTITUTION_ID,
  ZZ_SEED_ROLES,
  assertZzSeedEnvironmentAllowed,
  generateZzTestPassword,
  zzDisplayName,
  zzEmailForRole,
} from "./seed-zz-test-users.js"

let passed = 0
let failed = 0

function assert(cond: boolean, name: string, detail?: string) {
  if (cond) {
    passed++
    console.log(`  PASS  ${name}`)
  } else {
    failed++
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`)
  }
}

console.log("\n=== ZZ seed role / email guards ===")
assert(ZZ_INSTITUTION_ID === "33b6545d-7c78-4354-a017-d0717efba3b8", "ZZ institution id")
assert(!ZZ_SEED_ROLES.includes("admin" as never), "admin not in seed roles")
assert(ZZ_SEED_ROLES.length === 5, "exactly five seed roles")
assert(
  ZZ_SEED_ROLES.every((r) => r !== "admin"),
  "no admin role name in list"
)

for (const role of ZZ_SEED_ROLES) {
  const email = zzEmailForRole(role)
  assert(email.endsWith("@zz-test-org1.lk"), `${role} email domain`)
  assert(email !== ZZ_ADMIN_EMAIL, `${role} email ≠ admin`)
  assert(!email.includes("admin"), `${role} email has no admin token`)
  assert(zzDisplayName(role).startsWith("ZZ Dev "), `${role} display name prefix`)
}

console.log("\n=== Environment gate ===")
try {
  assertZzSeedEnvironmentAllowed({
    NODE_ENV: "production",
    ALLOW_ZZ_TEST_USER_SEED: "1",
  })
  assert(false, "production must throw")
} catch (e) {
  assert(
    e instanceof Error && e.message.toLowerCase().includes("production"),
    "rejects production"
  )
}

try {
  assertZzSeedEnvironmentAllowed({
    NODE_ENV: "development",
    ALLOW_ZZ_TEST_USER_SEED: undefined,
  })
  assert(false, "missing allow flag must throw")
} catch (e) {
  assert(
    e instanceof Error && e.message.includes("ALLOW_ZZ_TEST_USER_SEED"),
    "rejects missing ALLOW_ZZ_TEST_USER_SEED"
  )
}

try {
  assertZzSeedEnvironmentAllowed({
    NODE_ENV: "development",
    ALLOW_ZZ_TEST_USER_SEED: "0",
  })
  assert(false, "ALLOW=0 must throw")
} catch (e) {
  assert(e instanceof Error, "rejects ALLOW=0")
}

assertZzSeedEnvironmentAllowed({
  NODE_ENV: "development",
  ALLOW_ZZ_TEST_USER_SEED: "1",
})
assert(true, "allows development + ALLOW=1")

assertZzSeedEnvironmentAllowed({
  NODE_ENV: "test",
  ALLOW_ZZ_TEST_USER_SEED: "1",
})
assert(true, "allows test + ALLOW=1")

console.log("\n=== Password generation ===")
const a = generateZzTestPassword()
const b = generateZzTestPassword()
assert(a !== b, "passwords independent")
assert(a.length >= 20, "password length adequate")
assert(a.startsWith("Zz#"), "password prefix")
assert(!a.includes(" "), "no spaces")

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
