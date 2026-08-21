import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Landmark, MapPin, User } from "lucide-react"

export default function Step2Branches({ formData, errors, handleAddBranch, handleRemoveBranch, handleBranchChange }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Configure Branches
          </h3>
          <p className="text-xs text-muted-foreground">Add and assign manager roles to regional microfinance offices.</p>
        </div>
        <Button
          type="button"
          onClick={handleAddBranch}
          size="default"
          variant="outline"
          className="cursor-pointer"
        >
          <Plus className="mr-1.5 size-4" />
          Add Branch
        </Button>
      </div>

      {errors.global && (
        <div className="p-3 text-sm rounded-lg bg-destructive/10 text-destructive font-medium">
          {errors.global}
        </div>
      )}

      <div className="space-y-4">
        {formData.branches.map((branch, index) => {
          const rowErrors = errors.branches?.[index] || {}

          return (
            <div 
              key={index} 
              className="group relative p-4 rounded-lg border border-border bg-card/50 flex flex-col md:flex-row gap-4 items-start md:items-center transition-colors hover:bg-card/80"
            >
              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`branch-name-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Branch Name
                  </Label>
                  <div className="relative">
                    <Landmark className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id={`branch-name-${index}`}
                      value={branch.name}
                      onChange={(e) => handleBranchChange(index, "name", e.target.value)}
                      placeholder="e.g. Jaffna Central Office"
                      className={`h-9 pl-9 ${rowErrors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    />
                  </div>
                  {rowErrors.name && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`branch-loc-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Location / Address
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id={`branch-loc-${index}`}
                      value={branch.location}
                      onChange={(e) => handleBranchChange(index, "location", e.target.value)}
                      placeholder="e.g. Hospital Road, Jaffna"
                      className={`h-9 pl-9 ${rowErrors.location ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    />
                  </div>
                  {rowErrors.location && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.location}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`branch-mgr-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Branch Manager Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id={`branch-mgr-${index}`}
                      value={branch.manager}
                      onChange={(e) => handleBranchChange(index, "manager", e.target.value)}
                      placeholder="e.g. K. Sivalingam"
                      className={`h-9 pl-9 ${rowErrors.manager ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    />
                  </div>
                  {rowErrors.manager && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.manager}</p>
                  )}
                </div>
              </div>

              {formData.branches.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveBranch(index)}
                  className="mt-2 md:mt-0 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                  aria-label="Remove branch"
                >
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
