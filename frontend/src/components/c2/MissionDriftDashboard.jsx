import { ArrowDown, ArrowDownRight, ArrowUpRight, AlertTriangle } from "lucide-react"
import { Link } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { MISSION_DRIFT } from "./mock-data"

function MetricRow({ label, change, direction, positiveIsGood = false }) {
  const isGood =
    direction === "up"
      ? !positiveIsGood
      : positiveIsGood
  const Icon = direction === "up" ? ArrowUpRight : ArrowDownRight

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
        <Icon className="size-4" />
        {change}%
      </span>
    </div>
  )
}

export default function MissionDriftDashboard() {
  const data = MISSION_DRIFT

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 2 · Mission intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Mission drift dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Compare financial performance against social outreach to detect mission drift
        </p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Mission intelligence
          </CardDescription>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Mission drift index</CardTitle>
              <p className="mt-3 text-5xl font-semibold tabular-nums">{data.dashboard.mdi}</p>
              <Badge variant="secondary" className="mt-2">
                {data.dashboard.status}
              </Badge>
            </div>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/mission-drift/detail">View MDI detail</Link>
            </Button>
          </div>
          <CardDescription className="mt-2">{data.dashboard.statusHint}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Financial performance</CardTitle>
            <CardDescription>Recent movement in portfolio health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {data.financialPerformance.map((metric) => (
              <MetricRow key={metric.label} {...metric} />
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center justify-center">
          <span className="rounded-full border bg-muted/40 px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            versus
          </span>
        </div>

        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Social performance</CardTitle>
            <CardDescription>Outreach and inclusion indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {data.socialPerformance.map((metric) => (
              <MetricRow key={metric.label} {...metric} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-amber-500/30 bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">MDI</CardTitle>
          <CardDescription>When financial performance rises while social performance falls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <span className="text-muted-foreground">Financial performance </span>
              <ArrowUpRight className="ml-1 inline size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <span className="text-muted-foreground">Social performance </span>
              <ArrowDownRight className="ml-1 inline size-4 text-destructive" />
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="size-5 text-muted-foreground" />
          </div>

          <div className="flex items-center justify-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold tracking-wide">Mission drift</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" className="cursor-pointer">
          <Link to="/social-performance">Social performance detail</Link>
        </Button>
        <Button asChild variant="outline" className="cursor-pointer">
          <Link to="/finance-manager">Finance dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
