import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export function SectionTitle({ title, description }) {
  return (
    <div className="space-y-1 border-b border-border/50 pb-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}

export function Field({ id, label, required, error, children }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}

export function TextInput({ id, value, onChange, type = "text", placeholder, disabled }) {
  return (
    <Input
      id={id}
      type={type}
      value={value ?? ""}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(event) => onChange?.(event.target.value)}
      className="h-9"
    />
  )
}

export function AutoAssignedField({ id, label, value }) {
  return (
    <Field id={id} label={label}>
      <TextInput id={id} value={value || "—"} disabled />
      <p className="text-xs text-muted-foreground">Auto-assigned by the system</p>
    </Field>
  )
}

export function TextAreaInput({ id, value, onChange, rows = 3, placeholder }) {
  return (
    <Textarea
      id={id}
      rows={rows}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function SelectInput({ id, value, onChange, options, placeholder = "Select…" }) {
  return (
    <Select value={value || null} onValueChange={(next) => onChange(next ?? "")}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function ToggleGroup({ value, options, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            value === option.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:bg-muted"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SummaryCard({ label, value, tone = "default" }) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-destructive"
        : ""

  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${toneClass}`}>{value}</p>
    </div>
  )
}

export function formatLkr(value) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0)
}

export function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return "—"
  return Number(value).toFixed(2)
}
