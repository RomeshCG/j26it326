import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ExternalLink } from "lucide-react"

import { BORROWERS } from "@/components/borrower-management/mock-data"
import AdaptiveExplanation from "@/components/risk-report/AdaptiveExplanation"
import AiRecommendationCard from "@/components/risk-report/AiRecommendationCard"
import RiskAssessmentHero from "@/components/risk-report/RiskAssessmentHero"
import ShapContributors from "@/components/risk-report/ShapContributors"
import { useOfficerExplanationStyle } from "@/components/risk-report/useOfficerExplanationStyle"
import { buildRiskReportFromApplication } from "@/components/risk-report/mock-data"
import { Button } from "@/components/ui/button"

function findBorrowerForApplication(application) {
  return BORROWERS.find(
    (borrower) =>
      borrower.applicationId === application.id || borrower.id === application.borrowerId
  )
}

export default function ApplicationRiskSection({ application }) {
  const navigate = useNavigate()
  const evidenceRef = useRef(null)
  const [adaptiveAction, setAdaptiveAction] = useState(null)
  const { styleId, setStyleId, trust } = useOfficerExplanationStyle()

  if (application.status !== "assessed") {
    return null
  }

  const borrower = findBorrowerForApplication(application)
  const report = buildRiskReportFromApplication(application, {
    product: borrower?.product ?? null,
  })

  function openFullReport(state = {}) {
    navigate("/loan-officer/risk-report", {
      state: {
        applicationId: application.id,
        applicant: report.applicant,
        riskScore: application.riskScore,
        product: borrower?.product ?? null,
        ...state,
      },
    })
  }

  function scrollToEvidence() {
    setAdaptiveAction("evidence")
    evidenceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-6 border-t border-border/50 pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Pre-completed assessment
          </p>
          <h2 className="text-xl font-semibold tracking-tight">Credit risk assessment</h2>
          <p className="text-sm text-muted-foreground">
            Review the personalised explanation without running a new assessment
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="cursor-pointer"
          onClick={() => openFullReport()}
        >
          <ExternalLink />
          Open full report
        </Button>
      </div>

      <RiskAssessmentHero report={report} />

      <div ref={evidenceRef}>
        <ShapContributors contributors={report.shapContributors} />
      </div>

      <AdaptiveExplanation
        report={report}
        styleId={styleId}
        onStyleChange={setStyleId}
        activeAction={adaptiveAction}
        onViewEvidence={scrollToEvidence}
        onAcceptRecommendation={() => openFullReport({ preselectDecision: "approve" })}
        onOverride={() => openFullReport({ preselectDecision: "reject" })}
      />

      <AiRecommendationCard report={report} trustStatus={trust.status} />
    </div>
  )
}
