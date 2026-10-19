import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { getApplication } from "@/components/application-profile/storage"
import { Button } from "@/components/ui/button"
import { assessRisk } from "@/lib/api"

import AdaptiveExplanation from "./AdaptiveExplanation"
import AiRecommendationCard from "./AiRecommendationCard"
import PlainEnglishExplanation from "./PlainEnglishExplanation"
import OfficerDecisionPanel from "./OfficerDecisionPanel"
import RiskAssessmentHero from "./RiskAssessmentHero"
import ShapContributors from "./ShapContributors"
import ShapInteractionMatrix from "./ShapInteractionMatrix"
import { useOfficerExplanationStyle } from "./useOfficerExplanationStyle"
import { buildRiskReport } from "./mock-data"
import { buildAssessFeatures, mapAssessResponseToReport } from "./map-api-report"
import { buildDisbursementApplication } from "@/components/c3/build-disbursement-application"

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

  const reportContext = {
    ...applicationState,
    loanAmount,
    product: applicationState?.product ?? null,
    applicant: applicationState?.applicant ?? {
      name: linkedApplication?.form?.fullName || "Applicant",
      nic: linkedApplication?.form?.nic || "—",
      date: linkedApplication?.form?.applicationDate || new Date().toISOString().slice(0, 10),
    },
    applicationId: applicationState?.applicationId ?? linkedApplication?.id ?? null,
  }

  const [report, setReport] = useState(() => buildRiskReport(reportContext))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [usedFallback, setUsedFallback] = useState(false)

  const { styleId, setStyleId, trust } = useOfficerExplanationStyle()

  const [decision, setDecision] = useState(
    () => applicationState?.preselectDecision ?? null
  )
  const [reasoning, setReasoning] = useState("")
  const [adaptiveAction, setAdaptiveAction] = useState(null)
  const evidenceRef = useRef(null)
  const decisionRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function runAssess() {
      setLoading(true)
      setError(null)
      setUsedFallback(false)

      const { features, assumed } = buildAssessFeatures(reportContext)
      // Persist needs a UUID; demo APP- ids are not UUIDs — use a fresh one for the assessment row.
      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      const loanApplicationId = uuidRe.test(reportContext.applicationId || "")
        ? reportContext.applicationId
        : crypto.randomUUID()

      try {
        let api
        try {
          api = await assessRisk({
            features,
            persist: true,
            loanApplicationId,
          })
        } catch {
          // Score still works without DB persist (e.g. demo UUID / DB hiccup).
          api = await assessRisk({ features, persist: false })
        }
        if (cancelled) return
        setReport(mapAssessResponseToReport(api, reportContext, assumed))
      } catch (err) {
        if (cancelled) return
        setError(err?.message || "Risk API unavailable")
        setUsedFallback(true)
        setReport(buildRiskReport(reportContext))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    runAssess()
    return () => {
      cancelled = true
    }
    // Re-run when navigating to a different application
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationState?.applicationId, loanAmount])

  function scrollToEvidence() {
    setAdaptiveAction("evidence")
    evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleAcceptRecommendation() {
    setAdaptiveAction("accept")
    setDecision("approve")
    decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleOverrideFromExplanation() {
    setAdaptiveAction("override")
    setDecision("reject")
    decisionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  function handleProceedToDisbursement() {
    navigate("/loan-officer/disbursement", {
      state: {
        application: buildDisbursementApplication(report, linkedApplication),
      },
    })
  }

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
            {report.modelVersion ? ` · ${report.modelVersion}` : null}
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

      {loading ? (
        <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Scoring with M1 risk API…
        </div>
      ) : null}

      {error && usedFallback ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Live API unavailable ({error}). Showing offline mock report. Log in with a real
          JWT, keep the backend on port 4000 and the M1 model service on port 8001.
        </div>
      ) : null}

      {!loading && !usedFallback ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs text-emerald-800 dark:text-emerald-200">
          Live score from POST /api/risk/assess
          {report.recommendation ? ` · recommendation: ${report.recommendation}` : ""}
        </div>
      ) : null}

      {!loading && !usedFallback && report.assumedFields?.length ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          Not provided by the application, typical demo values used for:{" "}
          {report.assumedFields.join(", ").replace(/_/g, " ")}.
        </div>
      ) : null}

      {!loading && !usedFallback && report.unseenCategories?.length ? (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          The model has not seen this {report.unseenCategories.join(", ").replace(/_/g, " ")} before, so
          the score is less reliable.
        </div>
      ) : null}

      {!loading && !usedFallback ? (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-2 text-xs text-sky-800 dark:text-sky-200">
          Prototype (v2): scored from loan terms, branch and product only. Borrower details
          (income, debts, occupation) are collected but not yet scored; they join in v3 once the
          expert's numbers are verified.
        </div>
      ) : null}

      <RiskAssessmentHero report={report} />

      <PlainEnglishExplanation report={report} />

      <div ref={evidenceRef}>
        <ShapContributors contributors={report.shapContributors} />
      </div>

      <ShapInteractionMatrix />

      <AdaptiveExplanation
        report={report}
        styleId={styleId}
        onStyleChange={setStyleId}
        activeAction={adaptiveAction}
        onViewEvidence={scrollToEvidence}
        onAcceptRecommendation={handleAcceptRecommendation}
        onOverride={handleOverrideFromExplanation}
      />

      <AiRecommendationCard report={report} trustStatus={trust.status} />

      <div ref={decisionRef}>
        <OfficerDecisionPanel
          report={report}
          trustStatus={trust.status}
          decision={decision}
          onDecisionChange={setDecision}
          reasoning={reasoning}
          onReasoningChange={setReasoning}
          preselectDecision={applicationState?.preselectDecision}
          onProceedToDisbursement={
            report.applicationId ? handleProceedToDisbursement : undefined
          }
        />
      </div>
    </div>
  )
}
