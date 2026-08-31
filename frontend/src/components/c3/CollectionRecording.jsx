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
import { Textarea } from "@/components/ui/textarea"
import { formatLkr } from "./mock-data"

const OUTCOMES = [
  { id: "received", label: "Payment Received", icon: Check },
  { id: "partial", label: "Partial Payment", icon: Wallet },
  { id: "not-home", label: "Not Home", icon: Home },
  { id: "conflict", label: "Conflict Reported", icon: AlertTriangle },
]

export default function CollectionRecording({ stop, onBack, onComplete }) {
  const [outcome, setOutcome] = useState(null)
  const [amount, setAmount] = useState(stop?.amountDue ? String(stop.amountDue) : "")
  const [notes, setNotes] = useState("")
  const [receipt, setReceipt] = useState(null)
  const [generating, setGenerating] = useState(false)

  const borrower = stop?.borrower ?? "Kumari Fernando"
  const due = stop?.amountDue ?? 3500
  const village = stop?.village ?? "Kirindivita"
  const loanId = stop?.loanId ?? "LN-88421"
  const reason = stop?.reason ?? "Due today"

  const needsNotes = outcome === "not-home" || outcome === "conflict"
  const canGenerate =
    Boolean(outcome) &&
    !(outcome === "partial" && !amount) &&
    !(needsNotes && !notes.trim())

  function handleGenerate() {
    if (!canGenerate) return
    setGenerating(true)
    window.setTimeout(() => {
      setGenerating(false)
      setReceipt({
        id: `RCP-${Date.now().toString().slice(-6)}`,
        outcome,
        amount:
          outcome === "received"
            ? due
            : outcome === "partial"
              ? Number(amount)
              : 0,
        notes: notes.trim(),
      })
    }, 650)
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-3 py-4 sm:px-4 sm:py-6">
      <div className="flex min-h-[min(100dvh-5rem,720px)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center border-b border-border px-3 py-2.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            aria-label="Back"
            className="justify-self-start"
          >
            <ArrowLeft />
          </Button>
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Field collection
          </p>
          <span aria-hidden="true" />
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {borrower}
            </h1>
            <p className="text-sm text-muted-foreground">
              {loanId} · {village}
            </p>
            <p className="text-sm font-medium tabular-nums">
              Due today {formatLkr(due)}
            </p>
            <p className="text-sm text-muted-foreground">{reason}</p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
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
                    if (item.id !== "partial" && item.id !== "received") {
                      setAmount("")
                    }
                  }}
                  className={`flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center text-sm font-medium transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="size-6 shrink-0" />
                  <span className="leading-tight">{item.label}</span>
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

          {needsNotes ? (
            <div className="space-y-2">
              <Label htmlFor="visit-notes">
                Visit notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="visit-notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setReceipt(null)
                }}
                placeholder={
                  outcome === "conflict"
                    ? "Describe the conflict, people involved, and follow-up…"
                    : "Who you spoke to, when to retry, any message left…"
                }
              />
            </div>
          ) : null}

          {outcome === "received" || outcome === "partial" ? (
            <div className="space-y-2">
              <Label htmlFor="optional-notes">Notes (optional)</Label>
              <Textarea
                id="optional-notes"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value)
                  setReceipt(null)
                }}
                placeholder="Cash denomination, promise date, or borrower comment…"
              />
            </div>
          ) : null}

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
              {receipt.notes ? (
                <p className="mt-2 text-sm text-muted-foreground">{receipt.notes}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="border-t border-border p-4">
          {receipt ? (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full cursor-pointer text-sm font-medium"
              onClick={() => onComplete?.()}
            >
              <Home />
              Back to dashboard
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="h-12 w-full cursor-pointer text-sm font-medium"
              disabled={!canGenerate || generating}
              onClick={handleGenerate}
            >
              {generating ? <Loader2 className="animate-spin" /> : <Receipt />}
              Generate Receipt
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
