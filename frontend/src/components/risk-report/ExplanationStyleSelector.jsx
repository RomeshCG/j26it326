import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { EXPLANATION_STYLES } from "./officer-profile-style"

export default function ExplanationStyleSelector({ styleId, onStyleChange }) {
  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="border-b border-border/50 pb-4">
        <CardTitle className="text-base font-semibold">Explanation style</CardTitle>
        <CardDescription>
          Officer profile — switch profiles to show how the adaptive explanation changes
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 pt-5">
        {EXPLANATION_STYLES.map((style) => {
          const selected = styleId === style.id
          return (
            <label
              key={style.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                  : "border-border hover:bg-muted/40"
              )}
            >
              <input
                type="radio"
                name="explanation-style"
                checked={selected}
                onChange={() => onStyleChange(style.id)}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <div>
                <p className="text-sm font-medium">{style.label}</p>
                <p className="text-xs text-muted-foreground">{style.description}</p>
              </div>
            </label>
          )
        })}
      </CardContent>
    </Card>
  )
}
