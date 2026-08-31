import { Field, SelectInput, TextAreaInput, TextInput } from "./FormFields"
import { createDefaultBranchOverride } from "./branch-context"

export default function BranchField({ form, errors, branchContext, onChange }) {
  const { mode, assignedBranch, branchOptions } = branchContext
  const override = form.branchOverride || createDefaultBranchOverride()

  function updateForm(nextForm) {
    onChange(nextForm)
  }

  function updateOverride(partial) {
    updateForm({
      ...form,
      branchOverride: { ...override, ...partial },
    })
  }

  if (mode === "select") {
    return (
      <Field
        id="branch"
        label="Branch"
        required
        error={errors.branch}
      >
        <SelectInput
          id="branch"
          value={form.branch}
          options={branchOptions}
          placeholder="Select branch"
          onChange={(value) => updateForm({ ...form, branch: value })}
        />
      </Field>
    )
  }

  return (
    <div className="space-y-3 md:col-span-2 lg:col-span-3">
      <Field id="assignedBranch" label="Assigned branch" required error={errors.branch}>
        <TextInput id="assignedBranch" value={assignedBranch} disabled />
      </Field>

      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={override.enabled}
          onChange={(event) => {
            const enabled = event.target.checked
            if (!enabled) {
              updateForm({
                ...form,
                branch: assignedBranch,
                assignedBranch,
                branchOverride: createDefaultBranchOverride(),
              })
              return
            }
            updateOverride({ enabled: true, status: "none" })
          }}
        />
        <span>
          Request a different branch
          <span className="mt-0.5 block text-xs text-muted-foreground">
            Manager approval is required before the override takes effect.
          </span>
        </span>
      </label>

      {override.enabled ? (
        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-4">
          <Field
            id="requestedBranch"
            label="Requested branch"
            required
            error={errors.requestedBranch}
          >
            <SelectInput
              id="requestedBranch"
              value={override.requestedBranch}
              options={branchOptions.filter((name) => name !== assignedBranch)}
              placeholder="Select branch"
              onChange={(value) =>
                updateOverride({
                  requestedBranch: value,
                  status: value && override.reason?.trim() ? "pending" : override.status,
                })
              }
            />
          </Field>

          <Field
            id="overrideReason"
            label="Reason for override"
            required
            error={errors.overrideReason}
          >
            <TextAreaInput
              id="overrideReason"
              rows={2}
              value={override.reason}
              placeholder="Explain why this application should be processed under another branch."
              onChange={(value) =>
                updateOverride({
                  reason: value,
                  status:
                    value.trim() && override.requestedBranch ? "pending" : override.status,
                })
              }
            />
          </Field>

          {override.status === "pending" ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Branch override request submitted. A branch manager must approve before you can
              run the risk assessment.
            </div>
          ) : null}

          {override.status === "approved" ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-900 dark:text-emerald-200">
              Manager approved branch change to {override.requestedBranch}.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
