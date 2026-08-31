import { useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft } from "lucide-react"

import { getApplication } from "@/components/application-profile/storage"
import { Button } from "@/components/ui/button"

import AdaptiveExplanation from "./AdaptiveExplanation"
import AiRecommendationCard from "./AiRecommendationCard"
import OfficerDecisionPanel from "./OfficerDecisionPanel"
import RiskAssessmentHero from "./RiskAssessmentHero"
import ShapContributors from "./ShapContributors"
import ShapInteractionMatrix from "./ShapInteractionMatrix"
import { useOfficerExplanationStyle } from "./useOfficerExplanationStyle"
import { buildRiskReport } from "./mock-data"
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

  const report = buildRiskReport({
    ...applicationState,
    loanAmount,
    product: applicationState?.product ?? null,
  })

  const { styleId, setStyleId, trust } = useOfficerExplanationStyle()

  const [decision, setDecision] = useState(
    () => applicationState?.preselectDecision ?? null
  )
  const [reasoning, setReasoning] = useState("")
  const [adaptiveAction, setAdaptiveAction] = useState(null)
  const evidenceRef = useRef(null)
  const decisionRef = useRef(null)

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
