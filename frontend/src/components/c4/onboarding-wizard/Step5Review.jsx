import React from "react"
import { Check, Sparkles } from "lucide-react"

export default function Step5Review({ formData, setupDurationText }) {
  const getProductsCount = () => {
    let count = formData.selectedProducts.length
    if (formData.hasCustomProduct) count += 1
    return count
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Verify Initial Configuration
        </h3>
        <p className="text-xs text-muted-foreground">Confirm that all metadata and parameters are correct before deploying the core ERP.</p>
      </div>

      {/* Grid Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg border border-border bg-card/40 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Institution</span>
          <p className="text-base font-bold text-foreground truncate">{formData.institutionName || "-"}</p>
          <p className="text-xs text-muted-foreground truncate">{formData.institutionType}</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card/40 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Branches</span>
          <p className="text-2xl font-bold text-foreground">{formData.branches.length}</p>
          <p className="text-xs text-muted-foreground">offices configured</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card/40 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Loan Offerings</span>
          <p className="text-2xl font-bold text-foreground">{getProductsCount()}</p>
          <p className="text-xs text-muted-foreground">active products</p>
        </div>
        <div className="p-4 rounded-lg border border-border bg-card/40 space-y-1">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">User Profiles</span>
          <p className="text-2xl font-bold text-foreground">{formData.users.length}</p>
          <p className="text-xs text-muted-foreground">credentials generated</p>
        </div>
      </div>

      {/* Duration Notice */}
      <div className="p-3 text-xs bg-primary/5 text-primary border border-primary/20 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 animate-pulse" />
          <span>Onboarding Wizard setup duration:</span>
        </div>
        <span className="font-semibold text-foreground tabular-nums">{setupDurationText || "calculating..."}</span>
      </div>

      {/* Compliance & Config Checklist */}
      <div className="border border-border/80 rounded-lg overflow-hidden bg-card/30">
        <div className="bg-muted px-4 py-3 border-b border-border/80">
          <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Automated Compliance & Structure Generation
          </h4>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
              <Check className="size-3.5 stroke-[3px]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Sri Lankan EPF/ETF Compliance defaults loaded</p>
              <p className="text-[11px] text-muted-foreground">Employer EPF (12%) / ETF (3%) and Employee EPF (8%) tax schedules structured automatically.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
              <Check className="size-3.5 stroke-[3px]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">CBSL Regulatory Reporting templates generated</p>
              <p className="text-[11px] text-muted-foreground">Preconfigured compliance templates and schemas mapped for Central Bank reports.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-0.5 bg-emerald-500/10 text-emerald-500 rounded-full">
              <Check className="size-3.5 stroke-[3px]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Standardized Chart of Accounts deployed</p>
              <p className="text-[11px] text-muted-foreground">Generates a standard ledger structure including loan portfolios, assets, and liabilities specific to MFIs.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
