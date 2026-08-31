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
    fullName: "Malini Silva",
    nic: "199012345V",
    product: "Group Enterprise",
    amount: 85000,
    tenure: "12",
    district: "Gampaha",
    riskScore: 72,
    riskLabel: "Moderate risk",
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
    <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to application
      </Button>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Origination · disbursement
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Confirm disbursement
          </CardTitle>
          <CardDescription>
            Close the application into an active loan after risk review.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5 pt-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Borrower
              </p>
              <p className="mt-1 text-sm font-medium">{app.fullName}</p>
              <p className="text-sm text-muted-foreground">{app.nic}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Product
              </p>
              <p className="mt-1 text-sm font-medium">{app.product}</p>
              <p className="text-sm text-muted-foreground">{app.district}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Amount
              </p>
              <p className="mt-1 text-sm font-medium tabular-nums">
                {formatLkr(app.amount)}
              </p>
              <p className="text-sm text-muted-foreground">{app.tenure} months</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                C1 risk score
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
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <div className="flex items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Check className="size-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Loan activated</p>
                  <p className="text-sm text-muted-foreground">
                    {loanId} · Disbursed {disbursedOn} via {method}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-3">
          {done ? (
            <Button
              type="button"
              size="lg"
              className="cursor-pointer"
              onClick={() => onComplete?.(loanId)}
            >
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
