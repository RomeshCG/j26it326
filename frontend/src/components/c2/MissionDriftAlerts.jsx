import { useState, useEffect } from "react"
import { AlertTriangle, CheckCircle, Clock, ArrowLeft, RefreshCw } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchMissionDriftAlerts, updateAlertStatus } from "@/lib/m2-api"

export default function MissionDriftAlerts() {
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingId, setUpdatingId] = useState(null)

  const loadAlerts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await fetchMissionDriftAlerts()
      setAlerts(data.alerts || [])
    } catch (err) {
      console.error("Failed to load alerts:", err)
      setError(err.message || "Failed to load alerts")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAlerts()
  }, [])

  const handleStatusChange = async (alertId, newStatus) => {
    try {
      setUpdatingId(alertId)
      await updateAlertStatus(alertId, newStatus)
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: newStatus } : a))
      )
    } catch (err) {
      alert("Failed to update alert: " + (err.message || "Unknown error"))
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 cursor-pointer text-muted-foreground">
            <Link to="/alerts">
              <ArrowLeft className="mr-1 size-4" />
              Back to Mission Drift Dashboard
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Mission Drift Alerts</h1>
            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30">
              Component 2
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Early detection and evidence tracking of commercial vs. social mission divergence
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadAlerts} disabled={loading} className="gap-2">
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Error loading live alerts: {error}. Make sure backend is running on port 4000 and logged in.
        </div>
      )}

      {loading ? (
        <Card className="rounded-xl border bg-card p-12 text-center text-muted-foreground">
          Loading alerts from backend...
        </Card>
      ) : alerts.length === 0 ? (
        <Card className="rounded-xl border bg-card p-12 text-center">
          <CheckCircle className="mx-auto size-12 text-emerald-500 mb-3" />
          <h3 className="text-lg font-medium">No Active Mission Drift Alerts</h3>
          <p className="text-sm text-muted-foreground mt-1">
            All social indicator trends are within normal threshold parameters.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {alerts.map((alertItem) => {
            const score = alertItem.score
            const trends = score?.contributingTrends || []
            const isAlert = score?.state === "alert"

            return (
              <Card key={alertItem.id} className="rounded-xl border border-amber-500/30 bg-card shadow-sm">
                <CardHeader className="border-b border-border/50 pb-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="size-5 text-amber-600 dark:text-amber-400" />
                        <CardTitle className="text-base font-semibold">
                          Mission Drift Alert · {score?.period}
                        </CardTitle>
                        <Badge
                          variant={alertItem.status === "new" ? "destructive" : "secondary"}
                          className="capitalize"
                        >
                          {alertItem.status}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {score?.dataSource === "synthetic" ? "Synthetic demo scenario" : score?.dataSource}
                        </Badge>
                      </div>
                      <CardDescription className="text-sm">
                        {alertItem.narrative}
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-2">
                      {alertItem.status === "new" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === alertItem.id}
                          onClick={() => handleStatusChange(alertItem.id, "acknowledged")}
                        >
                          Acknowledge
                        </Button>
                      )}
                      {alertItem.status !== "resolved" && (
                        <Button
                          size="sm"
                          disabled={updatingId === alertItem.id}
                          onClick={() => handleStatusChange(alertItem.id, "resolved")}
                        >
                          Mark Resolved
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                      Grounded Evidence & Contributing Trends (MDI Score: {score?.mdi})
                    </h4>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      {trends.map((trend) => {
                        const isAdverse = trend.contribution > 0
                        return (
                          <div
                            key={trend.indicator}
                            className={`rounded-lg border p-3 text-xs space-y-1 ${
                              isAdverse
                                ? "border-amber-500/30 bg-amber-500/5 dark:bg-amber-950/10"
                                : "border-border/50 bg-muted/20"
                            }`}
                          >
                            <p className="font-medium text-foreground">{trend.label}</p>
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Baseline: {(trend.baseline * 100).toFixed(1)}%</span>
                              <span>Current: {(trend.current * 100).toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-border/40 font-semibold">
                              <span className={isAdverse ? "text-amber-600 dark:text-amber-400" : "text-emerald-600"}>
                                {trend.relativeChange > 0 ? "+" : ""}
                                {(trend.relativeChange * 100).toFixed(1)}% relative
                              </span>
                              <span className="text-muted-foreground">
                                Contribution: +{trend.contribution.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3.5" />
                      Detected on {new Date(alertItem.createdAt).toLocaleString()}
                    </span>
                    <Button asChild variant="link" size="sm" className="h-auto p-0">
                      <Link to="/mission-drift/detail">View full MDI calculation breakdown →</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
