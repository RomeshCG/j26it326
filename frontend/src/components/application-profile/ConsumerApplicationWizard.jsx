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
import { computeFinancialSummary, computeMockRiskScore } from "./calculations"
import { WIZARD_STEPS, createDefaultForm } from "./constants"
import { ensureApplicationIdentifiers } from "./identifiers"
import { createAndSaveApplication, getApplication, saveApplication } from "./storage"
import StepAppraisal from "./steps/StepAppraisal"
import StepClient from "./steps/StepClient"
import StepFinancial from "./steps/StepFinancial"
import StepIncomeReview from "./steps/StepIncomeReview"
import StepLoanRequest from "./steps/StepLoanRequest"

function validateStep(step, form, branchContext) {
  const errors = {}

  if (step === 1) {
    if (branchContext.mode === "select") {
      if (!form.branch?.trim()) errors.branch = "Select a branch"
    } else if (form.branchOverride?.enabled) {
      if (!form.branchOverride.requestedBranch) {
        errors.requestedBranch = "Select the requested branch"
      }
      if (!form.branchOverride.reason?.trim()) {
        errors.overrideReason = "Provide a reason for the branch override"
      }
    }
    if (!form.contactNo?.trim()) errors.contactNo = "Contact number is required"
    if (!form.loanAmount || Number(form.loanAmount) <= 0) errors.loanAmount = "Enter a valid loan amount"
    if (!form.terms || Number(form.terms) <= 0) errors.terms = "Enter loan terms"
    if (!form.fullName?.trim()) errors.fullName = "Full name is required"
    if (!form.civilStatus) errors.civilStatus = "Civil status is required"
    if (!form.address?.trim()) errors.address = "Address is required"
    if (!form.phoneMobile?.trim()) errors.phoneMobile = "Mobile number is required"
    if (form.applicantType === "business") {
      if (!form.businessRegNo?.trim()) errors.businessRegNo = "Business registration number is required"
    } else if (!form.nic?.trim()) {
      errors.nic = "NIC is required"
    }
    if (form.civilStatus === "Married") {
      if (!form.spouse?.name?.trim()) errors.spouseName = "Spouse name is required"
      if (!form.spouse?.occupation?.trim()) errors.spouseOccupation = "Spouse occupation is required"
      if (!form.spouse?.phone?.trim()) errors.spousePhone = "Spouse phone is required"
      if (!form.spouse?.nic?.trim()) errors.spouseNic = "Spouse NIC is required"
    }
  }

  if (step === 4) {
    if (!form.applicationDate) errors.applicationDate = "Application date is required"
  }

  return errors
}

export default function ConsumerApplicationWizard() {
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
        form.branch || form.assignedBranch || ctx.assignedBranch
      )
      return saveApplication({ ...app, form })
    }

    const existing = getApplication(applicationId)
    if (!existing) return null
    let form = hydrateFormBranch(existing.form, ctx)
    form = ensureApplicationIdentifiers(
      form,
      getEffectiveBranch(form) || form.branch || ctx.assignedBranch
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
  const summary = computeFinancialSummary(form)

  function persist(nextApplication) {
    const saved = saveApplication(nextApplication)
    setApplication(saved)
    return saved
  }

  function updateForm(nextForm) {
    setApplication((current) => ({ ...current, form: nextForm }))
    setSavedNotice("")
  }

  function handleApplicantTypeChange(nextType) {
    updateForm({ ...createDefaultForm(nextType), ...form, applicantType: nextType })
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
    const nextErrors = validateStep(step, form, branchContext)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    handleSaveDraft()
    if (step < WIZARD_STEPS.length) {
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

    const nextErrors = validateStep(4, form, branchContext)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      goToStep(4)
      return
    }

    setRunning(true)
    window.setTimeout(() => {
      const riskScore = computeMockRiskScore(form, summary)
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
            nic: form.nic || form.businessRegNo,
            date: form.applicationDate || new Date().toISOString().slice(0, 10),
          },
          riskScore,
          loanAmount: form.loanAmount,
          product: "Consumer / Personal-Business",
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
            Application profile · {application.id}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {form.fullName || "New application"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Step {step} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step - 1]?.title}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{application.status}</Badge>
          {savedNotice ? <span className="text-xs text-muted-foreground">{savedNotice}</span> : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {WIZARD_STEPS.map((item) => (
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
            {WIZARD_STEPS[step - 1]?.title}
          </CardTitle>
          <CardDescription>
            Enter data from the physical form. Drafts are saved locally for this prototype.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {errors.branchOverride ? (
            <p className="mb-4 text-sm text-destructive">{errors.branchOverride}</p>
          ) : null}
          {step === 1 ? (
            <StepClient
              form={form}
              errors={errors}
              branchContext={branchContext}
              onChange={updateForm}
              onApplicantTypeChange={handleApplicantTypeChange}
            />
          ) : null}
          {step === 2 ? <StepFinancial form={form} onChange={updateForm} /> : null}
          {step === 3 ? <StepAppraisal form={form} onChange={updateForm} /> : null}
          {step === 4 ? (
            <StepLoanRequest form={form} errors={errors} onChange={updateForm} />
          ) : null}
          {step === 5 ? <StepIncomeReview form={form} onChange={updateForm} /> : null}
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

          {step < WIZARD_STEPS.length ? (
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
