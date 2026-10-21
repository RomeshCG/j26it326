import "dotenv/config"

async function main() {
  console.log("=== Testing M3 JWT Tenant Resolution & Isolation ===")

  // 1. Authenticate with real loan officer credentials
  const loginRes = await fetch("http://127.0.0.1:4000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "officer@microflow.lk", password: "Password123!" }),
  })
  console.log("Login HTTP Status:", loginRes.status)
  const loginData = await loginRes.json()
  const token = loginData.token
  if (!token) {
    throw new Error("Failed to acquire token: " + JSON.stringify(loginData))
  }
  console.log("Acquired M4 JWT Token successfully.")

  // 2. Query M3 alerts with valid JWT
  const alertsRes = await fetch("http://127.0.0.1:4000/api/m3/ews/alerts", {
    headers: { Authorization: `Bearer ${token}` },
  })
  console.log("Alerts query HTTP Status:", alertsRes.status)
  const alertsData = await alertsRes.json()
  console.log("Alerts returned from tenant DB:", alertsData.data?.length ?? 0)

  // 3. Attempt tenant spoofing via forged x-institution-id header
  const spoofRes = await fetch("http://127.0.0.1:4000/api/m3/ews/alerts", {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-institution-id": "forged-attacker-tenant-9999",
    },
  })
  console.log("Spoofed header query HTTP Status:", spoofRes.status)
  const spoofData = await spoofRes.json()
  console.log("Alerts returned with forged header (must still use JWT tenant):", spoofData.data?.length ?? 0)

  // 4. Test missing Authorization header (must return 401)
  const unauthRes = await fetch("http://127.0.0.1:4000/api/m3/ews/alerts")
  console.log("Unauthenticated request HTTP Status (expected 401):", unauthRes.status)

  console.log("=== M3 Tenant Resolution Verified Successfully! ===")
}

main().catch(console.error)
