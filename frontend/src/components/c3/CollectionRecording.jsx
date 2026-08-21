import { useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Home,
  Loader2,
  Receipt,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatLkr } from "./mock-data"

const OUTCOMES = [
  { id: "received", label: "Payment Received", icon: Check },
  { id: "partial", label: "Partial Payment", icon: Wallet },
  { id: "not-home", label: "Not Home", icon: Home },
  { id: "conflict", label: "Conflict Reported", icon: AlertTriangle },
]

export default function CollectionRecording({ stop, onBack }) {
  const [outcome, setOutcome] = useState(null)
  const [amount, setAmount] = useState(stop?.amountDue ? String(stop.amountDue) : "")
  const [receipt, setReceipt] = useState(null)
  const [generating, setGenerating] = useState(false)

  const borrower = stop?.borrower ?? "Kumari Fernando"
  const due = stop?.amountDue ?? 3500
  const village = stop?.village ?? "Kirindivita"
  const loanId = stop?.loanId ?? "LN-88421"

  function handleGenerate() {
    if (!outcome) return
    if (outcome === "partial" && !amount) return
    setGenerating(true)
    window.setTimeout(() => {
      setGenerating(false)
      setReceipt({
        id: `RCP-${Date.now().toString().slice(-6)}`,
        outcome,
        amount: outcome === "received" ? due : outcome === "partial" ? Number(amount) : 0,
      })
    }, 650)
  }

  return (
    <div className="flex justify-center bg-muted/40 px-4 py-6">
      <div className="flex min-h-[720px] w-full max-w-[390px] flex-col overflow-hidden rounded-[1.75rem] border border-border bg-background shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Button type="button" variant="ghost" size="icon" onClick={onBack} aria-label="Back">
            <ArrowLeft />
          </Button>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Field collection
          </p>
          <span className="size-8" />
        </div>

        <div className="flex flex-1 flex-col gap-5 p-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{borrower}</h1>
            <p className="text-sm text-muted-foreground">
              {loanId} · {village}
            </p>
            <p className="text-sm font-medium tabular-nums">Due today {formatLkr(due)}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {OUTCOMES.map((item) => {
              const Icon = item.icon
              const active = outcome === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setOutcome(item.id)
                    setReceipt(null)
                    if (item.id === "received") setAmount(String(due))
                  }}
                  className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border px-3 py-4 text-center text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-6" />
                  {item.label}
                </button>
              )
            })}
          </div>

          {outcome === "partial" ? (
            <div className="space-y-2">
              <Label htmlFor="partial-amount">Amount received (LKR)</Label>
              <Input
                id="partial-amount"
                type="number"
                inputMode="numeric"
                className="h-11 text-base"
                value={amount}
                onChange={(event) => {
                  setAmount(event.target.value)
                  setReceipt(null)
                }}
                placeholder="0"
              />
            </div>
          ) : null}

          <div className="mt-auto space-y-3">
            {receipt ? (
              <div className="rounded-xl border border-border bg-muted/60 p-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Receipt
                </p>
                <p className="mt-1 text-sm font-medium">{receipt.id}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {OUTCOMES.find((item) => item.id === receipt.outcome)?.label}
                  {receipt.amount > 0 ? ` · ${formatLkr(receipt.amount)}` : ""}
                </p>
              </div>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="h-12 w-full cursor-pointer text-sm font-medium"
              disabled={!outcome || generating || (outcome === "partial" && !amount)}
              onClick={handleGenerate}
            >
              {generating ? <Loader2 className="animate-spin" /> : <Receipt />}
              Generate Receipt
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
