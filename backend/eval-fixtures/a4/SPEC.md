# A4 NLQ Intent — Capability Oracle (v1)

**Spec ID:** `a4-intent-oracle-v1`  
**Prompt / gate under study:** `A4_NLQ_PROMPT_VERSION` = `a4-intent-v2`  
**Model version string (runtime):** `A4_NLQ_MODEL_VERSION` = `a4-nlq-ollama-v1`  

**This document labels questions.** It is **not** an Ollama accuracy report and **not**
a claim of general chatbot quality.

Gold labels in `a4-intent-gold.v1.json` are derived from these written rules by
independent human judgement. Do **not** retarget labels to match model output or
`questionSupportsIntent` alone.

---

## C0 — Evaluation layers (keep separate)

| Layer | What it measures | This pack |
|-------|------------------|-----------|
| **Semantic gold** | What the user is asking for under product capability | **Yes — gold `expect.intent`** |
| **Lexical gate** | Whether `questionSupportsIntent` would allow a supported intent | Annotated via `probesLexicalGateLimitation`; measured later |
| **Live classifier** | Ollama JSON → `resolveNlqIntentFromModel` | **Out of scope** for Slice 4B |
| **RBAC / Prisma answers** | Authorization and grounded counts | **Out of scope** |

Corpus-validation pass rates are **structure/consistency checks**, not intent accuracy.

---

## C1 — Supported intents

### C1.1 `count_pending_tier3`

User asks for a **count** of Tier 3 / approval-queue agent actions that are
**waiting** (pending approval).

- Parameters: none.
- Typical cues: pending / awaiting / waiting **together with** Tier 3 or approval language.

### C1.2 `count_actions_window`

User asks for a **count** of agent actions in a recent **day window**, optionally
filtered to one of A1–A4.

| Parameter | Rule |
|-----------|------|
| `days` | Integer **1–30** when provided. If omitted in a clear window question → gold `days` = **7** (product default `A4_NLQ_DAYS_DEFAULT`). |
| `agentId` | `A1` \| `A2` \| `A3` \| `A4` when a specific agent is named; otherwise `null`. |

If the user clearly asks for this intent but supplies **out-of-range** `days` or an
**unknown** agent id, gold keeps `intent: count_actions_window` and sets
`paramsValid: false` (pipeline parse disposition is unsupported — not a silent clamp).

---

## C2 — Unsupported

Gold `intent: unsupported` when the question is **not** a clear ask for C1.1 or C1.2, including:

- Greetings, thanks, chit-chat
- Domain topics outside the two tools (PAR, payroll, loans, EPF, budgets, staff, branches, …)
- Purely unclear / empty-of-intent text (still within length limits)

Ambiguous mixes that do not clearly select one supported tool → **unsupported**
(fail-closed), unless a later SPEC revision defines a priority rule.

---

## C3 — Conflict resolution

1. If both Tier-3-pending and window-count readings are plausible and neither dominates → **unsupported**.
2. Window ask with invalid params → semantic `count_actions_window` + `paramsValid: false`.
3. Mentions of “approval” alone without a pending/awaiting queue ask → **unsupported** (not C1.1).

---

## C4 — Semantic label vs lexical gate

Production `questionSupportsIntent` (a4-intent-v2 evidence gate) may **false-negative**
on semantically valid C1 questions (missing exact cue pairs).

| Annotation | Meaning |
|------------|---------|
| `probesLexicalGateLimitation: false` | Supported gold item is expected to **pass** the current gate if the model returned that intent |
| `probesLexicalGateLimitation: true` | Semantically supported (C1), but wording is chosen so the **current** gate is expected to **reject** — do **not** relabel as unsupported |

Unsupported gold items must have `probesLexicalGateLimitation: false`.

---

## C5 — `invalid` vs `unsupported` (diagnostics)

- **unsupported:** capability / topic / ambiguity (gold `intent: unsupported`).
- **invalid:** reserved for **non-JSON / unparseable model output** at runtime — not used as a gold question label in this pack.
- **paramsValid: false:** semantic supported intent with illegal parameters (future parse → unsupported disposition).

---

## C6 — Prompt example hygiene

Do **not** copy production few-shot strings from `buildNlqIntentSystemPrompt()` verbatim
into the gold set. Paraphrases are allowed.

---

## Measurement (later slices)

- Live Ollama + `resolveNlqIntentFromModel` agreement with gold `intent` (+ params when `paramsValid`).
- Separate gate true-negative / false-negative rates using `probesLexicalGateLimitation`.
- Never cite corpus-validator pass counts as model accuracy.
