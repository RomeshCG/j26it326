import { AlertTriangle, ChevronRight, MapPin, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ACTIVE_LOANS,
  COLLECTION_ROUTE,
  OFFICER,
  PORTFOLIO_STATS,
  formatLkr,
} from "./mock-data"

function statusBadge(status) {
  if (status === "ews") return <Badge variant="destructive">EWS</Badge>
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>
  return <Badge variant="secondary">Current</Badge>
}

export default function LoanOfficerDashboard({ onOpenAlert, onOpenCollection }) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 3 · Field operations
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Loan officer dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {OFFICER.name} · {OFFICER.branch} · {OFFICER.portfolioId}
          </p>
        </div>
        <Badge variant="destructive" className="h-8 px-3 text-sm">
          <AlertTriangle className="size-3.5" />
          EWS alerts {PORTFOLIO_STATS.ewsAlertCount}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Active loans
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{PORTFOLIO_STATS.activeLoans}</p>
          <p className="mt-1 text-sm text-muted-foreground">My portfolio</p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            EWS alerts
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">
            {PORTFOLIO_STATS.ewsAlertCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Open early-warning cases</p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Overdue
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{PORTFOLIO_STATS.overdueCount}</p>
          <p className="mt-1 text-sm text-muted-foreground">Accounts past due date</p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            PAR30
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{PORTFOLIO_STATS.par30}%</p>
          <p className="mt-1 text-sm text-muted-foreground">Portfolio at risk &gt; 30 days</p>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">My active loans</CardTitle>
            <CardDescription>Tap an EWS row to open Temporal Signal Fusion.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border">
              {ACTIVE_LOANS.map((loan) => (
                <button
                  key={loan.id}
                  type="button"
                  disabled={!loan.alertId}
                  onClick={() => loan.alertId && onOpenAlert(loan.alertId)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{loan.borrower}</p>
                      {statusBadge(loan.status)}
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {loan.id} · {loan.product}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">{formatLkr(loan.outstanding)}</p>
                    <p className="text-sm text-muted-foreground">
                      {loan.daysLate > 0 ? `${loan.daysLate}d late` : `Due ${loan.nextDue.slice(5)}`}
                    </p>
                  </div>
                  {loan.alertId ? (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  ) : (
                    <span className="size-4" />
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Today’s collection route</CardTitle>
            <CardDescription>Ordered by recovery priority.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {COLLECTION_ROUTE.map((stop) => (
              <button
                key={stop.id}
                type="button"
                onClick={() => onOpenCollection(stop)}
                className="flex w-full items-start gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground tabular-nums">
                  {stop.priority}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{stop.borrower}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5" />
                    {stop.village}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{stop.reason}</p>
                </div>
                <div className="text-right">
                  <p className="flex items-center justify-end gap-1 text-sm font-medium tabular-nums">
                    <Wallet className="size-3.5" />
                    {formatLkr(stop.amountDue)}
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
