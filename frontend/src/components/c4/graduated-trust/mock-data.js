export const GOVERNANCE_TIERS = [
  {
    tier: 1,
    label: "Autonomous",
    description: "Agent executes automatically.",
    badge: "Auto",
    badgeClass: "bg-blue-600 text-white",
    borderClass: "border-blue-500/40",
  },
  {
    tier: 2,
    label: "Execute + Notify",
    description: "Agent executes and notifies the responsible manager.",
    badge: "Notified",
    badgeClass: "bg-green-600 text-white",
    borderClass: "border-green-500/40",
  },
  {
    tier: 3,
    label: "Human Approval Required",
    description: "Agent prepares the action; a human must approve before execution.",
    badge: "Pending Approval",
    badgeClass: "bg-amber-500 text-amber-950",
    borderClass: "border-amber-500/40",
  },
  {
    tier: 4,
    label: "Alert Only",
    description: "Agent raises an alert; human decides all next steps.",
    badge: "Alert Only",
    badgeClass: "bg-red-600 text-white",
    borderClass: "border-red-500/40",
  },
]

export const TIER_ACTION_EXAMPLES = [
  {
    id: "nlq-query",
    action: "Answer NLQ query",
    tier: 1,
    agent: "Agent 4",
    example: "What is PAR30 for Kandy branch?",
  },
  {
    id: "budget-alert",
    action: "Budget threshold alert",
    tier: 2,
    agent: "Agent 2",
    example: "Kandy branch expenses exceeded monthly budget by 12%",
  },
  {
    id: "cbsl-report",
    action: "Generate CBSL Report",
    tier: 3,
    agent: "Compliance Agent",
    example: "Month-end regulatory report for CBSL submission",
  },
  {
    id: "volume-spike",
    action: "Volume spike detection",
    tier: 4,
    agent: "Agent 3",
    example: "Cross-branch disbursement volume 340% above baseline",
  },
]

export const INITIAL_PENDING_APPROVALS = [
  {
    id: "cbsl-report",
    agent: "A1",
    agentName: "Compliance Agent",
    agentColor: "bg-purple-500",
    title: "Central Bank Monthly Report — November 2024",
    summaryAction: "Generate CBSL Report",
    tier: 3,
    reason: "Month-end compliance report detected missing data in 2 branches.",
    confidence: 91,
    preparedBy: "Compliance Agent",
    timeWaiting: "waiting 2 hours",
    preparedTime: "09:14 AM",
    approveConsequence:
      "Approving this will submit the November 2024 regulatory report to the Central Bank of Sri Lanka reporting portal and mark it as filed in MicroFlow.",
    rejectConsequence:
      "Rejecting this will discard the prepared report. The compliance agent will recompile after branch data gaps are resolved.",
    type: "report",
    data: [
      { field: "Reporting Period", value: "November 2024" },
      { field: "Branches with missing data", value: "Kandy, Kurunegala" },
      { field: "Total Loan Portfolio", value: "LKR 48,340,000" },
      { field: "Number of Active Borrowers", value: "1,247" },
      { field: "PAR30", value: "4.2%" },
      { field: "PAR90", value: "1.8%" },
      { field: "New Loans Disbursed", value: "87" },
      { field: "Total Disbursements", value: "LKR 6,750,000" },
      { field: "Data completeness", value: "91%" },
    ],
    timeline: [
      { step: "Month-end trigger detected", time: "December 1, 2024 at 00:01 AM" },
      { step: "Transaction data pulled from Finance module — 2,847 records processed", time: "00:02 AM" },
      { step: "Missing branch submissions flagged — Kandy and Kurunegala", time: "00:04 AM" },
      { step: "CBSL report template loaded — Version 4.2 (current)", time: "00:04 AM" },
      { step: "Report compiled with partial data — 91% completeness", time: "00:05 AM" },
      { step: "Escalated to Tier 3 human review — awaiting approval", time: "00:06 AM" },
    ],
    risk: {
      accuracy: {
        level: "Medium",
        desc: "Two branches have incomplete submissions; figures may change after reconciliation",
      },
      compliance: {
        level: "Medium",
        desc: "Report can be filed but missing branch data should be resolved before deadline",
      },
      timing: {
        level: "Low",
        desc: "Report is within the 5-day submission window",
      },
      override: {
        level: "Rare",
        desc: "Similar partial reports have been approved 12% of the time",
      },
      overall: {
        level: "Medium Risk — review branch gaps before approving",
      },
    },
  },
  {
    id: "anomaly-ampara",
    agent: "A3",
    agentName: "Agent 3 — Anomaly",
    agentColor: "bg-red-500",
    title: "Unusual Transaction Escalation — Ampara Branch",
    summaryAction: "Freeze borrower account pending review",
    tier: 3,
    reason: "Disbursement of LKR 485,000 occurred outside operating hours and exceeds baseline by 300%.",
    confidence: 87,
    preparedBy: "Anomaly Agent",
    timeWaiting: "waiting 5 hours",
    preparedTime: "06:22 AM",
    approveConsequence:
      "Approving this will freeze the associated borrower account and notify the Branch Manager for manual investigation.",
    rejectConsequence:
      "Rejecting this will clear the anomaly alert and allow the transaction to proceed normally.",
    type: "escalation",
    data: [
      { field: "Transaction ID", value: "TXN-99824" },
      { field: "Branch", value: "Ampara" },
      { field: "Amount", value: "LKR 485,000" },
      { field: "Time", value: "11:47 PM" },
      { field: "Flag Reason", value: "Outside normal operating hours & 300% above average" },
    ],
    timeline: [
      { step: "Transaction received in stream", time: "11:47 PM" },
      { step: "Baseline deviation detected (>300%)", time: "11:47 PM" },
      { step: "Time-of-day rule triggered (Outside 06:00-20:00)", time: "11:47 PM" },
      { step: "Risk score calculated (92/100)", time: "11:48 PM" },
      { step: "Escalated to Tier 3 human review due to high risk", time: "11:48 PM" },
    ],
    risk: {
      accuracy: {
        level: "High",
        desc: "Transaction pattern severely deviates from historical baseline",
      },
      compliance: {
        level: "Medium",
        desc: "Potential AML flag requires manual KYC review",
      },
      timing: {
        level: "High",
        desc: "Immediate action recommended to prevent fund extraction",
      },
      override: {
        level: "Rare",
        desc: "Similar alerts have been overridden 5% of the time",
      },
      overall: {
        level: "High Risk — requires manual investigation",
      },
    },
  },
]

/** Maps agent-log / dashboard references to tier-approval queue ids */
export const APPROVAL_LINKS = {
  "LOG-025": "cbsl-report",
  "LOG-023": "anomaly-ampara",
}
