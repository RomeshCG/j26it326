import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { CASH_FLOW_SUMMARY, formatLkr } from "./mock-data"

export default function CashFlowReport() {
  const data = CASH_FLOW_SUMMARY

  const rows = [
    { label: "Cash from operations", amount: data.operating },
    { label: "Cash from investing", amount: data.investing },
    { label: "Cash from financing", amount: data.financing },
    { label: "Net change in cash", amount: data.netChange, emphasis: true },
    { label: "Opening cash", amount: data.openingCash },
    { label: "Closing cash", amount: data.closingCash, emphasis: true },
  ]

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 2 · Finance
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Cash flow statement</h1>
        <p className="text-sm text-muted-foreground">{data.period}</p>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Summary</CardTitle>
          <CardDescription>Standard cash flow presentation for the reporting period</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-5">
          {rows.map((row) => (
            <div
              key={row.label}
              className={`flex items-center justify-between gap-3 text-sm ${row.emphasis ? "font-semibold" : ""}`}
            >
              <span className={row.emphasis ? "text-foreground" : "text-muted-foreground"}>
                {row.label}
              </span>
              <span className={`tabular-nums ${row.amount < 0 ? "text-destructive" : ""}`}>
                {formatLkr(row.amount)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button asChild variant="outline" className="cursor-pointer">
        <Link to="/finance-manager">Back to finance dashboard</Link>
      </Button>
    </div>
  )
}
