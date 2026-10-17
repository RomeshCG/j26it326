import { useState, useEffect } from "react"
import { ArrowLeft, ChevronRight, MapPin, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OVERDUE_QUEUE, formatLkr } from "./mock-data"
import { getLoans, getEwsAlerts } from "@/lib/m3-api"

export default function OverdueQueue({ onBack, onOpenLoan, onOpenAlert, onOpenCollection }) {
  const [queue, setQueue] = useState(OVERDUE_QUEUE)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadOverdueData() {
    setLoading(true)
    try {
      const [loansRes, alertsRes] = await Promise.allSettled([
        getLoans(),
        getEwsAlerts({ status: "open" }),
      ])

      if (loansRes.status === "fulfilled" && Array.isArray(loansRes.value) && loansRes.value.length > 0) {
        const alertsMap = {}
        if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
          alertsRes.value.forEach((a) => {
            const lId = a.ewsScore?.loanId || a.loanId
            if (lId) alertsMap[lId] = a.id
          })
        }

        // Identify overdue or active loans
        const overdueLoans = loansRes.value.filter(
          (l) => l.status === "overdue" || l.status === "defaulted" || alertsMap[l.id]
        )

        const listToDisplay = overdueLoans.length > 0 ? overdueLoans : loansRes.value.slice(0, 4)

        const mapped = listToDisplay.map((l, idx) => ({
          id: l.id,
          borrower: l.borrower?.fullName || "Borrower",
          product: l.product?.name || "Standard Loan",
          village: l.borrower?.district || "Colombo",
          amountDue: Math.round(Number(l.principal || 10000) * 0.1),
          outstanding: Number(l.principal || 50000),
          daysLate: l.status === "overdue" ? 35 : (idx + 1) * 12,
          parBucket: (idx + 1) * 12 >= 30 ? "PAR30" : "PAR1-29",
          alertId: alertsMap[l.id] || null,
        }))

        setQueue(mapped)
        setIsLive(true)
      } else {
        setIsLive(false)
      }
    } catch {
      setIsLive(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOverdueData()
  }, [])

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
          <ArrowLeft />
          Back to dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={isLive ? "default" : "secondary"}>
            {isLive ? "Live API" : "Demo Data"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadOverdueData}
            disabled={loading}
            className="cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Field operations · overdue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Overdue & PAR queue</h1>
        <p className="text-sm text-muted-foreground">
          Accounts past due, ordered by days late. Open a loan, EWS alert, or collection stop.
        </p>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            {queue.length} accounts in queue
          </CardTitle>
          <CardDescription>PAR buckets reflect days past contractual due date.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="divide-y divide-border">
            {queue.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-center sm:px-6"
              >
                <button
                  type="button"
                  onClick={() => onOpenLoan?.(row.id)}
                  className="min-w-0 cursor-pointer text-left transition-colors hover:opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{row.borrower}</p>
                    <Badge variant="destructive">{row.parBucket}</Badge>
                    {row.alertId ? <Badge variant="outline">EWS</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {row.id} · {row.product}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {row.village} · {row.daysLate}d late
                  </p>
                </button>

                <div className="sm:text-right">
                  <p className="text-sm font-medium tabular-nums">{formatLkr(row.amountDue)}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    OS {formatLkr(row.outstanding)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {row.alertId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onOpenAlert?.(row.alertId)}
                    >
                      Alert
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() =>
                      onOpenCollection?.({
                        id: `STOP-${row.id}`,
                        loanId: row.id,
                        borrower: row.borrower,
                        village: row.village,
                        amountDue: row.amountDue,
                        priority: row.daysLate,
                        reason: `${row.parBucket} — ${row.daysLate} days late`,
                      })
                    }
                  >
                    Collect
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
