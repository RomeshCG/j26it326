import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { fetchLatestMdi, fetchMdiHistory } from "@/lib/m2-api"
import { MISSION_DRIFT } from "./mock-data"

function MdiTrendChart({ series, threshold = 20 }) {
  const width = 460
  const height = 200
  const pad = 30
  const min = -10
  const max = 40
  const range = max - min

  const points = series.map((point, index) => {
    const x = pad + (index / Math.max(series.length - 1, 1)) * (width - pad * 2)
    const y = height - pad - ((point.value - min) / range) * (height - pad * 2)
    return { x, y, ...point }
  })

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
    .join(" ")

  const threshY = height - pad - ((threshold - min) / range) * (height - pad * 2)

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full">
        {[-10, 0, 10, 20, 30, 40].map((tick) => {
          const y = height - pad - ((tick - min) / range) * (height - pad * 2)
          return (
            <g key={tick}>
              <line x1={pad} y1={y} x2={width - pad} y2={y} className="stroke-border" strokeWidth="1" strokeDasharray={tick === 0 ? "none" : "2 2"} />
              <text x={6} y={y + 4} className="fill-muted-foreground text-[10px]">
                {tick}
              </text>
            </g>
          )
        })}

        {/* Threshold indicator line */}
        <line x1={pad} y1={threshY} x2={width - pad} y2={threshY} className="stroke-destructive/70" strokeWidth="1.5" strokeDasharray="4 4" />
        <text x={width - pad - 60} y={threshY - 6} className="fill-destructive text-[10px] font-semibold">
          Threshold (20)
        </text>

        <path d={path} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" />
        {points.map((point) => (
          <circle key={point.month} cx={point.x} cy={point.y} r="4" className={point.value > threshold ? "fill-destructive" : "fill-primary"} />
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
  const [latest, setLatest] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    try {
      setLoading(true)
      const [latestRes, historyRes] = await Promise.all([
        fetchLatestMdi().catch(() => null),
        fetchMdiHistory().catch(() => null),
      ])

      if (latestRes) setLatest(latestRes)
      if (historyRes?.scores) {
        const trend = historyRes.scores.map((s) => ({
          month: s.period.slice(0, 7),
          value: s.mdi,
          state: s.state,
        }))
        setHistory(trend)
      }
    } catch (err) {
      console.warn("Failed to load live MDI detail:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const currentMdi = latest?.mdi ?? MISSION_DRIFT.detail.currentMdi
  const isAlert = latest ? latest.state === "alert" : false
  const velocity = latest?.changeVelocity !== null && latest?.changeVelocity !== undefined ? latest.changeVelocity : MISSION_DRIFT.detail.changeVelocity
  const trends = latest?.contributingTrends || []

  const chartSeries = history.length > 0 ? history : MISSION_DRIFT.detail.historicalTrend

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8">
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" className="cursor-pointer">
          <Link to="/mission-drift">
            <ArrowLeft className="mr-1 size-4" />
            Back to mission drift dashboard
          </Link>
        </Button>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="gap-2">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 2 · Mission drift detail
        </p>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Mission drift index detail</h1>
          {latest && (
            <Badge variant="outline" className="text-xs">
              {latest.dataSource === "synthetic" ? "Synthetic demo scenario" : latest.dataSource}
            </Badge>
          )}
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardDescription className="text-xs uppercase tracking-wide">
            Mission drift index
          </CardDescription>
          <CardTitle className="text-base font-semibold">Historical trend (Higher = More Drift)</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <MdiTrendChart series={chartSeries} threshold={20} />
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
            <p className="mt-1 text-3xl font-semibold tabular-nums">{currentMdi}</p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Change velocity
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">
              {velocity > 0 ? "+" : ""}{velocity}
            </p>
            <p className="text-sm text-muted-foreground">points/month</p>
          </div>
          <div className={`rounded-lg border p-4 ${
            isAlert ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"
          }`}>
            <p className={`text-xs font-medium uppercase tracking-wide ${
              isAlert ? "text-amber-800 dark:text-amber-300" : "text-emerald-800 dark:text-emerald-300"
            }`}>
              Status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <AlertTriangle className={`size-4 ${isAlert ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}`} />
              <Badge className={isAlert ? "border-transparent bg-amber-500/15 text-amber-800 dark:text-amber-300" : "border-transparent bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"}>
                {isAlert ? "Drift Alert (> 20)" : "Normal"}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Contributing Factors to Mission Drift</CardTitle>
          <CardDescription>Relative movement of target population indicators against baseline</CardDescription>
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          {trends.length > 0 ? (
            <div className="space-y-2">
              {trends.map((t) => (
                <div key={t.indicator} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <div>
                    <span className="font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      (weight: {Math.round(t.weight * 100)}%)
                    </span>
                  </div>
                  <div className="text-right">
                    <span className={`font-semibold ${t.contribution > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {t.relativeChange > 0 ? "+" : ""}{(t.relativeChange * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      contribution: +{t.contribution.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/90">{MISSION_DRIFT.detail.insight}</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
