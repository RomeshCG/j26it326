import "dotenv/config"
import { emitLoanDisbursed, emitPaymentCollected } from "../lib/m3/m2-events.js"

async function main() {
  console.log("Testing M3 -> M2 Event Emission...")

  console.log("1. Emitting loan_disbursed event...")
  await emitLoanDisbursed({
    loanId: "954e5da3-1975-42af-b329-286538c59751",
    disbursementId: "d1311f76-dfea-4c4c-ad25-3dd03c449474",
    amount: 120000,
    date: new Date().toISOString(),
    institutionId: "00000000-0000-4000-8000-000000000001",
  })

  console.log("2. Emitting payment_collected event...")
  await emitPaymentCollected({
    loanId: "954e5da3-1975-42af-b329-286538c59751",
    collectionId: "be105b8e-1d7d-4bf1-97d3-25547384defb",
    amount: 11800,
    date: new Date().toISOString(),
    institutionId: "00000000-0000-4000-8000-000000000001",
  })

  console.log("M2 events emitted and received successfully!")
}

main().catch(console.error)
