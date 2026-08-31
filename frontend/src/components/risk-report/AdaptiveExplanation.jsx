import { useState } from "react"
import { AlertTriangle, Check, Eye } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { getAdaptiveExplanation, getOfficerTrustSnapshot } from "./adaptive-explanation"
import ExplanationStyleSelector from "./ExplanationStyleSelector"
import {
  getExplanationStyleId,
  setExplanationStyleId,
} from "./officer-profile-style"

function renderLead(text) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

export default function AdaptiveExplanation({
  report,
  onViewEvidence,
  onAcceptRecommendation,
  onOverride,
  activeAction,
  showStyleSelector = true,
  styleId: controlledStyleId,
  onStyleChange,
}) {
  const [internalStyleId, setInternalStyleId] = useState(() => getExplanationStyleId())
  const styleId = controlledStyleId ?? internalStyleId
  const trust = getOfficerTrustSnapshot(styleId)
  const explanation = getAdaptiveExplanation(report, trust)

  function handleStyleChange(nextStyleId) {
    setExplanationStyleId(nextStyleId)
    onStyleChange?.(nextStyleId)
    if (controlledStyleId == null) {
      setInternalStyleId(nextStyleId)
    }
  }

  return (
    <div className="space-y-4">
      {showStyleSelector ? (
        <ExplanationStyleSelector styleId={styleId} onStyleChange={handleStyleChange} />
      ) : null}

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Officer trust profile</CardTitle>
          <CardDescription>
            Used to personalise how this assessment is presented to you
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Historical decisions
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {trust.historicalDecisions}
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Recommendations followed
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {trust.aiFollowRate}%
            </p>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Over-reliance tendency
            </p>
            <div className="mt-2 flex items-center gap-2">
              <Badge className={trust.statusClassName}>{trust.statusLabel}</Badge>
              {trust.status === "OVER-RELIANT" ? (
                <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card
        className={`rounded-xl border bg-card shadow-sm ${
          explanation.mode === "caution" ? "border-amber-500/40" : ""
        }`}
      >
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardDescription className="text-xs uppercase tracking-wide">
                Personalised explanation · {report.officerName}
              </CardDescription>
              <CardTitle className="mt-1 flex items-center gap-2 text-base font-semibold">
                {explanation.mode === "caution" ? (
                  <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
                ) : null}
                {explanation.headline}
              </CardTitle>
            </div>
            {explanation.mode !== "standard" ? (
              <Badge className="border-transparent bg-primary/10 text-primary">
                Adapted · {trust.explanationStyle.label}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <p className="text-sm leading-relaxed text-foreground/90">
            {renderLead(explanation.lead)}
          </p>
          <p className="text-sm leading-relaxed font-medium text-foreground">
            {explanation.emphasis}
          </p>

          {explanation.uncertainty ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Key uncertainty
              </p>
              <p className="mt-1 text-sm">{explanation.uncertainty}</p>
            </div>
          ) : null}

          {explanation.verifyItems.length > 0 ? (
            <div>
              <p className="text-sm font-medium">Consider verifying</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted-foreground">
                {explanation.verifyItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-border/50 pt-4">
            <Button
              type="button"
              variant="outline"
              className={`cursor-pointer ${activeAction === "evidence" ? "ring-2 ring-primary/30" : ""}`}
              onClick={onViewEvidence}
            >
              <Eye />
              View evidence
            </Button>
            <Button
              type="button"
              variant="secondary"
              className={`cursor-pointer ${activeAction === "accept" ? "ring-2 ring-primary/30" : ""}`}
              onClick={onAcceptRecommendation}
            >
              <Check />
              Accept recommendation
            </Button>
            <Button
              type="button"
              variant="outline"
              className={`cursor-pointer ${activeAction === "override" ? "ring-2 ring-primary/30" : ""}`}
              onClick={onOverride}
            >
              Override
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { getOfficerTrustSnapshot } from "./adaptive-explanation"
export { getExplanationStyleId } from "./officer-profile-style"
