import { useState, useEffect } from "react"
import { AlertTriangle, Building2, ChevronRight, MapPin, RefreshCw, Wallet } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useStore } from "@/store"
import {
  ACTIVE_LOANS,
  COLLECTION_ROUTE,
  OFFICER,
  PORTFOLIO_STATS,
  formatLkr,
} from "./mock-data"
import { getLoans, getEwsAlerts, getParSummary } from "@/lib/m3-api"

function statusBadge(status) {
  if (status === "ews") return <Badge variant="destructive">EWS</Badge>
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>
  return <Badge variant="secondary">Current</Badge>
}

function useLoggedInOfficer() {
  const currentUser = useStore((state) => state.currentUser)
  const staff = useStore((state) => state.staff)

  const fullName = currentUser
    ? `${currentUser.firstName ?? ""} ${currentUser.lastName ?? ""}`.trim()
    : ""

  const staffMatch = staff?.find(
    (member) =>
      member.name?.toLowerCase() === fullName.toLowerCase() ||
      member.email?.toLowerCase() === currentUser?.email?.toLowerCase()
  )

  return {
    name: fullName || OFFICER.name,
    branch: staffMatch?.branch || OFFICER.branch,
    portfolioId: OFFICER.portfolioId,
    role: currentUser?.role || "Loan Officer",
  }
}

function KpiCard({ label, value, hint, emphasize, onClick }) {
  const className = `rounded-xl border border-border bg-card p-5 text-left ${
    onClick ? "cursor-pointer transition-colors hover:bg-muted/50" : ""
  }`
  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold tabular-nums ${
          emphasize ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}

export default function LoanOfficerDashboard({
  onOpenLoan,
  onOpenOverdue,
  onOpenEwsInbox,
  onOpenBranch,
  onOpenCollection,
}) {
  const officer = useLoggedInOfficer()
  const [stats, setStats] = useState(PORTFOLIO_STATS)
  const [loans, setLoans] = useState(ACTIVE_LOANS)
  const [isLive, setIsLive] = useState(false)
  const [loading, setLoading] = useState(false)

  async function loadDashboardData() {
    setLoading(true)
    try {
      const [loansRes, alertsRes, parRes] = await Promise.allSettled([
        getLoans({ status: "active" }),
        getEwsAlerts({ status: "open" }),
        getParSummary(),
      ])

      let liveActiveCount = PORTFOLIO_STATS.activeLoans
      let liveEwsCount = PORTFOLIO_STATS.ewsAlertCount
      let livePar = PORTFOLIO_STATS.par30
      let hasLive = false

      if (loansRes.status === "fulfilled" && Array.isArray(loansRes.value) && loansRes.value.length > 0) {
        liveActiveCount = loansRes.value.length
        hasLive = true
        const mappedLoans = loansRes.value.slice(0, 5).map((l) => ({
          id: l.id,
          borrower: l.borrower?.fullName || "Borrower",
          product: l.product?.name || "Loan",
          outstanding: Number(l.principal || 0),
          daysLate: 0,
          nextDue: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          status: l.status === "active" ? "current" : l.status,
        }))
        setLoans(mappedLoans)
      }

      if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
        liveEwsCount = alertsRes.value.length
        hasLive = true
      }

      if (parRes.status === "fulfilled" && parRes.value && typeof parRes.value.par30Ratio === "number") {
        livePar = (parRes.value.par30Ratio * 100).toFixed(1)
        hasLive = true
      }

      if (hasLive) {
        setStats({
          activeLoans: liveActiveCount,
          ewsAlertCount: liveEwsCount,
          overdueCount: PORTFOLIO_STATS.overdueCount,
          par30: livePar,
        })
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
    loadDashboardData()
  }, [])

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {officer.role} · Field operations
          </p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{officer.name}</h1>
            <Badge variant={isLive ? "default" : "secondary"}>
              {isLive ? "Live API" : "Demo Data"}
            </Badge>
          </div>
          {!Boolean(typeof window !== "undefined" && localStorage.getItem("mf_auth_token")) && (
            <p className="text-xs text-muted-foreground">
              No auth token — log in via M4 to see live data
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {officer.branch} · {officer.portfolioId}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
            disabled={loading}
            className="cursor-pointer"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <button
            type="button"
            onClick={() => onOpenBranch?.()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
          >
            <Building2 className="size-3.5" />
            Branch view
          </button>
          <button
            type="button"
            onClick={() => onOpenEwsInbox?.()}
            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border border-transparent bg-destructive/10 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/15"
          >
            <AlertTriangle className="size-3.5" />
            EWS alerts {stats.ewsAlertCount}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Active loans"
          value={stats.activeLoans}
          hint="My portfolio"
        />
        <KpiCard
          label="EWS alerts"
          value={stats.ewsAlertCount}
          hint="Open early-warning cases"
          emphasize
          onClick={() => onOpenEwsInbox?.()}
        />
        <KpiCard
          label="Overdue"
          value={stats.overdueCount}
          hint="Accounts past due date"
          onClick={() => onOpenOverdue?.()}
        />
        <KpiCard
          label="PAR30"
          value={`${stats.par30}%`}
          hint="Portfolio at risk > 30 days"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">My active loans</CardTitle>
            <CardDescription>
              Open a loan for the schedule and repayment history.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border">
              {loans.map((loan) => (
                <button
                  key={loan.id}
                  type="button"
                  onClick={() => onOpenLoan?.(loan.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{loan.borrower}</p>
                      {statusBadge(loan.status)}
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {loan.id} · {loan.product}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatLkr(loan.outstanding)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {loan.daysLate > 0
                        ? `${loan.daysLate}d late`
                        : `Due ${loan.nextDue.slice(5)}`}
                    </p>
                  </div>
                  <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
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
                className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-start gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-medium text-primary-foreground tabular-nums">
                  {stop.priority}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{stop.borrower}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{stop.village}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{stop.reason}</p>
                </div>
                <div className="shrink-0 text-right">
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
