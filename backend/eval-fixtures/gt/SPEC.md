# Graduated Trust Governance — Evaluation Oracle (v1)

**Spec ID:** `gt-governance-oracle-v1`  
**Ruleset under test:** `gt-governance-rules-v1`  
**Functions under test (pure / DB-free):**

- `DEFAULT_AGENT_POLICIES` (`agent-defaults.ts`)
- `resolveTier`, `isValidTransition`, `nextStatusAfterHandler` (`agent-engine-core.ts`)
- `evaluateA1ApproveGate` (+ helpers) (`agent-a1-compliance.ts`)

**Not measured:** Live HTTP RBAC, Prisma persistence, audit-log durability under DB-admin
rewrite, production-wide security, or official CBSL regulatory compliance.

Expected fixture labels are derived from the rules below. If a fixture’s
`expect` disagrees with the oracle helper for its category (see verify script),
the suite **fails** — do not silently retarget labels.

Overlaps with `verify:graduated-trust` / `verify:a1-compliance` are marked
`duplicateOfVerify: true` in the pack. Those fixtures still have research value
as **labelled agreement rates**, not as new behavioral coverage.

---

## G1 — Default tier routing (seed policies)

Active default policies map action types to agent + tier:

| actionType | agentId | tier |
|------------|---------|------|
| `nlq_query` | A4 | 1 |
| `budget_threshold_alert` | A2 | 2 |
| `generate_cbsl_report` | A1 | 3 |
| `volume_spike_alert` | A3 | 4 |

Agreement: lookup in `DEFAULT_AGENT_POLICIES` matches the table (agentId + tier + isActive).

---

## G2 — Tier resolution fallback

Given a policy-like object (or null/undefined):

1. If policy is missing **or** `isActive !== true` → tier **4**, `isFallback = true`
2. Else if `tier` ∈ {1,2,3,4} → that tier, `isFallback = false`
3. Else → tier **4**, `isFallback = true`

This is fail-closed governance: unknown/inactive policy must not silently run as
Tier 1–3 automation.

---

## G3 — Status transitions

`isValidTransition(from, to)` is **false** when `from === to`.

| from | allowed `to` |
|------|----------------|
| `running` | `executed`, `notified`, `failed` |
| `pending_approval` | `approved`, `rejected` |
| `approved` | `executed`, `failed` |
| `rejected`, `executed`, `notified`, `alert_only`, `failed` | _(none — terminal)_ |

Any other pair is invalid.

---

## G4 — Post-handler status (tier-dependent)

`nextStatusAfterHandler(tier, handlerSucceeded)`:

1. If `handlerSucceeded === false` → `failed` (any tier)
2. Else if `tier === 2` → `notified`
3. Else → `executed` (tiers 1, 3, and other numeric values)

Tier 4 dispatch typically never reaches a success handler path in product flow
(`alert_only` without handler); fixtures focus on the pure function contract.

---

## G5 — A1 Tier-3 approve gate (SoD + hash binding)

Applies only when approving an A1 readiness package
(`actionType = generate_cbsl_report`, `reportKind = cbsl_readiness_v1`).

Synthetic gate inputs use fixed preparer/approver UUIDs and a deterministic
minimal readiness report (see verify script). Outcomes:

| Scenario | Expected |
|----------|----------|
| Preparer UUID ≠ approver UUID, prepare-audit `proposalHash` matches payload, payload self-hash OK | `ok: true` |
| Approver UUID equals preparer UUID | `ok: false`, `httpStatus: 403` (SoD) |
| Prepare-audit `proposalHash` ≠ grounded payload `proposalHash` (audit tamper) | `ok: false`, `httpStatus: 409` |

**Scope note:** This checks the **pure** `evaluateA1ApproveGate` function. It does
**not** prove live route middleware, JWT roles, or audit persistence.

---

## Measurement

Report agreement rates **separately**:

- **Tier routing:** `tier_routing` fixtures (G1 + G2)
- **Transitions:** `status_transition` fixtures (G3)
- **Post-handler:** `post_handler_status` fixtures (G4)
- **Approve gates:** `a1_approve_gate` fixtures (G5)

These are deterministic **rule-agreement** rates for governance helpers, not
security penetration results or regulatory compliance scores.
