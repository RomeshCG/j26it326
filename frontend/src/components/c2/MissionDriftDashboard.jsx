import { useState, useEffect } from "react"
import { ArrowDown, ArrowDownRight, ArrowUpRight, AlertTriangle, RefreshCw } from "lucide-react"
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

import { fetchMissionDriftDashboard } from "@/lib/m2-api"
import { MISSION_DRIFT } from "./mock-data"

function MetricRow({ label, change, positiveIsGood = false, adverse = false }) {
  // If adverse is explicitly provided from MDI calculation, use it. Otherwise use positiveIsGood rule
  const isGood = adverse !== undefined ? !adverse : (change >= 0 ? positiveIsGood : !positiveIsGood)
  const isUp = change >= 0
  const Icon = isUp ? ArrowUpRight : ArrowDownRight

  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${isGood ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
        <Icon className="size-4" />
        {isUp ? "+" : ""}{change}%
      </span>
    </div>
  )
}

export default function MissionDriftDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [useFallback, setUseFallback] = useState(false)

  const loadDashboard = async () => {
    try {
      setLoading(true)
      const res = await fetchMissionDriftDashboard()
      setData(res)
      setUseFallback(false)
    } catch (err) {
      console.warn("Using mock fallback for Mission Drift Dashboard:", err)
      setUseFallback(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDashboard()
  }, [])

  // Live data or fallback
  const mdiScore = data ? data.mdi : MISSION_DRIFT.dashboard.mdi
  const isAlert = data ? data.state === "alert" : false
  const statusLabel = isAlert ? "Alert (Drift Detected)" : "Normal"
  const dataSource = data?.dataSource || "mock"
  const finMetrics = data?.financialPerformance || MISSION_DRIFT.financialPerformance
  const socMetrics = data?.socialPerformance || MISSION_DRIFT.socialPerformance

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 2 · Mission intelligence
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Mission drift dashboard</h1>
            {data && (
              <Badge variant="outline" className="text-xs">
                {dataSource === "synthetic" ? "Synthetic demo scenario" : dataSource}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Compare financial performance against social outreach to detect mission drift
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDashboard} disabled={loading} className="gap-2">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button asChild size="sm" variant={isAlert ? "destructive" : "outline"} className="cursor-pointer">
            <Link to="/alerts">
              <AlertTriangle className="mr-1.5 size-4" />
              View Alerts {isAlert ? "(Action Required)" : ""}
            </Link>
          </Button>
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Mission intelligence
          </CardDescription>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold">Mission drift index (MDI)</CardTitle>
              <div className="mt-2 flex items-baseline gap-3">
                <p className="text-5xl font-semibold tabular-nums">{mdiScore}</p>
                <span className="text-sm text-muted-foreground">Threshold: {data?.threshold ?? 20}</span>
              </div>
              <Badge
                variant={isAlert ? "destructive" : "secondary"}
                className="mt-2"
              >
                {statusLabel}
              </Badge>
            </div>
            <Button asChild variant="outline" className="cursor-pointer">
              <Link to="/mission-drift/detail">View MDI detail</Link>
            </Button>
          </div>
          <CardDescription className="mt-2">
            {isAlert
              ? "Warning: Outreach indicators to lowest-income & rural segments are declining as commercial portfolio expands."
              : "Social indicators and portfolio outreach remain aligned with institutional mission."}
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <Card className="rounded-xl border bg-card shadow-sm">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Financial performance</CardTitle>
            <CardDescription>Recent movement in portfolio health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {finMetrics.map((metric) => (
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
            <CardDescription>Outreach and inclusion indicators (3-mo trend)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-5">
            {socMetrics.map((metric) => (
              <MetricRow key={metric.label || metric.indicator} {...metric} />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border border-amber-500/30 bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Mission Drift Dynamics</CardTitle>
          <CardDescription>When financial metrics improve while social outreach contracts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-muted/30 p-4 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Financial Growth & Yield</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                Expanding <ArrowUpRight className="size-4" />
              </span>
            </div>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm flex items-center justify-between">
              <span className="text-muted-foreground">Vulnerable & Poverty Outreach</span>
              <span className="font-semibold text-destructive flex items-center gap-1">
                Contracting <ArrowDownRight className="size-4" />
              </span>
            </div>
          </div>

          <div className="flex justify-center">
            <ArrowDown className="size-5 text-muted-foreground" />
          </div>

          <div className={`flex items-center justify-center gap-2 rounded-lg border p-3 ${
            isAlert
              ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          }`}>
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold tracking-wide">
              {isAlert ? "Mission Drift Detected (MDI > 20)" : "Mission Aligned"}
            </span>
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
