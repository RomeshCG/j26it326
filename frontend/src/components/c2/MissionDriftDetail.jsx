import { Link } from "react-router-dom"
import { AlertTriangle, ArrowLeft } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { MISSION_DRIFT } from "./mock-data"

function MdiTrendChart({ series }) {
  const width = 360
  const height = 180
  const pad = 24
  const min = 50
  const max = 100
  const range = max - min

  const points = series.map((point, index) => {
    const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((point.value - min) / range) * (height - pad * 2)
    return { x, y, ...point }
  })

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ")

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full">
        {[50, 60, 70, 80, 90, 100].map((tick) => {
          const y = height - pad - ((tick - min) / range) * (height - pad * 2)
          return (
            <g key={tick}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} className="stroke-border" strokeWidth="1" />
              <text x={4} y={y + 4} className="fill-muted-foreground text-[10px]">
                {tick}
              </text>
            </g>
          )
        })}
        <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((point) => (
          <circle key={point.month} cx={point.x} cy={point.y} r="4" className="fill-primary" />
        ))}
      </svg>
      <div className="flex justify-between px-6 text-xs text-muted-foreground">
        {series.map((point) => (
          <span key={point.month}>{point.month}</span>
        ))}
      </div>
    </div>
  )
}

export default function MissionDriftDetail() {
  const detail = MISSION_DRIFT.detail

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <Button asChild variant="ghost" className="cursor-pointer">
        <Link to="/alerts">
          <ArrowLeft />
          Back to mission drift dashboard
        </Link>
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 2 · Mission drift detail
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Mission drift index detail</h1>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Mission drift index
          </CardDescription>
          <CardTitle className="text-base font-semibold">Historical trend</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <MdiTrendChart series={detail.historicalTrend} />
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Current assessment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Current MDI
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{detail.currentMdi}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Change velocity
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {detail.changeVelocity}
            </p>
            <p className="text-sm text-muted-foreground">{detail.velocityUnit}</p>
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
              Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              <Badge className="border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300">
                {detail.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Mission insight</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-foreground/90">{detail.insight}</p>
        </CardContent>
      </Card>
    </div>
  )
}
