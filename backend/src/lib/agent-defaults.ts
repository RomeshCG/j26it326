/**
 * Default agent tier policies for Graduated Trust governance.
 * Shared between tenant provisioning bootstrap and tenant seed.
 */

export interface DefaultAgentPolicy {
  actionType: string
  agentId: string
  agentName: string
  tier: 1 | 2 | 3 | 4
  description: string
  isActive: boolean
}

export const DEFAULT_AGENT_POLICIES: readonly DefaultAgentPolicy[] = [
  {
    actionType: "nlq_query",
    agentId: "A4",
    agentName: "NLQ",
    tier: 1,
    description: "Answer natural-language queries automatically",
    isActive: true,
  },
  {
    actionType: "budget_threshold_alert",
    agentId: "A2",
    agentName: "Workflow",
    tier: 2,
    description: "Execute alert and notify manager",
    isActive: true,
  },
  {
    actionType: "generate_cbsl_report",
    agentId: "A1",
    agentName: "Compliance",
    tier: 3,
    description:
      "Prepare CBSL readiness package (cbsl_readiness_v1); human approval required — not an official submission",
    isActive: true,
  },
  {
    actionType: "volume_spike_alert",
    agentId: "A3",
    agentName: "Anomaly",
    tier: 4,
    description: "Alert only — human decides next steps",
    isActive: true,
  },
] as const
