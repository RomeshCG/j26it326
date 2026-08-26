import {
  ArrowLeft,
  CalendarClock,
  ChevronRight,
  Phone,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  LOAN_DETAILS,
  formatLkr,
  scheduleStatusBadge,
} from "./mock-data"

function loanStatusBadge(status) {
  if (status === "ews") return <Badge variant="destructive">EWS</Badge>
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>
  return <Badge variant="secondary">Current</Badge>
}

export default function LoanDetail({
  loanId,
  onBack,
  onOpenAlert,
  onOpenGroup,
  onOpenCollection,
}) {
  const loan = LOAN_DETAILS[loanId] ?? LOAN_DETAILS["LN-88421"]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to dashboard
      </Button>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Loan detail · {loan.id}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {loan.borrower}
              </CardTitle>
              <CardDescription>
                {loan.product} · {loan.village}
              </CardDescription>
            </div>
            {loanStatusBadge(loan.status)}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Outstanding
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {formatLkr(loan.outstanding)}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Installment
            </p>
            <p className="mt-1 text-sm font-medium tabular-nums">
              {formatLkr(loan.installment)} · {loan.cycle}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Disbursed
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <CalendarClock className="size-3.5 text-muted-foreground" />
              {loan.disbursed}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Contact
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-medium">
              <Phone className="size-3.5 text-muted-foreground" />
              {loan.phone}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {loan.alertId ? (
          <Button
            type="button"
            size="lg"
            className="cursor-pointer"
            onClick={() => onOpenAlert?.(loan.alertId)}
          >
            Open EWS alert
          </Button>
        ) : null}
        {loan.groupId ? (
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenGroup?.(loan.groupId)}
          >
            <Users />
            View group
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="cursor-pointer"
          onClick={() =>
            onOpenCollection?.({
              id: `STOP-${loan.id}`,
              loanId: loan.id,
              borrower: loan.borrower,
              village: loan.village,
              amountDue: loan.installment,
              priority: 1,
              reason: loan.daysLate > 0 ? `${loan.daysLate}d late` : "Due today",
            })
          }
        >
          Record collection
        </Button>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Repayment schedule</CardTitle>
          <CardDescription>
            Principal {formatLkr(loan.principal)} · Purpose: {loan.purpose}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="divide-y divide-border">
            {loan.schedule.map((row) => {
              const badge = scheduleStatusBadge(row.status)
              return (
                <div
                  key={row.id}
                  className="flex items-center gap-3 px-4 py-3 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">Installment {row.id}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">Due {row.due}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {formatLkr(row.amount)}
                    </p>
                    {row.paid > 0 && row.paid < row.amount ? (
                      <p className="text-sm text-muted-foreground tabular-nums">
                        Paid {formatLkr(row.paid)}
                      </p>
                    ) : null}
                  </div>
                  <Badge variant={badge.variant}>{badge.label}</Badge>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {loan.interventions.length > 0 ? (
        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Intervention history</CardTitle>
            <CardDescription>Past field actions recorded on this loan.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pt-0">
            <div className="divide-y divide-border">
              {loan.interventions.map((item) => (
                <div key={item.id} className="flex items-start gap-3 px-4 py-3 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{item.type}</p>
                      <Badge variant="outline">{item.date}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{item.outcome}</p>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-muted-foreground" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
