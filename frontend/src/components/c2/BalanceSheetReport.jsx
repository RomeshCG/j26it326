import { Link } from "react-router-dom"
import {
  ArrowLeftRight,
  FileText,
  Landmark,
  ScrollText,
  Wallet,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { BALANCE_SHEET, FINANCE_SUMMARY, formatLkr, formatLkrMillions } from "./mock-data"

export default function BalanceSheetReport() {
  const totalAssets = BALANCE_SHEET.assets.reduce((sum, row) => sum + row.amount, 0)
  const totalLiabilities = BALANCE_SHEET.liabilities.reduce((sum, row) => sum + row.amount, 0)
  const totalEquity = BALANCE_SHEET.equity.reduce((sum, row) => sum + row.amount, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 2 · Finance
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Balance sheet</h1>
        <p className="text-sm text-muted-foreground">As at {BALANCE_SHEET.asOf}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Assets" rows={BALANCE_SHEET.assets} total={totalAssets} />
        <div className="space-y-4">
          <Section title="Liabilities" rows={BALANCE_SHEET.liabilities} total={totalLiabilities} />
          <Section title="Equity" rows={BALANCE_SHEET.equity} total={totalEquity} />
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
          <p className="text-sm font-medium">
            Total liabilities + equity: {formatLkrMillions(totalLiabilities + totalEquity)}
          </p>
          <Button asChild variant="outline" className="cursor-pointer">
            <Link to="/finance-manager">Back to finance dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function Section({ title, rows, total }) {
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 pt-5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{row.label}</span>
            <span className="font-medium tabular-nums">{formatLkr(row.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-border/50 pt-3 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{formatLkr(total)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function FinanceReportLinks() {
  const links = [
    { title: "P&L report", description: "Profit and loss statement", href: "/pl-report", icon: FileText },
    { title: "Balance sheet", description: "Assets, liabilities, and equity", href: "/balance-sheet", icon: Landmark },
    { title: "Cash flow", description: "Operating, investing, and financing", href: "/cash-flow", icon: ArrowLeftRight },
    { title: "Transaction ledger", description: "Detailed posting history", href: "/pl-report#ledger", icon: ScrollText },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {links.map((link) => {
        const Icon = link.icon
        return (
          <Link
            key={link.href}
            to={link.href}
            className="rounded-xl border bg-card p-5 shadow-sm transition-colors hover:bg-muted/40"
          >
            <div className="flex items-start gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </div>
              <div>
                <p className="font-medium">{link.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

export function FinanceSummaryCards() {
  const items = [
    { label: "Cash position", value: formatLkrMillions(FINANCE_SUMMARY.cashPosition), icon: Wallet },
    { label: "Assets", value: formatLkrMillions(FINANCE_SUMMARY.assets), icon: Landmark },
    { label: "Liabilities", value: formatLkrMillions(FINANCE_SUMMARY.liabilities), icon: FileText },
    { label: "Equity", value: formatLkrMillions(FINANCE_SUMMARY.equity), icon: ScrollText },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => {
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
  )
}
