import { useMemo, useState } from "react"
import { ArrowLeft, ChevronRight, ShieldAlert } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { ALERTS, BRANCH_LIST, BRANCHES } from "./mock-data"

const selectClass =
  "flex h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

function StatCard({ label, value, hint, emphasize }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
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
    </div>
  )
}

export default function BranchPortfolio({ onBack, onOpenAlert, onOpenEarlyWarning, initialBranchId }) {
  const [branchId, setBranchId] = useState(initialBranchId || BRANCH_LIST[0].id)
  const portfolio = useMemo(
    () => BRANCHES[branchId] ?? BRANCH_LIST[0],
    [branchId]
  )
  const { branch, manager, stats, officers, topAlerts } = portfolio

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to officer dashboard
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 3 · Branch risk monitoring
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{branch}</h1>
          <p className="text-sm text-muted-foreground">
            Manager {manager} · {stats.officers} loan officers
          </p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
          <div className="w-full space-y-2 sm:w-56">
            <Label htmlFor="branch-select">Select branch</Label>
            <select
              id="branch-select"
              value={branchId}
              onChange={(event) => setBranchId(event.target.value)}
              className={selectClass}
            >
              {BRANCH_LIST.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.branch}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="destructive"
            className="h-9 shrink-0 cursor-pointer px-3 text-sm"
            onClick={() => onOpenEarlyWarning?.()}
          >
            <ShieldAlert className="size-3.5" />
            Early warning · {stats.ewsAlertCount}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active loans" value={stats.activeLoans} hint="Branch portfolio" />
        <button
          type="button"
          onClick={() => onOpenEarlyWarning?.()}
          className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-muted/50"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            EWS alerts
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">
            {stats.ewsAlertCount}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Open early warning dashboard</p>
        </button>
        <StatCard label="Overdue" value={stats.overdueCount} hint="Past due" />
        <StatCard label="PAR30" value={`${stats.par30}%`} hint="At risk > 30d" />
        <StatCard
          label="Collection"
          value={`${stats.collectionRate}%`}
          hint="This month"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Officer portfolios</CardTitle>
            <CardDescription>PAR30 and EWS load by loan officer.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <div className="divide-y divide-border">
              {officers.map((officer) => (
                <div
                  key={officer.portfolioId}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{officer.name}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {officer.portfolioId} · {officer.activeLoans} loans
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-destructive">
                      {officer.ews} EWS
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      PAR30 {officer.par30}% · {officer.overdue} overdue
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Top EWS alerts</CardTitle>
            <CardDescription>Highest distress probability in the branch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 pt-4">
            {topAlerts.map((alert) => {
              const canOpen = Boolean(ALERTS[alert.id])
              return (
                <button
                  key={`${alert.id}-${alert.officer}`}
                  type="button"
                  disabled={!canOpen}
                  onClick={() => canOpen && onOpenAlert?.(alert.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-background"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{alert.borrower}</p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {alert.id} · {alert.officer}
                    </p>
                  </div>
                  <Badge variant="destructive" className="tabular-nums">
                    {alert.probability}%
                  </Badge>
                  {canOpen ? (
                    <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
                  ) : (
                    <span className="size-4" />
                  )}
                </button>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
