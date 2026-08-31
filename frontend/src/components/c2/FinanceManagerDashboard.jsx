import { Link } from "react-router-dom"
import { AlertTriangle, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { FinanceReportLinks, FinanceSummaryCards } from "./BalanceSheetReport"
import { MISSION_DRIFT } from "./mock-data"

export default function FinanceManagerDashboard() {
  const mdi = MISSION_DRIFT.dashboard

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 2 · Finance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Finance dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Institution financial position and standard reporting views
          </p>
        </div>
        <Badge variant="outline">Reporting period · Aug 2026</Badge>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">Finance</CardDescription>
          <CardTitle className="text-base font-semibold">Position summary</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <FinanceSummaryCards />
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base font-semibold">Mission drift snapshot</CardTitle>
              <CardDescription>
                MDI {mdi.mdi} · {mdi.status} — review when financial and social trends diverge
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm" className="cursor-pointer">
              <Link to="/alerts">
                Open mission drift dashboard
                <ChevronRight />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3 pt-5">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            <span>{mdi.statusHint}</span>
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
