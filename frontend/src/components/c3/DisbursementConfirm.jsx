import { useState } from "react"
import { ArrowLeft, Banknote, Check, Loader2, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { disburseLoan } from "@/lib/m3-api"

import { ensureApprovedLoan } from "./ensure-approved-loan"
import { formatLkr } from "./mock-data"

const METHODS = ["Cash at branch", "Bank transfer", "Mobile wallet"]

export default function DisbursementConfirm({ application, onBack, onComplete }) {
  const [method, setMethod] = useState(METHODS[0])
  const [submitting, setSubmitting] = useState(false)
  const [approving, setApproving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)
  const [statusNote, setStatusNote] = useState(null)
  const [disbursedResult, setDisbursedResult] = useState(null)
  const [app, setApp] = useState(
    () =>
      application ?? {
        fullName: "Malini Rathnayake",
        nic: "912345678V",
        product: "Individual Working Capital",
        amount: 75000,
        tenure: "10",
        district: "Colombo Head Office",
        riskScore: 88,
        riskLabel: "Low risk",
        applicationId: "APP-DEMO-010",
      }
  )

  const approved = Boolean(app.loanId)
  const loanId =
    disbursedResult?.loan?.id ||
    disbursedResult?.loanId ||
    app.loanId ||
    app.applicationId ||
    "LN-DEMO"
  const disbursedOn = new Date().toISOString().slice(0, 10)

  async function handleApprove() {
    setApproving(true)
    setError(null)
    setStatusNote(null)
    try {
      const result = await ensureApprovedLoan(app)
      setApp((current) => ({
        ...current,
        loanId: result.loanId,
        applicationId: result.applicationId,
        borrowerId: result.borrowerId,
      }))
      setStatusNote(
        "Approved in M3 — borrower, application, and loan (pending disbursement) are in the database. Confirm disbursement next."
      )
    } catch (err) {
      console.error("Approve failed:", err)
      const msg =
        typeof err?.message === "string"
          ? err.message
          : typeof err?.data?.error === "string"
            ? err.data.error
            : "Approve failed"
      setError(msg)
    } finally {
      setApproving(false)
    }
  }

  async function handleConfirm() {
    if (!app.loanId) {
      setError("Approve the application first so a live loan exists in M3.")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await disburseLoan(app.loanId, {
        amount: Number(app.amount),
        method: method.toLowerCase().replace(/ /g, "_"),
        referenceNumber: `TRX-${Date.now().toString().slice(-6)}`,
        notes: `Disbursed via ${method}`,
      })
      setDisbursedResult(res?.data || res || { loanId: app.loanId })
      setStatusNote(null)
      setDone(true)
    } catch (err) {
      console.error("Disbursement API failed:", err)
      setError(err?.message || "Disbursement failed. The loan could not be activated.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Button type="button" variant="ghost" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 3 · Loan activation
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Confirm disbursement</h1>
        <p className="text-sm text-muted-foreground">
          Approve into M3 (creates the borrower + loan), then confirm disbursement
        </p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Origination
          </CardDescription>
          <CardTitle className="text-base font-semibold">Disbursement summary</CardTitle>
          {app.applicationId ? (
            <CardDescription>{app.applicationId}</CardDescription>
          ) : null}
        </CardHeader>

        <CardContent className="space-y-5 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Borrower
              </p>
              <p className="mt-1 text-sm font-medium">{app.fullName}</p>
              <p className="text-sm text-muted-foreground">{app.nic}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Product & branch
              </p>
              <p className="mt-1 text-sm font-medium">{app.product}</p>
              <p className="text-sm text-muted-foreground">{app.district}</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Facility
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums">{formatLkr(app.amount)}</p>
              <p className="text-sm text-muted-foreground">{app.tenure} months</p>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Risk assessment
              </p>
              <div className="mt-1 flex items-center gap-2">
                <p className="text-sm font-medium tabular-nums">{app.riskScore}</p>
                <Badge variant="outline">{app.riskLabel}</Badge>
              </div>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : null}

          {statusNote ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              {statusNote}
              {app.loanId ? (
                <span className="mt-1 block text-xs opacity-80">Loan ID: {app.loanId}</span>
              ) : null}
            </div>
          ) : null}

          {!done && !approved ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-sm text-muted-foreground">
              Step 1 — <span className="font-medium text-foreground">Approve application</span>{" "}
              writes this borrower into M3 (borrower list + loan pending disbursement). Then
              confirm cash / transfer.
            </div>
          ) : null}

          {!done && approved ? (
            <div className="space-y-2">
              <Label>Disbursement method</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {METHODS.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="lg"
                    variant={method === item ? "default" : "outline"}
                    className="h-11 cursor-pointer"
                    onClick={() => setMethod(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          {done ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  <Check className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Loan activated</p>
                  <p className="text-sm text-muted-foreground">
                    {loanId} · Disbursed {disbursedOn} via {method}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end gap-3 border-t border-border/50">
          {done ? (
            <Button type="button" size="lg" className="cursor-pointer" onClick={() => onComplete?.(loanId)}>
              Go to dashboard
            </Button>
          ) : !approved ? (
            <Button
              type="button"
              size="lg"
              className="cursor-pointer"
              disabled={approving}
              onClick={handleApprove}
            >
              {approving ? <Loader2 className="animate-spin" /> : <ShieldCheck />}
              Approve application
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="cursor-pointer"
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? <Loader2 className="animate-spin" /> : <Banknote />}
              Confirm disbursement
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
