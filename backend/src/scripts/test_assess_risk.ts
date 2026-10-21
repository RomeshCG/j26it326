import "dotenv/config"

async function test() {
  const loginRes = await fetch("http://localhost:4000/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "officer@microflow.lk", password: "Password123!" }),
  })
  const { token } = await loginRes.json()

  const assessRes = await fetch("http://localhost:4000/api/m3/applications/assess-risk", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      requestedAmount: 85000,
      termMonths: 12,
      product: "Group Enterprise",
      monthlyIncome: 45000,
      existingLoans: "no",
      groupMember: "yes",
      district: "Colombo",
    }),
  })

  console.log("ASSESS_STATUS:", assessRes.status)
  const json = await assessRes.json()
  console.log("ASSESS_RESPONSE:", JSON.stringify(json, null, 2))
}

test()
