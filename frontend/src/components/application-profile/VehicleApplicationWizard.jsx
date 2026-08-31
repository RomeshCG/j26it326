import { useMemo, useState } from "react"
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Save } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useStore } from "@/store"

import {
  getAuthBranch,
  getAuthRole,
  getBranchContext,
  getEffectiveBranch,
  hydrateFormBranch,
  isBranchOverridePending,
} from "./branch-context"
import { ensureApplicationIdentifiers } from "./identifiers"
import { createAndSaveApplication, getApplication, saveApplication } from "./storage"
import { computeVehicleRiskScore, computeVehicleSummary } from "./vehicle/calculations"
import { VEHICLE_WIZARD_STEPS } from "./vehicle/constants"
import { validateVehicleStep } from "./vehicle/validation"
import StepGuarantor2Declaration from "./vehicle/steps/StepGuarantor2Declaration"
import StepVehicleAssetGuarantor from "./vehicle/steps/StepVehicleAssetGuarantor"
import StepVehicleGeneral from "./vehicle/steps/StepVehicleGeneral"
import StepVehicleIncome from "./vehicle/steps/StepVehicleIncome"
import StepVehicleReview from "./vehicle/steps/StepVehicleReview"

export default function VehicleApplicationWizard() {
  const navigate = useNavigate()
  const { applicationId, loanType } = useParams()
  const branches = useStore((state) => state.branches)
  const role = useStore((state) => state.currentUser?.role) || getAuthRole()
  const userBranch = useStore((state) => state.currentUser?.branch) || getAuthBranch()

  const branchContext = useMemo(
    () => getBranchContext(role, userBranch, branches),
    [role, userBranch, branches]
  )

  const [application, setApplication] = useState(() => {
    const ctx = getBranchContext(
      useStore.getState().currentUser?.role || getAuthRole(),
      useStore.getState().currentUser?.branch || getAuthBranch(),
      useStore.getState().branches || []
    )

    if (loanType) {
      const app = createAndSaveApplication(loanType, "individual")
      let form = hydrateFormBranch(app.form, ctx)
      if (ctx.mode === "select" && !form.branch && ctx.branchOptions[0]) {
        form.branch = ctx.branchOptions[0]
      }
      form = ensureApplicationIdentifiers(
        form,
        form.branch || form.assignedBranch || ctx.assignedBranch,
        { includeProductCode: true }
      )
      return saveApplication({ ...app, form })
    }

    const existing = getApplication(applicationId)
    if (!existing) return null
    let form = hydrateFormBranch(existing.form, ctx)
    form = ensureApplicationIdentifiers(
      form,
      getEffectiveBranch(form) || form.branch || ctx.assignedBranch,
      { includeProductCode: true }
    )
    return { ...existing, form }
  })

  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [savedNotice, setSavedNotice] = useState("")

  if (!application) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">Application not found.</p>
        <Button className="mt-4 cursor-pointer" onClick={() => navigate("/loan-officer/borrowers")}>
          Back to borrowers
        </Button>
      </div>
    )
  }

  const step = application.currentStep
  const form = application.form
  const summary = computeVehicleSummary(form)

  function persist(nextApplication) {
    const saved = saveApplication(nextApplication)
    setApplication(saved)
    return saved
  }

  function updateForm(nextForm) {
    setApplication((current) => ({ ...current, form: nextForm }))
    setSavedNotice("")
  }

  function handleSaveDraft() {
    setSaving(true)
    persist({ ...application, status: "draft" })
    window.setTimeout(() => {
      setSaving(false)
      setSavedNotice("Draft saved")
    }, 400)
  }

  function goToStep(nextStep) {
    persist({ ...application, currentStep: nextStep })
    setErrors({})
    setSavedNotice("")
  }

  function handleNext() {
    const nextErrors = validateVehicleStep(step, form, branchContext)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    handleSaveDraft()
    if (step < VEHICLE_WIZARD_STEPS.length) {
      goToStep(step + 1)
    }
  }

  function handleBack() {
    if (step === 1) {
      navigate("/loan-officer/applications/new")
      return
    }
    handleSaveDraft()
    goToStep(step - 1)
  }

  function handleRunRiskAssessment() {
    if (isBranchOverridePending(form)) {
      setErrors({ branchOverride: "Branch override is pending manager approval" })
      goToStep(1)
      return
    }

    const nextErrors = validateVehicleStep(4, form, branchContext)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      goToStep(4)
      return
    }

    setRunning(true)
    window.setTimeout(() => {
      const riskScore = computeVehicleRiskScore(form, summary)
      const saved = persist({
        ...application,
        status: "assessed",
        currentStep: 5,
        riskScore,
      })
      setRunning(false)
      navigate("/loan-officer/risk-report", {
        state: {
          applicationId: saved.id,
          applicant: {
            name: form.fullName,
            nic: form.nic,
            date: form.applicationDate || new Date().toISOString().slice(0, 10),
          },
          riskScore,
          loanAmount: form.financeAmount,
          product: "Hire Purchase · Bike / Three-wheeler",
        },
      })
    }, 900)
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-1 -ml-2 cursor-pointer"
            onClick={() => navigate("/loan-officer/borrowers")}
          >
            <ArrowLeft />
            Borrower management
          </Button>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Vehicle application · {application.id}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {form.fullName || "New vehicle application"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {VEHICLE_WIZARD_STEPS.length} ·{" "}
            {VEHICLE_WIZARD_STEPS[step - 1]?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{application.status}</Badge>
          <Badge variant="secondary">Bike / Three-wheeler</Badge>
          {savedNotice ? (
            <span className="text-xs text-muted-foreground">{savedNotice}</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {VEHICLE_WIZARD_STEPS.map((item) => (
          <Badge
            key={item.id}
            variant={item.id === step ? "default" : "outline"}
            className="cursor-default"
          >
            {item.id}. {item.title}
          </Badge>
        ))}
      </div>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            {VEHICLE_WIZARD_STEPS[step - 1]?.title}
          </CardTitle>
          <CardDescription>
            Vehicle lease / hire purchase form. Drafts are saved locally for this prototype.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {errors.branchOverride ? (
            <p className="mb-4 text-sm text-destructive">{errors.branchOverride}</p>
          ) : null}
          {step === 1 ? (
            <StepVehicleGeneral
              form={form}
              errors={errors}
              branchContext={branchContext}
              onChange={updateForm}
            />
          ) : null}
          {step === 2 ? (
            <StepVehicleIncome form={form} errors={errors} onChange={updateForm} />
          ) : null}
          {step === 3 ? (
            <StepVehicleAssetGuarantor form={form} errors={errors} onChange={updateForm} />
          ) : null}
          {step === 4 ? (
            <StepGuarantor2Declaration form={form} errors={errors} onChange={updateForm} />
          ) : null}
          {step === 5 ? <StepVehicleReview form={form} /> : null}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-between gap-3 border-t border-border/50">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={handleBack} className="cursor-pointer">
              <ChevronLeft />
              Back
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={saving}
              onClick={handleSaveDraft}
              className="cursor-pointer"
            >
              {saving ? <Loader2 className="animate-spin" /> : <Save />}
              Save draft
            </Button>
          </div>

          {step < VEHICLE_WIZARD_STEPS.length ? (
            <Button type="button" onClick={handleNext} className="cursor-pointer">
              Next
              <ChevronRight />
            </Button>
          ) : (
            <Button
              type="button"
              disabled={running}
              onClick={handleRunRiskAssessment}
              className="cursor-pointer"
            >
              {running ? <Loader2 className="animate-spin" /> : null}
              Run risk assessment
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
