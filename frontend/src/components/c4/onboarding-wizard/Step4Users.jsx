import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, User, Mail } from "lucide-react"

export const ROLES = [
  "Institution Admin",
  "Branch Manager",
  "Loan Officer",
  "Finance Officer",
  "HR Officer",
  "Field Officer"
]

export default function Step4Users({ formData, errors, handleAddUser, handleRemoveUser, handleUserChange }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Setup Staff Accounts
          </h3>
          <p className="text-xs text-muted-foreground">Assign Role-Based Access Control credentials to employee profiles.</p>
        </div>
        <Button
          type="button"
          onClick={handleAddUser}
          size="default"
          variant="outline"
          className="cursor-pointer"
        >
          <Plus className="mr-1.5 size-4" />
          Add User
        </Button>
      </div>

      <div className="space-y-4">
        {formData.users.map((user, index) => {
          const rowErrors = errors.users?.[index] || {}
          const isPrimaryAdmin = index === 0

          return (
            <div 
              key={index} 
              className={`group relative p-4 rounded-lg border flex flex-col md:flex-row gap-4 items-start md:items-center transition-colors
                ${isPrimaryAdmin 
                  ? "border-primary/40 bg-primary/5 dark:bg-primary/10" 
                  : "border-border bg-card/50 hover:bg-card/85"
                }
              `}
            >
              <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor={`user-name-${index}`} className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    Full Name
                    {isPrimaryAdmin && (
                      <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.2 rounded-full uppercase tracking-wider font-semibold">
                        Primary Admin
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id={`user-name-${index}`}
                      value={user.name}
                      disabled={isPrimaryAdmin}
                      onChange={(e) => handleUserChange(index, "name", e.target.value)}
                      placeholder="e.g. Ruwan Perera"
                      className={`h-9 pl-9 ${isPrimaryAdmin ? "bg-muted/50 cursor-not-allowed opacity-80" : ""} ${rowErrors.name ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    />
                  </div>
                  {rowErrors.name && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.name}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`user-email-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Email Address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      id={`user-email-${index}`}
                      value={user.email}
                      disabled={isPrimaryAdmin}
                      onChange={(e) => handleUserChange(index, "email", e.target.value)}
                      placeholder="e.g. ruwan@microflow.lk"
                      className={`h-9 pl-9 ${isPrimaryAdmin ? "bg-muted/50 cursor-not-allowed opacity-80" : ""} ${rowErrors.email ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                    />
                  </div>
                  {rowErrors.email && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.email}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`user-role-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Security Role
                  </Label>
                  <select
                    id={`user-role-${index}`}
                    value={user.role}
                    disabled={isPrimaryAdmin}
                    onChange={(e) => handleUserChange(index, "role", e.target.value)}
                    className={`flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50
                      ${isPrimaryAdmin ? "bg-muted/50 cursor-not-allowed opacity-80" : ""} ${rowErrors.role ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                  >
                    {isPrimaryAdmin ? (
                      <option value="Institution Admin">Institution Admin</option>
                    ) : (
                      ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))
                    )}
                  </select>
                  {rowErrors.role && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.role}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor={`user-branch-${index}`} className="text-xs font-semibold text-muted-foreground">
                    Branch Assignment
                  </Label>
                  <select
                    id={`user-branch-${index}`}
                    value={user.branch}
                    onChange={(e) => handleUserChange(index, "branch", e.target.value)}
                    className={`flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50
                      ${rowErrors.branch ? "border-destructive focus-visible:ring-destructive/30" : ""}`}
                  >
                    <option value="All Branches">All Branches (Head Office)</option>
                    {formData.branches
                      .filter((b) => b.name.trim() !== "")
                      .map((b) => (
                        <option key={b.name} value={b.name}>{b.name}</option>
                      ))
                    }
                  </select>
                  {rowErrors.branch && (
                    <p className="text-[11px] text-destructive font-medium mt-0.5">{rowErrors.branch}</p>
                  )}
                </div>
              </div>

              {!isPrimaryAdmin && (
                <button
                  type="button"
                  onClick={() => handleRemoveUser(index)}
                  className="mt-2 md:mt-0 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors cursor-pointer"
                  aria-label="Remove user"
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
