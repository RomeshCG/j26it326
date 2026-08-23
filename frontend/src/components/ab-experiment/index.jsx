import { useEffect, useState } from "react"
import { Clock, FlaskConical, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

import AiReportPanel from "./AiReportPanel"
import TraditionalScoringPanel from "./TraditionalScoringPanel"
import { AB_EXPERIMENT_CASE } from "./mock-data"

function formatElapsed(seconds) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
}

function formatReportDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-LK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

const EMPTY_TRADITIONAL_FORM = {
  incomeAssessment: "",
  collateralCheck: "",
  characterAssessment: "",
  recommendedDecision: "",
}

export default function AbExperimentPage() {
  const experimentCase = AB_EXPERIMENT_CASE

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [groupADecision, setGroupADecision] = useState(null)
  const [groupAOverrideReason, setGroupAOverrideReason] = useState("")
  const [traditionalForm, setTraditionalForm] = useState(EMPTY_TRADITIONAL_FORM)
  const [groupARecorded, setGroupARecorded] = useState(false)
  const [groupBRecorded, setGroupBRecorded] = useState(false)
  const [recordingGroup, setRecordingGroup] = useState(null)

  useEffect(() => {
    const interval = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1)
    }, 1000)
    return () => window.clearInterval(interval)
  }, [])

  function updateTraditionalForm(field, value) {
    setTraditionalForm((current) => ({ ...current, [field]: value }))
    setGroupBRecorded(false)
  }

  function handleGroupADecision(next) {
    setGroupADecision(next)
    setGroupARecorded(false)
    if (next === "approve") setGroupAOverrideReason("")
  }

  const groupAReady =
    groupADecision === "approve" ||
    (groupADecision === "reject" && groupAOverrideReason.trim().length > 0)

  const groupBReady = Object.values(traditionalForm).every(Boolean)

  function recordDecision(group) {
    setRecordingGroup(group)
    window.setTimeout(() => {
      if (group === "A") setGroupARecorded(true)
      if (group === "B") setGroupBRecorded(true)
      setRecordingGroup(null)
    }, 600)
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <FlaskConical className="size-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Admin / research view
            </p>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Research Study — A/B Experiment View
          </h1>
          <p className="text-sm text-muted-foreground">
            Case {experimentCase.caseId} · {experimentCase.applicant.name} · NIC{" "}
            {experimentCase.applicant.nic} ·{" "}
            {formatReportDate(experimentCase.applicant.date)}
          </p>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          {experimentCase.studyArm}
        </Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-3">
          <div className="sticky top-0 z-10 rounded-lg border bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">
              Group A
            </p>
            <h2 className="text-base font-semibold">AI report</h2>
            <p className="text-xs text-muted-foreground">
              Full risk score report with SHAP, interactions, and GenAI narrative
            </p>
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <AiReportPanel
              report={experimentCase.report}
              decision={groupADecision}
              overrideReason={groupAOverrideReason}
              onDecision={handleGroupADecision}
              onOverrideReasonChange={(value) => {
                setGroupAOverrideReason(value)
                setGroupARecorded(false)
              }}
            />
          </div>
        </section>

        <section className="space-y-3">
          <div className="sticky top-0 z-10 rounded-lg border bg-muted/50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Group B
            </p>
            <h2 className="text-base font-semibold">Traditional scoring</h2>
            <p className="text-xs text-muted-foreground">
              Plain-text sheet with manual officer assessment fields
            </p>
          </div>
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto pr-1">
            <TraditionalScoringPanel
              caseData={experimentCase}
              form={traditionalForm}
              onChange={updateTraditionalForm}
            />
          </div>
        </section>
      </div>

      <Card className="rounded-xl border bg-card">
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <Clock className="size-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Time on case
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                {formatElapsed(elapsedSeconds)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              disabled={!groupAReady || recordingGroup !== null || groupARecorded}
              onClick={() => recordDecision("A")}
              className="cursor-pointer"
            >
              {recordingGroup === "A" ? <Loader2 className="animate-spin" /> : null}
              {groupARecorded ? "Group A recorded" : "Record decision — Group A"}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              disabled={!groupBReady || recordingGroup !== null || groupBRecorded}
              onClick={() => recordDecision("B")}
              className="cursor-pointer"
            >
              {recordingGroup === "B" ? <Loader2 className="animate-spin" /> : null}
              {groupBRecorded ? "Group B recorded" : "Record decision — Group B"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
