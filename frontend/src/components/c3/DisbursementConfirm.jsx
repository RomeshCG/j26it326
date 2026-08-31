import { useState } from "react"
import { ArrowLeft, Banknote, Check, Loader2 } from "lucide-react"

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
import { formatLkr } from "./mock-data"

const METHODS = ["Cash at branch", "Bank transfer", "Mobile wallet"]

export default function DisbursementConfirm({ application, onBack, onComplete }) {
  const [method, setMethod] = useState(METHODS[0])
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const app = application ?? {
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

  const loanId = `LN-${Date.now().toString().slice(-5)}`
  const disbursedOn = new Date().toISOString().slice(0, 10)

  function handleConfirm() {
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setDone(true)
    }, 800)
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
          Close an approved application into an active loan after risk review
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

          {!done ? (
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
          ) : (
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
          )}
        </CardContent>

        <CardFooter className="justify-end gap-3 border-t border-border/50">
          {done ? (
            <Button type="button" size="lg" className="cursor-pointer" onClick={() => onComplete?.(loanId)}>
              Go to dashboard
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
