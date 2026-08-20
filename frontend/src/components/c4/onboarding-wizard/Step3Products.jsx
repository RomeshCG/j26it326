import React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CheckSquare, Square } from "lucide-react"

export const PREDEFINED_PRODUCTS = [
  {
    id: "group-loan",
    name: "Group Loan (Grameen Model)",
    description: "Small loans distributed to individuals in self-formed groups with joint-liability.",
    sizeRange: "LKR 50,000 - 150,000",
    repaymentCycle: "Weekly"
  },
  {
    id: "individual-microloan",
    name: "Individual Microloan",
    description: "Standard individual loans for income-generating microenterprises.",
    sizeRange: "LKR 100,000 - 500,000",
    repaymentCycle: "Monthly"
  },
  {
    id: "agricultural-loan",
    name: "Agricultural Seasonal Loan",
    description: "Tailored to farming cycles. Bullet repayment or flexible interest-only periods during harvests.",
    sizeRange: "LKR 150,000 - 600,000",
    repaymentCycle: "Seasonal (Yala/Maha)"
  },
  {
    id: "sme-capital-loan",
    name: "SME Working Capital Loan",
    description: "Larger capital loans for growing businesses with formal registration.",
    sizeRange: "LKR 500,000 - 2,000,000",
    repaymentCycle: "Monthly"
  }
]

export default function Step3Products({ formData, errors, toggleProductSelection, toggleCustomProduct, handleCustomProductChange }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Select Loan Products
        </h3>
        <p className="text-xs text-muted-foreground">Select the financial products your microfinance institution offers to clients.</p>
      </div>

      {errors.products && (
        <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive font-medium">
          {errors.products}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PREDEFINED_PRODUCTS.map((product) => {
          const isSelected = formData.selectedProducts.includes(product.id)

          return (
            <div
              key={product.id}
              onClick={() => toggleProductSelection(product.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-3 select-none hover:bg-card/85
                ${isSelected 
                  ? "border-primary bg-primary/5 dark:bg-primary/10" 
                  : "border-border bg-card/40"
                }
              `}
            >
              <div className="mt-1">
                {isSelected ? (
                  <CheckSquare className="size-5 text-primary stroke-[2.5px]" />
                ) : (
                  <Square className="size-5 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">{product.name}</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{product.description}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 pt-2 text-[11px] font-semibold text-muted-foreground">
                  <span className="bg-muted px-2 py-0.5 rounded">Range: {product.sizeRange}</span>
                  <span className="bg-muted px-2 py-0.5 rounded">Cycle: {product.repaymentCycle}</span>
                </div>
              </div>
            </div>
          )
        })}

        <div
          onClick={toggleCustomProduct}
          className={`p-4 rounded-lg border-2 cursor-pointer transition-all flex items-start gap-3 select-none hover:bg-card/85 md:col-span-2
            ${formData.hasCustomProduct 
              ? "border-primary bg-primary/5 dark:bg-primary/10" 
              : "border-border bg-card/40 border-dashed"
            }
          `}
        >
          <div className="mt-1">
            {formData.hasCustomProduct ? (
              <CheckSquare className="size-5 text-primary stroke-[2.5px]" />
            ) : (
              <Square className="size-5 text-muted-foreground" />
            )}
          </div>
          <div className="space-y-1 w-full">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              Custom Loan Product Option
              <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.2 rounded-full uppercase tracking-wider font-semibold">
                Add New
              </span>
            </h4>
            <p className="text-xs text-muted-foreground">Create a tailored loan configuration specific to your institution's model.</p>
          </div>
        </div>
      </div>

      {formData.hasCustomProduct && (
        <div className="p-5 rounded-lg border border-border bg-card/50 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <h4 className="text-sm font-semibold text-foreground border-b border-border/50 pb-2">
            Custom Product Specification
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="custom-product-name" className="text-xs font-semibold">
                Product Name
              </Label>
              <Input
                id="custom-product-name"
                value={formData.customProduct.name}
                onChange={(e) => handleCustomProductChange("name", e.target.value)}
                placeholder="e.g. Housing Microloan"
                className={`h-9 ${errors.customProduct?.name ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
              {errors.customProduct?.name && (
                <p className="text-[11px] text-destructive font-medium">{errors.customProduct.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-product-range" className="text-xs font-semibold">
                Typical Size Range (LKR)
              </Label>
              <Input
                id="custom-product-range"
                value={formData.customProduct.sizeRange}
                onChange={(e) => handleCustomProductChange("sizeRange", e.target.value)}
                placeholder="e.g. LKR 100,000 - 300,000"
                className={`h-9 ${errors.customProduct?.sizeRange ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              />
              {errors.customProduct?.sizeRange && (
                <p className="text-[11px] text-destructive font-medium">{errors.customProduct.sizeRange}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-product-cycle" className="text-xs font-semibold">
                Repayment Cycle
              </Label>
              <select
                id="custom-product-cycle"
                value={formData.customProduct.repaymentCycle}
                onChange={(e) => handleCustomProductChange("repaymentCycle", e.target.value)}
                className={`flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50
                  ${errors.customProduct?.repaymentCycle ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
              >
                <option value="" disabled>Select cycle...</option>
                <option value="Weekly">Weekly</option>
                <option value="Bi-Weekly">Bi-Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Seasonal">Seasonal</option>
              </select>
              {errors.customProduct?.repaymentCycle && (
                <p className="text-[11px] text-destructive font-medium">{errors.customProduct.repaymentCycle}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
