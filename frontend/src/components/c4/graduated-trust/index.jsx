import { Link } from "react-router-dom"
import {
  ArrowRight,
  Bot,
  ChevronRight,
  Shield,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import {
  GOVERNANCE_TIERS,
  INITIAL_PENDING_APPROVALS,
  TIER_ACTION_EXAMPLES,
} from "./mock-data"

function TierLadderCard({ tierDef }) {
  return (
    <div
      className={`rounded-xl border bg-card p-5 shadow-sm ${tierDef.borderClass}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Tier {tierDef.tier}
          </p>
          <h3 className="mt-1 text-base font-semibold">{tierDef.label}</h3>
        </div>
        <Badge className={tierDef.badgeClass}>{tierDef.badge}</Badge>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        {tierDef.description}
      </p>
    </div>
  )
}

export default function GraduatedTrust() {
  const pendingCount = INITIAL_PENDING_APPROVALS.length

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Component 4 · AI governance
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Graduated Trust Architecture
          </h1>
          <p className="text-sm text-muted-foreground">
            Four tiers of autonomy define how AI agents act across your institution
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="cursor-pointer">
            <Link to="/agent-log">Agent activity log</Link>
          </Button>
          {pendingCount > 0 && (
            <Button asChild size="sm" className="cursor-pointer">
              <Link to="/tier-approval">
                {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <div className="flex items-center gap-2">
            <Shield className="size-5 text-primary" />
            <div>
              <CardTitle className="text-base font-semibold">
                AI action governance
              </CardTitle>
              <CardDescription>
                Higher-risk actions require more human oversight
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-5 sm:grid-cols-2">
          {GOVERNANCE_TIERS.map((tier) => (
            <TierLadderCard key={tier.tier} tierDef={tier} />
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">
            Example actions by tier
          </CardTitle>
          <CardDescription>
            Click a Tier 3 action to see the human approval flow
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 pt-5">
          {TIER_ACTION_EXAMPLES.map((example) => {
            const isTier3 = example.tier === 3
            const href = isTier3
              ? `/tier-approval?action=${example.id}`
              : example.tier === 1
                ? "/dashboard"
                : "/agent-log"

            return (
              <Link
                key={example.id}
                to={href}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 transition-colors ${
                  isTier3
                    ? "cursor-pointer border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10"
                    : "border-border bg-muted/20 hover:bg-muted/40"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{example.action}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {example.example}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {example.agent}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={
                      example.tier === 1
                        ? "bg-blue-600 text-white"
                        : example.tier === 2
                          ? "bg-green-600 text-white"
                          : example.tier === 3
                            ? "bg-amber-500 text-amber-950"
                            : "bg-red-600 text-white"
                    }
                  >
                    Tier {example.tier}
                  </Badge>
                  {isTier3 && (
                    <ChevronRight className="size-4 text-amber-600 dark:text-amber-400" />
                  )}
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card className="rounded-xl border border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-medium text-foreground">
                Demonstrate graduated trust in action
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a Tier 3 compliance action, review the agent&apos;s prepared
                report, then approve or reject with full audit logging.
              </p>
            </div>
          </div>
          <Button asChild className="cursor-pointer shrink-0">
            <Link to="/tier-approval?action=cbsl-report">
              Try CBSL approval
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Tier assignments for each action type are configured in{" "}
        <Link to="/settings" className="font-medium text-primary hover:underline">
          Settings → AI Agents
        </Link>
        .
      </p>
    </div>
  )
}
