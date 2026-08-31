import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Check, FileText, Loader2, X } from "lucide-react"

import { getApplication } from "@/components/application-profile/storage"
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

import RiskAssessmentHero from "./RiskAssessmentHero"
import ShapContributors from "./ShapContributors"
import ShapInteractionMatrix from "./ShapInteractionMatrix"
import {
  buildRiskReport,
  classificationMeta,
} from "./mock-data"

function formatReportDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function RiskReportPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const applicationState = location.state

  const linkedApplication = applicationState?.applicationId
    ? getApplication(applicationState.applicationId)
    : null

  const loanAmount =
    applicationState?.loanAmount ??
    linkedApplication?.form?.financeAmount ??
    linkedApplication?.form?.loanAmount ??
    undefined

  const report = buildRiskReport({
    ...applicationState,
    loanAmount,
    product: applicationState?.product ?? null,
  })

  const classMeta = classificationMeta(report.classification)

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
            Risk report
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
          variant="outline"
          onClick={() =>
            navigate(
              report.applicationId
                ? `/loan-officer/applications/${report.applicationId}`
                : "/loan-officer/borrowers"
            )
          }
          className="cursor-pointer"
        >
          <ArrowLeft />
          Back
        </Button>
      </div>

      <RiskAssessmentHero report={report} />

      <ShapContributors contributors={report.shapContributors} />

      <ShapInteractionMatrix />

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="size-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Assessment summary</CardTitle>
              <CardDescription className="mt-0.5">
                Notes prepared for {report.officerName}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <p className="text-sm leading-relaxed text-foreground/90">{report.narrative}</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Officer decision</CardTitle>
          <CardDescription>
            Review the assessment, then approve or reject this application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            <span className={`size-2 rounded-full ${classMeta.dotClass}`} />
            <span className="text-muted-foreground">Recommendation:</span>
            <span className="font-medium">{classMeta.label}</span>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums">{report.defaultProbability}% default risk</span>
          </div>

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
