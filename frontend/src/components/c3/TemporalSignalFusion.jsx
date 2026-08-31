import { ArrowDown, ArrowDownRight, ArrowUpRight, Minus } from "lucide-react"

import { cn } from "@/lib/utils"

export default function TrendSequence({ values, direction = "worsening", unit = "" }) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium tabular-nums">
        {values.map((value, index) => (
          <span key={`${value}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-muted-foreground" aria-hidden="true">
                →
              </span>
            ) : null}
            <span>
              {value}
              {unit && typeof value === "number" ? unit : ""}
            </span>
          </span>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        {direction === "worsening" ? (
          <ArrowUpRight className="size-3.5 text-destructive" />
        ) : direction === "improving" ? (
          <ArrowDownRight className="size-3.5 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Minus className="size-3.5" />
        )}
      </div>
    </div>
  )
}

export function BorrowerDistressTimeline({ timeline }) {
  if (!timeline) return null

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Payment delay
        </p>
        <div className="mt-3">
          <TrendSequence
            values={timeline.paymentDelay}
            direction="worsening"
            unit={typeof timeline.paymentDelay[0] === "number" ? " days" : ""}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Group attendance
        </p>
        <div className="mt-3">
          <TrendSequence
            values={timeline.groupAttendance}
            direction="worsening"
            unit={typeof timeline.groupAttendance[0] === "number" ? "%" : ""}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Savings behaviour
        </p>
        <div className="mt-3">
          <TrendSequence values={timeline.savingsBehaviour} direction="worsening" />
        </div>
      </div>
    </div>
  )
}

const LEVEL_STYLES = {
  HIGH: "text-destructive",
  MEDIUM: "text-amber-600 dark:text-amber-400",
  LOW: "text-emerald-600 dark:text-emerald-400",
}

export function TemporalSignalFusionSummary({ fusion }) {
  if (!fusion) return null

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Payment deterioration velocity", value: fusion.paymentVelocity },
          { label: "Social signal decay rate", value: fusion.socialDecay },
          { label: "Cross-signal correlation", value: fusion.correlation },
        ].map((metric) => (
          <div key={metric.label} className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {metric.label}
            </p>
            <p className={cn("mt-1 text-xl font-semibold", LEVEL_STYLES[metric.value])}>
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex justify-center">
        <ArrowDown className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>

      <div
        className={cn(
          "flex items-center justify-center gap-2 rounded-lg border px-4 py-3",
          fusion.status === "EARLY WARNING"
            ? "border-destructive/30 bg-destructive/10"
            : fusion.status === "WATCH"
              ? "border-amber-500/30 bg-amber-500/10"
              : "border-emerald-500/30 bg-emerald-500/10"
        )}
      >
        <span
          className={cn(
            "size-2.5 rounded-full",
            fusion.status === "EARLY WARNING"
              ? "bg-destructive"
              : fusion.status === "WATCH"
                ? "bg-amber-500"
                : "bg-emerald-500"
          )}
        />
        <span className="text-sm font-semibold tracking-wide">{fusion.status}</span>
      </div>
    </div>
  )
}

export function RiskTrendIndicator({ level = 1 }) {
  const arrows = Array.from({ length: Math.min(level, 3) }, (_, index) => (
    <ArrowUpRight
      key={index}
      className={cn(
        "size-4",
        level >= 3 ? "text-destructive" : level >= 2 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
      )}
    />
  ))

  return <span className="inline-flex items-center gap-0.5">{arrows}</span>
}
