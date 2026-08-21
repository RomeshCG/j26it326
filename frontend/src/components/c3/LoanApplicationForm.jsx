import { useState } from "react"
import { Loader2, ShieldCheck } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SRI_LANKAN_DISTRICTS } from "@/components/c4/onboarding-wizard/Step1Institution"

const PRODUCTS = [
  "Group Enterprise",
  "Individual Working Capital",
  "Agricultural Seasonal",
  "Housing Repair",
]

const selectClass =
  "flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"

function scoreBand(score) {
  if (score >= 75) return { label: "Low risk", variant: "secondary" }
  if (score >= 55) return { label: "Moderate risk", variant: "outline" }
  return { label: "High risk", variant: "destructive" }
}

function computeMockC1Score(form) {
  let score = 72
  const amount = Number(form.amount) || 0
  if (amount > 150000) score -= 8
  if (amount < 50000) score += 4
  if (form.existingLoans === "yes") score -= 10
  if (form.groupMember === "yes") score += 6
  if (form.income && Number(form.income) > Number(form.amount) * 0.4) score += 5
  return Math.max(18, Math.min(96, score))
}

export default function LoanApplicationForm() {
  const [form, setForm] = useState({
    fullName: "",
    nic: "",
    phone: "",
    district: "",
    product: "",
    amount: "",
    tenure: "12",
    income: "",
    purpose: "",
    groupMember: "yes",
    existingLoans: "no",
  })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [risk, setRisk] = useState(null)

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }))
    setRisk(null)
    if (errors[field]) {
      setErrors((current) => {
        const next = { ...current }
        delete next[field]
        return next
      })
    }
  }

  function validate() {
    const next = {}
    if (!form.fullName.trim()) next.fullName = "Borrower name is required"
    if (!form.nic.trim()) next.nic = "NIC is required"
    if (!form.phone.trim()) next.phone = "Phone number is required"
    if (!form.district) next.district = "Select a district"
    if (!form.product) next.product = "Select a product"
    if (!form.amount || Number(form.amount) <= 0) next.amount = "Enter a valid amount"
    if (!form.income || Number(form.income) <= 0) next.income = "Enter monthly income"
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function runAssessment() {
    if (!validate()) return
    setLoading(true)
    setRisk(null)
    window.setTimeout(() => {
      const score = computeMockC1Score(form)
      setRisk({
        score,
        ...scoreBand(score),
        source: "C1 origination model",
      })
      setLoading(false)
    }, 1100)
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 3 · connected to C1
          </p>
          <CardTitle className="text-2xl font-semibold tracking-tight">
            Loan application
          </CardTitle>
          <CardDescription>
            Capture origination details, then pull the Component 1 risk score inline.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Borrower full name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                className={`h-9 ${errors.fullName ? "border-destructive" : ""}`}
                value={form.fullName}
                onChange={(event) => update("fullName", event.target.value)}
                placeholder="e.g. Malini Silva"
              />
              {errors.fullName ? (
                <p className="text-xs font-medium text-destructive">{errors.fullName}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="nic">
                NIC <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nic"
                className={`h-9 ${errors.nic ? "border-destructive" : ""}`}
                value={form.nic}
                onChange={(event) => update("nic", event.target.value)}
                placeholder="199012345V"
              />
              {errors.nic ? (
                <p className="text-xs font-medium text-destructive">{errors.nic}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">
                Mobile number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                className={`h-9 ${errors.phone ? "border-destructive" : ""}`}
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="0771234567"
              />
              {errors.phone ? (
                <p className="text-xs font-medium text-destructive">{errors.phone}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="district">
                District <span className="text-destructive">*</span>
              </Label>
              <select
                id="district"
                value={form.district}
                onChange={(event) => update("district", event.target.value)}
                className={`${selectClass} ${errors.district ? "border-destructive" : ""}`}
              >
                <option value="" disabled>
                  Select district…
                </option>
                {SRI_LANKAN_DISTRICTS.map((district) => (
                  <option key={district} value={district}>
                    {district}
                  </option>
                ))}
              </select>
              {errors.district ? (
                <p className="text-xs font-medium text-destructive">{errors.district}</p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="product">
                Loan product <span className="text-destructive">*</span>
              </Label>
              <select
                id="product"
                value={form.product}
                onChange={(event) => update("product", event.target.value)}
                className={`${selectClass} ${errors.product ? "border-destructive" : ""}`}
              >
                <option value="" disabled>
                  Select product…
                </option>
                {PRODUCTS.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
              {errors.product ? (
                <p className="text-xs font-medium text-destructive">{errors.product}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">
                Requested amount (LKR) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="amount"
                type="number"
                className={`h-9 ${errors.amount ? "border-destructive" : ""}`}
                value={form.amount}
                onChange={(event) => update("amount", event.target.value)}
                placeholder="75000"
              />
              {errors.amount ? (
                <p className="text-xs font-medium text-destructive">{errors.amount}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenure">Tenure (months)</Label>
              <Input
                id="tenure"
                type="number"
                className="h-9"
                value={form.tenure}
                onChange={(event) => update("tenure", event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="income">
                Monthly household income (LKR) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="income"
                type="number"
                className={`h-9 ${errors.income ? "border-destructive" : ""}`}
                value={form.income}
                onChange={(event) => update("income", event.target.value)}
                placeholder="45000"
              />
              {errors.income ? (
                <p className="text-xs font-medium text-destructive">{errors.income}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="purpose">Purpose of loan</Label>
              <Input
                id="purpose"
                className="h-9"
                value={form.purpose}
                onChange={(event) => update("purpose", event.target.value)}
                placeholder="Working capital for grocery stall"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="groupMember">Existing group member?</Label>
              <select
                id="groupMember"
                value={form.groupMember}
                onChange={(event) => update("groupMember", event.target.value)}
                className={selectClass}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="existingLoans">Other outstanding loans?</Label>
              <select
                id="existingLoans"
                value={form.existingLoans}
                onChange={(event) => update("existingLoans", event.target.value)}
                className={selectClass}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
          </div>

          {risk ? (
            <div className="rounded-xl border border-border bg-muted/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {risk.source}
                    </p>
                    <p className="text-sm font-medium">Origination risk score</p>
                  </div>
                </div>
                <Badge variant={risk.variant}>{risk.label}</Badge>
              </div>
              <p className="mt-3 text-3xl font-semibold tabular-nums">{risk.score}</p>
              <div className="relative mt-3 h-2 overflow-hidden rounded-full bg-background">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${risk.score}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Score is returned from Component 1 and shown here without leaving origination.
              </p>
            </div>
          ) : null}
        </CardContent>

        <CardFooter className="justify-end">
          <Button
            type="button"
            size="lg"
            className="cursor-pointer"
            disabled={loading}
            onClick={runAssessment}
          >
            {loading ? <Loader2 className="animate-spin" /> : null}
            {loading ? "Running risk assessment…" : "Run Risk Assessment"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
