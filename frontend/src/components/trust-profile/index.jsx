import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import ExplanationStyleSelector from "@/components/risk-report/ExplanationStyleSelector"
import { listDecisionLogs } from "@/components/risk-report/decision-log"
import { useOfficerExplanationStyle } from "@/components/risk-report/useOfficerExplanationStyle"

import CalibrationLineChart from "./CalibrationLineChart"
import { TRUST_PROFILE } from "./mock-data"

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function TrustProfilePage() {
  const profile = TRUST_PROFILE
  const { styleId, setStyleId, trust } = useOfficerExplanationStyle()
  const decisionLogs = listDecisionLogs().slice(0, 5)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Officer calibration
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            My Trust Calibration Profile
          </h1>
          <p className="text-sm text-muted-foreground">
            Based on your last {profile.totalDecisions} risk-report decisions
          </p>
        </div>
        <Badge className={`px-3 py-1.5 text-sm font-semibold ${trust.statusClassName}`}>
          {trust.statusLabel}
        </Badge>
      </div>

      <ExplanationStyleSelector styleId={styleId} onStyleChange={setStyleId} />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total decisions
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">
            {profile.totalDecisions}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Last window</p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Over-reliance rate
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-red-600 dark:text-red-400">
            {profile.overRelianceRate}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Followed AI when outcome was wrong
          </p>
        </Card>
        <Card className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Under-reliance rate
          </p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-blue-600 dark:text-blue-400">
            {profile.underRelianceRate}%
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Overrode AI when outcome was right
          </p>
        </Card>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            Calibration trend
          </CardTitle>
          <CardDescription>
            Over-reliance and under-reliance rates across Decision 1–20
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <CalibrationLineChart
            series={profile.calibrationSeries}
            threshold={profile.threshold}
          />
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">What this means</CardTitle>
          <CardDescription>
            How your recent decisions affect explanation style
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-foreground/90">
            {profile.explanation}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            Recent decisions
          </CardTitle>
          <CardDescription>
            Last 10 decisions — highlighted rows show officer/AI disagreement
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium">AI recommendation</th>
                <th className="px-4 py-3 font-medium">Your decision</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Match?</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentDecisions.map((row) => {
                const disagreed = !row.match
                return (
                  <tr
                    key={row.id}
                    className={`border-b last:border-b-0 ${
                      disagreed
                        ? "bg-amber-500/10"
                        : "bg-transparent"
                    }`}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(row.date)}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.applicant}</td>
                    <td className="px-4 py-3">{row.aiRecommendation}</td>
                    <td className="px-4 py-3">{row.officerDecision}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          row.outcome === "Correct" ? "secondary" : "destructive"
                        }
                      >
                        {row.outcome}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {row.match ? (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          Yes
                        </span>
                      ) : (
                        <span className="font-medium text-amber-700 dark:text-amber-300">
                          No
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {decisionLogs.length > 0 ? (
        <Card className="rounded-xl border bg-card">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="text-base font-semibold">Recorded decisions</CardTitle>
            <CardDescription>
              AI-assisted decisions saved for the research experiment
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Applicant</th>
                  <th className="px-4 py-3 font-medium">AI recommendation</th>
                  <th className="px-4 py-3 font-medium">Officer decision</th>
                  <th className="px-4 py-3 font-medium">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {decisionLogs.map((row) => (
                  <tr key={row.id} className="border-b last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.applicantName}</td>
                    <td className="px-4 py-3">{row.aiRecommendation}</td>
                    <td className="px-4 py-3">{row.officerDecision}</td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">
                      {row.officerReasoning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
