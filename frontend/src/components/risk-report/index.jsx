import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Check, Loader2, X } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import RiskScoreGauge from "./RiskScoreGauge"
import ShapFactorChart from "./ShapFactorChart"
import {
  RISK_REPORT,
  NARRATIVE_STYLES,
  classificationMeta,
} from "./mock-data"

const INTERACTION_STYLES = {
  COMPENSATORY: {
    className:
      "border-transparent bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  COMPOUNDING: {
    className:
      "border-transparent bg-destructive/15 text-destructive",
  },
  INDEPENDENT: {
    className:
      "border-transparent bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
}

function formatReportDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function RiskReportPage() {
  const navigate = useNavigate()
  const report = RISK_REPORT
  const classMeta = classificationMeta(report.classification)
  const narrativeStyle = NARRATIVE_STYLES[report.narrativeStyle]

  const [decision, setDecision] = useState(null)
  const [overrideReason, setOverrideReason] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleDecision(next) {
    setDecision(next)
    setSubmitted(false)
    if (next === "approve") setOverrideReason("")
  }

  function handleSubmit() {
    if (!decision) return
    if (decision === "reject" && !overrideReason.trim()) return

    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 700)
  }

  const canSubmit =
    decision === "approve" ||
    (decision === "reject" && overrideReason.trim().length > 0)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Risk assessment · Report
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {report.applicant.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            NIC {report.applicant.nic} · {formatReportDate(report.applicant.date)}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/loan-officer")}
          className="cursor-pointer"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Risk score</CardTitle>
            <CardDescription>Model score on a 0–100 scale</CardDescription>
          </CardHeader>
          <CardContent>
            <RiskScoreGauge score={report.riskScore} color={classMeta.gaugeColor} />
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Default probability
            </CardTitle>
            <CardDescription>Estimated likelihood of default</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center py-6">
            <p className="text-5xl font-semibold tracking-tight tabular-nums">
              {report.defaultProbability.toFixed(1)}
              <span className="text-2xl text-muted-foreground">%</span>
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-xl border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              Risk classification
            </CardTitle>
            <CardDescription>Band assigned from the risk score</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-6">
            <Badge className={`px-4 py-1.5 text-sm font-semibold ${classMeta.className}`}>
              {classMeta.label}
            </Badge>
            <p className="text-center text-sm text-muted-foreground">
              {classMeta.label === "LOW" && "Low expected credit risk"}
              {classMeta.label === "MEDIUM" && "Requires officer judgment"}
              {classMeta.label === "HIGH" && "Elevated expected credit risk"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            SHAP individual factors
          </CardTitle>
          <CardDescription>
            Top 5 features driving this applicant&apos;s risk score
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ShapFactorChart factors={report.shapFactors} />
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            SHAP interaction panel
          </h2>
          <p className="text-sm text-muted-foreground">
            Top feature-pair effects for this decision
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {report.interactions.map((item) => (
            <Card key={item.id} className="rounded-xl border bg-card">
              <CardHeader className="space-y-3">
                <Badge
                  className={
                    INTERACTION_STYLES[item.label]?.className ??
                    "border-transparent bg-muted text-muted-foreground"
                  }
                >
                  {item.label}
                </Badge>
                <CardTitle className="text-base font-semibold leading-snug">
                  {item.pair}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {item.text}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                GenAI narrative
              </p>
              <CardTitle className="text-base font-semibold">
                Explanation for: {report.officerName}
              </CardTitle>
            </div>
            <Badge className={narrativeStyle.className}>
              Style: {narrativeStyle.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-foreground/90">
            {report.narrative}
          </p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Decision</CardTitle>
          <CardDescription>
            Approve or reject this application, then submit your decision
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => handleDecision("approve")}
              className={`cursor-pointer border-transparent ${
                decision === "approve"
                  ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                  : "bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300"
              }`}
            >
              <Check />
              Approve
            </Button>
            <Button
              type="button"
              size="lg"
              variant="destructive"
              onClick={() => handleDecision("reject")}
              className={`cursor-pointer ${
                decision === "reject" ? "ring-2 ring-destructive/40" : ""
              }`}
            >
              <X />
              Reject
            </Button>
          </div>

          {decision === "reject" ? (
            <div className="space-y-2">
              <Label htmlFor="override-reason">Override reason</Label>
              <Textarea
                id="override-reason"
                value={overrideReason}
                onChange={(event) => {
                  setOverrideReason(event.target.value)
                  setSubmitted(false)
                }}
                placeholder="Explain why you are rejecting this application…"
                rows={4}
              />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={!canSubmit || submitting || submitted}
              onClick={handleSubmit}
              className="cursor-pointer"
            >
              {submitting ? <Loader2 className="animate-spin" /> : null}
              {submitted ? "Decision submitted" : "Submit decision"}
            </Button>
            {submitted ? (
              <p className="text-sm text-muted-foreground">
                Recorded as{" "}
                <span className="font-medium text-foreground">
                  {decision === "approve" ? "Approved" : "Rejected"}
                </span>
                .
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
