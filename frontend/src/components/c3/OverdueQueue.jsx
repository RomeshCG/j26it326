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
import { formatLkr } from "./mock-data"
import { getLoans, getEwsAlerts } from "@/lib/m3-api"

function daysBetween(from, to = new Date()) {
  const a = new Date(from)
  const b = new Date(to)
  if (Number.isNaN(a.getTime())) return 0
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (24 * 3600 * 1000)))
}

function parBucket(daysLate) {
  if (daysLate >= 90) return "PAR90+"
  if (daysLate >= 60) return "PAR60"
  if (daysLate >= 30) return "PAR30"
  return "PAR1-29"
}

function mapLiveLoan(loan, alertId) {
  const overdueRows = Array.isArray(loan.schedules) ? loan.schedules : []
  const amountDue = overdueRows.reduce(
    (sum, s) => sum + Math.max(0, Number(s.amountDue) - Number(s.amountPaid || 0)),
    0
  )
  const oldestDue = overdueRows[0]?.dueDate
  const daysLate =
    oldestDue != null
      ? daysBetween(oldestDue)
      : loan.status === "overdue"
        ? 21
        : 0
  const principal = Number(loan.principal || 0)

  return {
    id: loan.id,
    borrower: loan.borrower?.fullName || "Borrower",
    product: loan.product?.name || "Loan",
    village: loan.borrower?.district || "—",
    amountDue:
      amountDue > 0
        ? Math.round(amountDue)
        : Math.round(principal / Math.max(1, loan.termMonths || 12)),
    outstanding: Math.round(principal),
    principal: Math.round(principal),
    daysLate,
    parBucket: parBucket(daysLate),
    alertId: alertId || null,
    overdueInstallments: overdueRows.length,
  }
}

export default function OverdueQueue({ onBack, onOpenLoan, onOpenAlert, onOpenCollection }) {
  const [queue, setQueue] = useState([])
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function loadOverdueData() {
    setLoading(true)
    setError(null)
    try {
      const [loansRes, alertsRes] = await Promise.allSettled([
        getLoans(),
        getEwsAlerts({ status: "open" }),
      ])

      if (loansRes.status !== "fulfilled" || !Array.isArray(loansRes.value)) {
        throw new Error(
          loansRes.status === "rejected"
            ? loansRes.reason?.message || "Failed to load loans"
            : "No loans returned"
        )
      }

      const alertsMap = {}
      if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
        for (const a of alertsRes.value) {
          const lId = a.ewsScore?.loanId || a.loanId
          if (lId) alertsMap[lId] = a.id
        }
      }

      const overdueLoans = loansRes.value.filter(
        (l) =>
          l.status === "overdue" ||
          l.status === "defaulted" ||
          (Array.isArray(l.schedules) && l.schedules.length > 0) ||
          Boolean(alertsMap[l.id])
      )

      const mapped = overdueLoans
        .map((l) => mapLiveLoan(l, alertsMap[l.id]))
        .sort((a, b) => b.daysLate - a.daysLate)

      setQueue(mapped)
      setIsLive(true)
    } catch (err) {
      setQueue([])
      setIsLive(false)
      setError(err?.message || "Could not load overdue queue from API")
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
            {isLive ? "Live API" : "Offline"}
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
          Live loans with overdue installments. Click a row to open the repayment schedule.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}. Re-run <code className="text-xs">npm run seed:demo-portfolio</code> if the
          tenant has no overdue loans.
        </div>
      ) : null}

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            {loading ? "Loading…" : `${queue.length} accounts in queue`}
          </CardTitle>
          <CardDescription>
            Amount due = sum of overdue installments. Principal is the original facility size.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {queue.length === 0 && !loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No overdue loans in the database yet.
            </div>
          ) : null}
          <div className="divide-y divide-border">
            {queue.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_8.5rem_auto] sm:items-center sm:px-6"
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
                    {row.product} · facility {formatLkr(row.principal)}
                    {row.overdueInstallments
                      ? ` · ${row.overdueInstallments} overdue installment(s)`
                      : ""}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {row.village} · {row.daysLate}d late
                  </p>
                </button>

                <div className="sm:text-right">
                  <p className="text-sm font-medium tabular-nums">{formatLkr(row.amountDue)}</p>
                  <p className="text-xs text-muted-foreground">Due now</p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
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
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => onOpenLoan?.(row.id)}
                  >
                    Schedule
                  </Button>
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
