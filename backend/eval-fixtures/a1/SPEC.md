# A1 Compliance Readiness — Evaluation Oracle (v1)

**Spec ID:** `a1-readiness-oracle-v1`  
**Ruleset under test:** `A1_RULESET_VERSION` = `a1-readiness-rules-v1`  
**Function under test:** `analyzeA1Readiness(facts)` (pure; synthetic facts only)

**Not measured:** Official CBSL regulatory compliance, ML accuracy, or live-tenant evidence quality.

Expected fixture labels are derived from the rules below. If a fixture’s
`expect.overallStatus` disagrees with the status implied by its expected gap
severities (S0), the suite **fails** — do not silently retarget labels.

## S0 — Status aggregation

Given emitted `dataGaps` and `inferredRisks`:

1. If any **blocking** dataGap → `overallStatus = not_ready`
2. Else if any **warning** dataGap or warning inferredRisk → `ready_with_warnings`
3. Else → `evidence_complete_for_scoped_checks`

Info-severity items do **not** change status by themselves.

## Gap rules (dataGaps)

| Code | Severity | Condition on facts |
|------|----------|-------------------|
| `NO_TENANT_INFO` | blocking | `institution.tenantInfoPresent === false` |
| `NO_ACTIVE_BRANCH` | blocking | `organizational.activeBranchCount < 1` |
| `NO_EMPLOYEES` | blocking | `organizational.employeeCount < 1` |
| `EMPLOYEES_MISSING_EPF` | blocking | `employeeCount > 0` AND `employeesMissingEpfNumber > 0` |
| `EMPLOYEES_MISSING_ETF` | warning | `employeeCount > 0` AND `employeesMissingEtfNumber > 0` |
| `NO_PAYROLL_RECORDS` | blocking | `payrollRecordCount < 1` |
| `NO_PAYROLL_IN_PERIOD` | warning | `payrollRecordCount >= 1` AND `payrollRecordCountInPeriod < 1` |
| `CBSL_POLICY_MISSING` | blocking | `generateCbslPolicyActive === null` |
| `CBSL_POLICY_INACTIVE` | blocking | `generateCbslPolicyActive === false` |
| `NO_AUDIT_IN_PERIOD` | info | `auditLogEntriesInPeriod < 1` |
| `PORTFOLIO_EVIDENCE_UNAVAILABLE` | blocking | `financialAndPortfolioSlots.status === "not_available"` **OR** (`loanCount === 0` AND `borrowerCount === 0`) |
| `LEDGER_EVIDENCE_UNAVAILABLE` | blocking | `journalEntryCountInPeriod === 0` OR `journalEntryCountInPeriod === null` |

**Zero ≠ sufficient evidence:** loan/borrower counts of `0` still trigger
`PORTFOLIO_EVIDENCE_UNAVAILABLE`. A journal count of `0` triggers
`LEDGER_EVIDENCE_UNAVAILABLE`. These must not be labelled as “complete zeros.”

## Inferred risks (not primary pack focus)

| Code | Severity | Condition |
|------|----------|-----------|
| `CBSL_POLICY_TIER_UNEXPECTED` | warning | policy active and `generateCbslPolicyTier !== 3` |
| `TIER3_BACKLOG` | warning | `tier3PendingCount > 0` |

## Measurement

- **Status agreement:** fraction of fixtures where `analyzeA1Readiness(...).overallStatus` equals `expect.overallStatus`.
- **Gap-set agreement:** fraction where the set of `{code, severity}` from `dataGaps` equals `expect.dataGaps` (order-insensitive).

These are **deterministic rule-agreement** rates, not CBSL filing accuracy.
