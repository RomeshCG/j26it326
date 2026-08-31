import { ArrowLeft } from "lucide-react"
import { useNavigate } from "react-router-dom"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { LOAN_TYPES } from "./constants"

export default function LoanTypeSelection() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <Button
        type="button"
        variant="ghost"
        className="cursor-pointer"
        onClick={() => navigate("/loan-officer/borrowers")}
      >
        <ArrowLeft />
        Back to borrower management
      </Button>

      <div className="space-y-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Component 1 · Application profile
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">Select loan type</h1>
        <p className="text-sm text-muted-foreground">
          Choose the application form that matches the physical documents completed
          by the borrower.
        </p>
      </div>

      <div className="grid gap-4">
        {LOAN_TYPES.map((type) => (
          <Card key={type.id} className="rounded-xl border bg-card">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle className="text-base font-semibold">{type.label}</CardTitle>
                <CardDescription className="mt-1">{type.description}</CardDescription>
              </div>
              {!type.available ? <Badge variant="outline">Coming soon</Badge> : null}
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                disabled={!type.available}
                className="cursor-pointer"
                onClick={() =>
                  navigate(`/loan-officer/applications/new/${type.id}`)
                }
              >
                Start application
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
