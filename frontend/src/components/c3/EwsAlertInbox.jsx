import { useState, useEffect, useMemo } from "react"
import { ArrowLeft, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { RiskTrendIndicator } from "./TemporalSignalFusion"
import { formatLkr } from "./mock-data"
import { getBorrowers, getEwsAlerts } from "@/lib/m3-api"

const BAND_META = {
  stable: {
    label: "Stable",
    dotClass: "bg-emerald-500",
    badgeClass:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  watch: {
    label: "Watch",
    dotClass: "bg-amber-500",
    badgeClass:
      "border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  high: {
    label: "High risk",
    dotClass: "bg-destructive",
    badgeClass: "border-transparent bg-destructive/15 text-destructive",
  },
}

function mapAlert(a) {
  const fusion = a.ewsScore?.fusionSummary || {}
  const distress = Number(a.ewsScore?.distressScore ?? 0)
  const bandRaw = String(a.ewsScore?.riskBand || "watch").toLowerCase()
  const band = bandRaw === "high" || bandRaw === "watch" || bandRaw === "stable" ? bandRaw : "watch"

  return {
    id: a.id,
    borrower: a.ewsScore?.borrower?.fullName || "Borrower",
    nic: a.ewsScore?.borrower?.nicNumber || "—",
    loanId: fusion.loanId || a.ewsScore?.borrower?.id || "—",
    product: "Microenterprise",
    distressProbability: Math.round(distress * 100),
    daysLate: Number(fusion.daysPastDue ?? 0),
    outstanding: Number(fusion.principal ?? 0),
    signal: fusion.signal || "Distress signal",
    band,
    rationale: a.rationale || "",
    status: a.status,
  }
}

export default function EwsAlertInbox({ onBack, onOpenAlert }) {
  const [alerts, setAlerts] = useState([])
  const [borrowerCount, setBorrowerCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [error, setError] = useState(null)

  async function loadAlerts() {
    setLoading(true)
    setError(null)
    try {
      const [alertsData, borrowersData] = await Promise.all([
        getEwsAlerts(),
        getBorrowers().catch(() => []),
      ])

      const list = Array.isArray(alertsData) ? alertsData.map(mapAlert) : []
      const borrowers = Array.isArray(borrowersData) ? borrowersData : []

      setAlerts(list)
      setBorrowerCount(borrowers.length)
      setIsLive(list.length > 0)
      if (list.length === 0) {
        setError(
          "No EWS alerts in the database yet. From backend/ run: npm run seed:demo-portfolio"
        )
      }
    } catch (err) {
      setAlerts([])
      setIsLive(false)
      setError(err?.message || "Failed to load EWS alerts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => b.distressProbability - a.distressProbability),
    [alerts]
  )

  const summary = useMemo(() => {
    const high = alerts.filter((a) => a.band === "high").length
    const watch = alerts.filter((a) => a.band === "watch").length
    const monitored = Math.max(borrowerCount, alerts.length)
    const stable = Math.max(0, monitored - high - watch)
    return { monitored, stable, watch, highRisk: high }
  }, [alerts, borrowerCount])

  const trendRows = useMemo(
    () =>
      sorted.slice(0, 8).map((a) => ({
        id: a.nic,
        borrower: a.borrower,
        alertId: a.id,
        trendLevel: a.band === "high" ? 3 : a.band === "watch" ? 2 : 1,
        signal: a.signal,
        band: a.band,
        distress: a.distressProbability,
      })),
    [sorted]
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack} className="cursor-pointer">
          <ArrowLeft />
          Back to dashboard
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant={isLive ? "default" : "secondary"}>
            {isLive ? "Live API" : "No alerts"}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadAlerts}
            disabled={loading}
            className="cursor-pointer gap-1.5"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 3 · Borrower risk monitoring
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Early warning dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Live EWS alerts from the tenant database (rule-based seed / batch-score). Open a case
          for detail.
        </p>
      </div>

      {error ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          {error}
        </div>
      ) : null}

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Portfolio monitoring
          </CardDescription>
          <CardTitle className="text-base font-semibold">Borrower early warning</CardTitle>
          <CardDescription>
            {summary.monitored} borrowers in tenant · {alerts.length} open EWS alert
            {alerts.length === 1 ? "" : "s"}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          {[
            { key: "stable", count: summary.stable },
            { key: "watch", count: summary.watch },
            { key: "high", count: summary.highRisk },
          ].map(({ key, count }) => {
            const meta = BAND_META[key]
            return (
              <div key={key} className="rounded-lg border bg-muted/30 p-4">
                <div className="flex items-center gap-2">
                  <span className={`size-2.5 rounded-full ${meta.dotClass}`} />
                  <p className="text-sm font-medium">{meta.label}</p>
                </div>
                <p className="mt-2 text-3xl font-semibold tabular-nums">
                  {count.toLocaleString()}
                </p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Risk trend</CardTitle>
          <CardDescription>
            Borrowers with rising distress signals — open a row for detail
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {trendRows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No EWS rows yet.
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Borrower</th>
                  <th className="px-4 py-3 font-medium">Risk trend</th>
                  <th className="px-4 py-3 font-medium">Signal</th>
                  <th className="px-4 py-3 font-medium">Band</th>
                  <th className="px-4 py-3 font-medium text-right">Distress</th>
                </tr>
              </thead>
              <tbody>
                {trendRows.map((row) => {
                  const band = BAND_META[row.band] || BAND_META.watch
                  return (
                    <tr
                      key={row.alertId}
                      className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/50"
                      onClick={() => onOpenAlert?.(row.alertId)}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.borrower}</p>
                        <p className="text-xs text-muted-foreground">{row.id}</p>
                      </td>
                      <td className="px-4 py-3">
                        <RiskTrendIndicator level={row.trendLevel} />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.signal}</td>
                      <td className="px-4 py-3">
                        <Badge className={band.badgeClass}>{band.label}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.distress}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Open EWS cases</CardTitle>
          <CardDescription>
            {sorted.length} alert{sorted.length === 1 ? "" : "s"} requiring officer review,
            ordered by distress probability
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          {sorted.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              No open cases.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sorted.map((alert) => (
                <button
                  key={alert.id}
                  type="button"
                  onClick={() => onOpenAlert?.(alert.id)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 sm:px-6"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium">{alert.borrower}</p>
                      <Badge variant="destructive">Early warning</Badge>
                      <Badge variant="outline">{BAND_META[alert.band]?.label || alert.band}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {alert.signal}
                      {alert.loanId && alert.loanId !== "—" ? ` · loan ${alert.loanId.slice(0, 8)}…` : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                      {alert.daysLate}d late
                      {alert.outstanding
                        ? ` · facility ${formatLkr(alert.outstanding)}`
                        : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium tabular-nums text-destructive">
                      {alert.distressProbability}%
                    </p>
                    <p className="text-xs text-muted-foreground">Distress</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
