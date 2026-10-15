/**
 * M3 → M2 event emitter
 *
 * M3 never writes directly into M2's tables.
 * Instead, M3 emits lifecycle events via HTTP to M2's internal webhook endpoint.
 *
 * Until M2's endpoint is live, events are logged to console (no-op).
 * Set M2_SERVICE_URL in .env to enable real emission.
 */

export type LoanDisbursedPayload = {
  loanId: string
  disbursementId: string
  amount: number
  date: string // ISO
  institutionId: string
}

export type PaymentCollectedPayload = {
  loanId: string
  collectionId: string
  amount: number
  date: string // ISO
  institutionId: string
}

async function postEvent(event: string, payload: Record<string, unknown>): Promise<void> {
  const m2Url = process.env.M2_SERVICE_URL

  if (!m2Url) {
    // Stub: M2 not connected yet — log and continue
    console.info(`[M3→M2][STUB] event=${event}`, JSON.stringify(payload))
    return
  }

  const response = await fetch(`${m2Url}/api/m2/events/loan-lifecycle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, payload }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`M2 event webhook returned ${response.status}: ${text}`)
  }
}

export async function emitLoanDisbursed(payload: LoanDisbursedPayload): Promise<void> {
  await postEvent("loan_disbursed", payload as unknown as Record<string, unknown>)
}

export async function emitPaymentCollected(payload: PaymentCollectedPayload): Promise<void> {
  await postEvent("payment_collected", payload as unknown as Record<string, unknown>)
}
