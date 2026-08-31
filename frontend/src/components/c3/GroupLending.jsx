import { ArrowLeft, ChevronRight, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GROUPS, formatLkr } from "./mock-data"

function memberStatusBadge(status) {
  if (status === "ews") return <Badge variant="destructive">EWS</Badge>
  if (status === "overdue") return <Badge variant="destructive">Overdue</Badge>
  if (status === "guarantor") return <Badge variant="outline">Guarantor</Badge>
  return <Badge variant="secondary">Current</Badge>
}

export default function GroupLending({ groupId, onBack, onOpenLoan }) {
  const group = GROUPS[groupId] ?? GROUPS["GRP-KIR-12"]
  const activeMembers = group.members.filter((m) => m.loanId)
  const totalOutstanding = activeMembers.reduce((sum, m) => sum + m.outstanding, 0)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8">
      <Button type="button" variant="ghost" size="default" onClick={onBack} className="cursor-pointer">
        <ArrowLeft />
        Back
      </Button>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Group lending · {group.id}
          </p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight">
                {group.name}
              </CardTitle>
              <CardDescription>
                {group.village} · Formed {group.formed}
              </CardDescription>
            </div>
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Guarantee strength
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {group.guaranteeStrength}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Peer guarantee score</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Meeting attendance
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {group.meetingAttendance}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Last 8 cycles</p>
          </div>
          <div className="rounded-xl border border-border bg-background p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Group outstanding
            </p>
            <p className="mt-2 text-3xl font-semibold tabular-nums">
              {formatLkr(totalOutstanding)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeMembers.length} active loans
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl border bg-card">
        <CardHeader className="border-b border-border/50 pb-4">
          <CardTitle className="text-base font-semibold">Members</CardTitle>
          <CardDescription>
            Guarantee strength and attendance feed the EWS social-decay signal.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pt-0">
          <div className="divide-y divide-border">
            {group.members.map((member) => (
              <button
                key={`${member.name}-${member.loanId ?? "g"}`}
                type="button"
                disabled={!member.loanId}
                onClick={() => member.loanId && onOpenLoan?.(member.loanId)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/70 disabled:cursor-default disabled:hover:bg-transparent sm:px-6"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{member.name}</p>
                    {memberStatusBadge(member.status)}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {member.role}
                    {member.loanId ? ` · ${member.loanId}` : ""}
                  </p>
                </div>
                <div className="text-right">
                  {member.outstanding > 0 ? (
                    <p className="text-sm font-medium tabular-nums">
                      {formatLkr(member.outstanding)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No loan</p>
                  )}
                </div>
                {member.loanId ? (
                  <ChevronRight className="size-4 text-muted-foreground" />
                ) : (
                  <span className="size-4" />
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
