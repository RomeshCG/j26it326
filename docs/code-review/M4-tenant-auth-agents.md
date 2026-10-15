# Code review: M4 (Tenancy, Auth, Governance, Agents, Admin UI)

Scope: `backend/src` auth / tenant / domain / provisioning / agent / rate-limit code, `frontend/src/components/c4`, `agents/`.
Method: read the code, ran ESLint and `tsc`, grepped for risky patterns. The aim is to help us all present a defensible project.

## Against the task list (`IMFS_Task_List.md`, `M4_ML_AND_AGENTS_TODO.md`)

The Graduated Trust engine is real. The risk, which the M4 plan itself names, is that without the following the panel sees "if/else trust tiers + UI":

- [ ] Agent action handlers in `agent-handlers.ts` are stubs
- [ ] Agents 1-4 (Compliance, Workflow Orchestrator, Anomaly Detection, NLQ) via LangChain: `agents/` is empty
- [ ] Anomaly model (Isolation Forest) and its evaluation: no `ml/m4_anomaly` yet
- [ ] LLM may explain but must not override a model's label; this needs a test
- [ ] HR/payroll with EPF/ETF calculation and an event to M2's ledger (in progress / planned)
- [ ] Global "Ask Agent 4" widget embeddable by other modules
- [ ] Bruno requests for agents (`40 M4 Agents` folder is only a placeholder)

Suggested order: one real handler end to end (action -> tier -> audit) -> Isolation Forest on synthetic payroll with a labelled evaluation -> a single LangChain agent behind the existing governance engine.

## Backend gaps

| # | Gap | Evidence | Suggested fix |
|---|---|---|---|
| 1 | CORS is fully open | `index.ts:43` uses `app.use(cors())` with no origin list; no `helmet` | Restrict origins from an env variable; add `helmet` |
| 2 | `any` in security-sensitive code | `lib/auth.ts:111`, `domain-service.ts` (3 catches), `provisioning-service.ts` (4), `middleware/rate-limit.ts` (2, includes `(req as any).user`), `index.ts:57` | Use `unknown` plus a type guard; extend the Express `Request` type for `user` |
| 3 | `console.*` used as the logger | About 33 calls (`index.ts` 10, `domain-service.ts` 7, `provisioning-service.ts` 6, ...) | One small logger (pino) with levels; never log secrets or tokens |
| 4 | `err.message` returned to clients | `routes/tenant.ts` (2), `routes/auth.ts` (1) | Central error handler that returns a generic message |
| 5 | Leftover scaffolding | `routes/_example.ts` is imported in `index.ts` | Remove before demo or release |
| 6 | Large files | `agent-engine.ts` 716 lines, `domain-service.ts` 697, `provisioning-service.ts` | Split by responsibility |
| 7 | Tests are manual scripts only | `verify-graduated-trust.ts` is 2,484 lines | Move the key checks (auth/RBAC, tenant isolation, trust tiers) to a test runner (Vitest) and run in CI |
| 8 | `agents/` folder is empty | `.keep` and a README only | If the agents are the research contribution, show them; otherwise say where they live |

## Frontend (`c4`) gaps

c4 has **39 of the repo's 75 lint problems** (about 4.8 per 1,000 lines, versus 2.2 in c3 and 0.9 in M1's files):

- `settings/index.jsx` 8 unused variables
- `onboarding-wizard/index.jsx` 9 problems (4 unused, 3 `setState` in effect, 1 missing dependency, 1 useless assignment)
- `tier-approval/index.jsx` 6 problems
- `AgentPanel.jsx` 4 problems (including an impure call during render)
- `auth/VerifyDomain.jsx` `setState` in effect
- `App.jsx` has a **`rules-of-hooks` violation**, which can cause real runtime bugs; fix this first
- Large files: `onboarding-wizard/index.jsx` 968 lines, `agent-log/index.jsx` 801, `settings/index.jsx` 790, `executive-dashboard/index.jsx` 626, `tier-approval/index.jsx` 593

## Shared items we need to agree on

- **Replace `mock-auth` in M3 routes** with M4's real JWT middleware. The middleware exists; the swap needs both sides.
- **Add CI** (`tsc --noEmit`, `eslint`, build, tests) for the whole repo. M4 owns the backend structure, so it is best placed to set this up.

## Research-quality note

For the paper, make sure the Graduated Trust and agent-governance claims are backed by measured behaviour (logs, counts, scenarios), not only by the `verify-*` scripts passing. State what is simulated.

## Things done well

- Strict JWT secret check at startup (fails fast if missing or weak).
- Rate limiting with a production override guard, and trust-proxy handling.
- Separate central and tenant databases with Prisma schemas and migrations.
- Domain verification flow and RBAC are implemented, and the Bruno collection (`docs/bruno`) documents the API.
