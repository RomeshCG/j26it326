import { ArrowLeft, ChevronRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { EWS_ALERT_LIST, formatLkr } from "./mock-data"

export default function EwsAlertInbox({ onBack, onOpenAlert }) {
  const sorted = [...EWS_ALERT_LIST].sort(
    (a, b) => b.distressProbability - a.distressProbability
  )

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back to dashboard
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Field operations · EWS
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">EWS alert inbox</h1>
        <p className="text-sm text-muted-foreground">
          Open early-warning cases ordered by distress probability. Tap a row for Temporal
          Signal Fusion.
        </p>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            {sorted.length} open alerts
          </CardTitle>
          <CardDescription>
            Alerts fire 30–60 days before conventional PAR30 default detection.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="divide-y divide-border">
            {sorted.map((alert) => (
              <button
                key={alert.id}
                type="button"
                onClick={() => onOpenAlert?.(alert.id)}
                className="grid w-full grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 sm:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium">{alert.borrower}</p>
                    <Badge variant="destructive">EWS</Badge>
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
                  <p className="text-sm text-muted-foreground">Distress</p>
                </div>
                <ChevronRight className="size-4 justify-self-end text-muted-foreground" />
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
