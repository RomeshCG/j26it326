import { useState } from "react"
import { Banknote, Check, ClipboardCheck, Loader2, X } from "lucide-react"

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

import { saveRiskDecision } from "@/lib/api"

import { recordDecision } from "./decision-log"
import { getAiRecommendation } from "./mock-data"

const DECISION_LABELS = {
  approve: "APPROVE",
  reject: "REJECT",
  "request-review": "REQUEST REVIEW",
}

/** Map UI choice to API accept/override relative to the model's recommendation. */
function toApiDecision(officerDecision, apiRecommendation) {
  const ai = String(apiRecommendation || "").toLowerCase()
  const agrees =
    (officerDecision === "approve" && ai === "approve") ||
    (officerDecision === "reject" && ai === "reject") ||
    (officerDecision === "request-review" && ai === "review")
  return agrees ? "accept" : "override"
}

export default function OfficerDecisionPanel({
  report,
  trustStatus,
  decision,
  onDecisionChange,
  reasoning,
  onReasoningChange,
  preselectDecision,
  onProceedToDisbursement,
}) {
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [recordId, setRecordId] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  const [savedViaApi, setSavedViaApi] = useState(false)

  const recommendation = getAiRecommendation(report, trustStatus)
  const effectiveDecision = decision ?? preselectDecision ?? null

  function selectDecision(next) {
    onDecisionChange(next)
    setSubmitted(false)
    setRecordId(null)
    setSubmitError(null)
    setSavedViaApi(false)
  }

  async function handleSubmit() {
    if (!effectiveDecision || !reasoning.trim()) return

    setSubmitting(true)
    setSubmitError(null)

    const localRecord = recordDecision({
      applicationId: report.applicationId,
      applicantName: report.applicant.name,
      applicantNic: report.applicant.nic,
      aiRecommendation: recommendation.recommendation,
      aiRisk: recommendation.risk,
      aiConfidence: recommendation.confidence,
      officerDecision: DECISION_LABELS[effectiveDecision],
      officerReasoning: reasoning.trim(),
      explanationStyle: trustStatus,
      matchedAi:
        (effectiveDecision === "approve" && recommendation.recommendation === "APPROVE") ||
        (effectiveDecision === "reject" && recommendation.recommendation === "REJECT") ||
        (effectiveDecision === "request-review" && recommendation.recommendation.startsWith("REVIEW")),
    })

    try {
      if (report.assessmentId) {
        const apiDecision = toApiDecision(effectiveDecision, report.recommendation)
        const api = await saveRiskDecision({
          assessmentId: report.assessmentId,
          decision: apiDecision,
          reasoning: reasoning.trim(),
          explanationMode: trustStatus || undefined,
        })
        setRecordId(api.decisionId || localRecord.id)
        setSavedViaApi(true)
      } else {
        setRecordId(localRecord.id)
        setSavedViaApi(false)
        setSubmitError(
          "Live assessment was not persisted (no assessmentId). Decision saved locally only."
        )
      }
      setSubmitted(true)
    } catch (err) {
      setRecordId(localRecord.id)
      setSavedViaApi(false)
      setSubmitError(err?.message || "API save failed; kept a local research log copy.")
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = Boolean(effectiveDecision && reasoning.trim())

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">
          AI recommendation + human decision
        </CardTitle>
        <CardDescription>
          Record your decision and reasoning for the research experiment
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-5">
        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => selectDecision("approve")}
            className={`cursor-pointer border-transparent ${
              effectiveDecision === "approve"
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
            onClick={() => selectDecision("reject")}
            className={`cursor-pointer ${
              effectiveDecision === "reject" ? "ring-2 ring-destructive/40" : ""
            }`}
          >
            <X />
            Reject
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => selectDecision("request-review")}
            className={`cursor-pointer ${
              effectiveDecision === "request-review" ? "ring-2 ring-primary/30" : ""
            }`}
          >
            <ClipboardCheck />
            Request review
          </Button>
        </div>

        {effectiveDecision ? (
          <div className="rounded-lg border bg-muted/30 px-4 py-3">
            <p className="text-sm">
              <span className="text-muted-foreground">Decision:</span>{" "}
              <span className="font-semibold">{DECISION_LABELS[effectiveDecision]}</span>
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="officer-reasoning">Officer reasoning</Label>
          <Textarea
            id="officer-reasoning"
            value={reasoning}
            onChange={(event) => {
              onReasoningChange(event.target.value)
              setSubmitted(false)
              setRecordId(null)
              setSubmitError(null)
              setSavedViaApi(false)
            }}
            placeholder="Explain your decision — required for research recording…"
            rows={4}
          />
        </div>

        {submitError ? (
          <p className="text-sm text-amber-800 dark:text-amber-200">{submitError}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-border/50 pt-4">
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
            <div className="flex w-full flex-wrap items-center gap-3">
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Recorded as{" "}
                  <span className="font-medium text-foreground">
                    {DECISION_LABELS[effectiveDecision]}
                  </span>{" "}
                  · {savedViaApi ? "saved to decision_log" : "local research log"}
                </p>
                {recordId ? (
                  <p>
                    Log ID: <Badge variant="secondary">{recordId}</Badge>
                  </p>
                ) : null}
              </div>
              {effectiveDecision === "approve" && onProceedToDisbursement ? (
                <Button
                  type="button"
                  size="lg"
                  className="ml-auto cursor-pointer"
                  onClick={onProceedToDisbursement}
                >
                  <Banknote />
                  Proceed to disbursement
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
