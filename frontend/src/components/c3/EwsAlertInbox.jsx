import { ArrowLeft } from "lucide-react"

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
import {
  EWS_ALERT_LIST,
  EWS_MONITORING_SUMMARY,
  RISK_TREND_ROWS,
  formatLkr,
} from "./mock-data"

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

export default function EwsAlertInbox({ onBack, onOpenAlert }) {
  const summary = EWS_MONITORING_SUMMARY
  const sorted = [...EWS_ALERT_LIST].sort(
    (a, b) => b.distressProbability - a.distressProbability
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <Button type="button" variant="ghost" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to dashboard
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 3 · Borrower risk monitoring
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Early warning dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Portfolio-wide distress monitoring with temporal signal fusion on each case.
        </p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Portfolio monitoring
          </CardDescription>
          <CardTitle className="text-base font-semibold">Borrower early warning</CardTitle>
          <CardDescription>
            {summary.monitored} borrowers actively monitored in your branch portfolio
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
                <p className="mt-2 text-3xl font-semibold tabular-nums">{count.toLocaleString()}</p>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Risk trend</CardTitle>
          <CardDescription>
            Borrowers with rising distress signals — open a row for temporal fusion detail
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
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
              {RISK_TREND_ROWS.map((row) => {
                const band = BAND_META[row.band]
                return (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b transition-colors last:border-b-0 hover:bg-muted/50"
                    onClick={() => onOpenAlert?.(row.alertId)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.id}</p>
                      <p className="text-xs text-muted-foreground">{row.borrower}</p>
                    </td>
                    <td className="px-4 py-3">
                      <RiskTrendIndicator level={row.trendLevel} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.signal}</td>
                    <td className="px-4 py-3">
                      <Badge className={band.badgeClass}>{band.label}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {sorted.find((alert) => alert.id === row.alertId)?.distressProbability ?? "—"}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Open EWS cases</CardTitle>
          <CardDescription>
            {sorted.length} alerts requiring officer review, ordered by distress probability
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
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
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {alert.id} · {alert.loanId} · {alert.product}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {alert.daysLate}d late · OS {formatLkr(alert.outstanding)}
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
        </CardContent>
      </Card>
    </div>
  )
}
