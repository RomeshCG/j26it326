import { ArrowLeft, ChevronRight, MapPin } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { OVERDUE_QUEUE, formatLkr } from "./mock-data"

export default function OverdueQueue({ onBack, onOpenLoan, onOpenAlert, onOpenCollection }) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to dashboard
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Field operations · overdue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Overdue & PAR queue</h1>
        <p className="text-sm text-muted-foreground">
          Accounts past due, ordered by days late. Open a loan, EWS alert, or collection stop.
        </p>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            {OVERDUE_QUEUE.length} accounts in queue
          </CardTitle>
          <CardDescription>PAR buckets reflect days past contractual due date.</CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="divide-y divide-border">
            {OVERDUE_QUEUE.map((row) => (
              <div
                key={row.id}
                className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_7.5rem_auto] sm:items-center sm:px-6"
              >
                <button
                  type="button"
                  onClick={() => onOpenLoan?.(row.id)}
                  className="min-w-0 cursor-pointer text-left transition-colors hover:opacity-80"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{row.borrower}</p>
                    <Badge variant="destructive">{row.parBucket}</Badge>
                    {row.alertId ? <Badge variant="outline">EWS</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {row.id} · {row.product}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="size-3.5 shrink-0" />
                    {row.village} · {row.daysLate}d late
                  </p>
                </button>

                <div className="sm:text-right">
                  <p className="text-sm font-medium tabular-nums">{formatLkr(row.amountDue)}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    OS {formatLkr(row.outstanding)}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {row.alertId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => onOpenAlert?.(row.alertId)}
                    >
                      Alert
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() =>
                      onOpenCollection?.({
                        id: `STOP-${row.id}`,
                        loanId: row.id,
                        borrower: row.borrower,
                        village: row.village,
                        amountDue: row.amountDue,
                        priority: row.daysLate,
                        reason: `${row.parBucket} — ${row.daysLate} days late`,
                      })
                    }
                  >
                    Collect
                    <ChevronRight />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
