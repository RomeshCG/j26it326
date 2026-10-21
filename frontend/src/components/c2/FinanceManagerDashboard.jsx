import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, ChevronRight, RefreshCw, Wallet, Landmark, FileText, ScrollText } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { FinanceReportLinks } from "./BalanceSheetReport"
import { formatLkrMillions, FINANCE_SUMMARY, MISSION_DRIFT } from "./mock-data"
import { fetchFinanceDashboard } from "@/lib/m2-api"

export default function FinanceManagerDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const res = await fetchFinanceDashboard()
      setData(res)
    } catch (err) {
      console.warn("Using mock fallback for Finance Dashboard:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const summary = data?.summary || FINANCE_SUMMARY
  const mdi = data?.mdi || MISSION_DRIFT.dashboard
  const isAlert = data ? mdi?.state === "alert" : false
  const period = data?.asOf ? `As of ${data.asOf}` : "Reporting period · Aug 2026"

  const summaryCards = [
    { label: "Cash position", value: formatLkrMillions(summary.cashPosition), icon: Wallet },
    { label: "Assets", value: formatLkrMillions(summary.assets), icon: Landmark },
    { label: "Liabilities", value: formatLkrMillions(summary.liabilities), icon: FileText },
    { label: "Equity", value: formatLkrMillions(summary.equity), icon: ScrollText },
  ]

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 2 · Finance
          </p>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Finance dashboard</h1>
            {data && (
              <Badge variant="outline" className="text-xs">
                {data.kpi?.dataSource === "synthetic" ? "Synthetic demo scenario" : (data.kpi?.dataSource || "live")}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Institution financial position and dual-mission reporting views
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
            <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Badge variant="outline">{period}</Badge>
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardDescription className="text-xs uppercase tracking-wide">Finance</CardDescription>
              <CardTitle className="text-base font-semibold">Position summary (General Ledger)</CardTitle>
            </div>
            {data?.balanced && (
              <Badge variant="secondary" className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30">
                Ledger Balanced: Assets = Liab + Equity
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryCards.map((item) => {
              const Icon = item.icon
              return (
                <Card key={item.label} className="rounded-xl border bg-card shadow-sm">
                  <CardHeader className="pb-2">
                    <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-wide">
                      <Icon className="size-4" />
                      {item.label}
                    </CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums">{item.value}</CardTitle>
                  </CardHeader>
                </Card>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Mission drift snapshot</CardTitle>
              <CardDescription>
                MDI {mdi?.mdi ?? mdi?.score ?? 72} · {isAlert ? "Drift Alert" : (mdi?.status || "Normal")} — early warning when commercial metrics diverge from social mission
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link to="/mission-drift">
                Open mission drift dashboard
                <ChevronRight className="ml-1 size-4" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <div className={`flex items-center gap-2 rounded-lg border px-4 py-3 text-sm ${
            isAlert
              ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
              : "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
          }`}>
            <AlertTriangle className={`size-4 ${isAlert ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`} />
            <span>
              {isAlert
                ? "Social outreach to poorest and rural borrowers is contracting while portfolio yield expands (MDI > 20)."
                : "Social performance indicators are within acceptable mission bounds."}
            </span>
          </div>
          <Button asChild variant="link" className="cursor-pointer px-0">
            <Link to="/mission-drift/detail">View MDI detail</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Financial reports</h2>
          <p className="text-sm text-muted-foreground">
            Standard statements and transaction history
          </p>
        </div>
        <FinanceReportLinks />
      </div>
    </div>
  )
}
