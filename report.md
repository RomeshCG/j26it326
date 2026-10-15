# Code Quality Report — IMFS Monorepo

Overall: **6.5 / 10. A decent foundation, but standards are not enforced.**

## Snapshot

| Area | Stack | Size (approx.) |
|---|---|---|
| `backend/` | Express 5 + TypeScript (strict) + Prisma (central + tenant DBs) + Zod | ~8.6k lines |
| `frontend/` | React 19 + Vite 8 + Tailwind 4 + shadcn/ui + Zustand (plain JS/JSX) | ~26k lines |
| `ml/` | Python (XGBoost, SHAP), notebooks | ~2k lines |
| `agents/`, `docs/`, `internalDocs/` | Mostly empty placeholders, docs, Bruno API collection | n/a |

76 commits from 4 contributors.

## What is good

- **Backend TypeScript is strict.** `strict: true` is set and `tsc --noEmit` passes with zero errors.
- **Clear backend layout.** `routes/`, `lib/`, `middleware/` are separate. Domain logic such as `agent-engine`, `domain-service` and `provisioning-service` lives in `lib/`, not in route handlers.
- **Input validation.** Zod is used on routes that take input, and tenant isolation is a first-class concern (central vs tenant Prisma clients).
- **Secrets are handled correctly.** `.env` is git-ignored, `.env.example` files exist, and no hardcoded credentials were found in `backend/src`.
- **Documentation is above student-project average.** Every package has a README. `ml/` has SETUP and API_CONTRACT docs, and there is a Bruno API collection.
- **Verification scripts exist.** There are 8+ `verify-*.ts` scripts covering auth/RBAC, rate limiting, tenant routing and graduated trust.
- **Good commit messages.** Most commits are descriptive and phase-tagged. PR-based merges are used.
- **Modern, consistent frontend tooling.** ESLint with react-hooks rules and a shadcn component structure. Frontend code is split by module (`c2`, `c3`, `c4`).

## Problems (ranked)

### High
1. **No automated tests and no CI.** There is no `.github/` workflow and no test runner (Jest, Vitest or pytest) anywhere. The `verify-*.ts` scripts are manual integration checks, not repeatable tests. One of them is 2,484 lines.
2. **Frontend lint fails: 75 problems (73 errors, 2 warnings).**
   - 47 unused variables
   - 12 `react-refresh/only-export-components`
   - 8 `setState` called inside an effect
   - 1 `rules-of-hooks` violation, which is a real bug risk
   - 2 impure-render calls
   - 2 `exhaustive-deps` warnings

   No pre-commit hook or CI gate stops these from being merged.
3. **Two auth systems coexist.** The M3 routes (8 files) still use `lib/m3/mock-auth.ts`, which trusts `x-mock-user-id` and `x-mock-role` headers. The file's own header says it should be replaced by the real JWT middleware. If it ships as-is, any client can claim any role.

### Medium
4. **Error handling leaks internals.** Routes return `err.message` in 500 responses (for example `m3/loans.ts`). The same try/catch is copy-pasted per handler instead of using one Express error middleware.
5. **Validation is inconsistent.** 8 route files have no Zod usage. Several are GET-only, but the `m3` routes pass query strings through manual casts (`req.query.x as string | string[]`).
6. **Loose typing.** 15 uses of `any`, `as any` or `@ts-ignore` in the backend.
7. **Frontend is untyped.** All 109 files are `.jsx` with no TypeScript and no PropTypes, although `jsconfig.json` exists. The frontend and backend share no types or API contract.
8. **Very large files.** `onboarding-wizard/index.jsx` (968 lines), `PAndLReport.jsx` (923), `SocialPerformance.jsx` (859), `agent-log/index.jsx` (801), `agent-engine.ts` (716), `domain-service.ts` (697). These should be split.
9. **Backend has no lint or format tooling.** There is no ESLint or Prettier config for backend or ML, no formatter anywhere, and no `lint` or `test` script in `backend/package.json`.

### Low
10. **Hygiene.**
    - `frontend/package-lock.json` is modified and uncommitted.
    - There is an extra root `package-lock.json` with no root `package.json`.
    - `routes/_example.ts` is leftover scaffolding.
    - `console.log` / `console.error` appear 33 times instead of a logger.
    - 28 `.keep` placeholder files and empty `agents/`, `ml/m2_mission_intel/`.
    - `mock-data.js` (888 lines) lives in `src/`.
11. **ML code.** The Python has no tests, no linter and a short `requirements.txt` (12 lines, not pinned), and the notebooks are committed with outputs. A Python venv exists locally at `ml/.venv`; it is git-ignored, which is correct.
12. **Commit history.** Contributor identities are split (`chinookz`, `Suneth2220`, `RomeshG` and `Romesh Gamadikari` appear as separate authors). Set `.mailmap` or a consistent git config.

## Scorecard

| Category | Score |
|---|---|
| Architecture / structure | 7.5 |
| Type safety (backend) | 8 |
| Type safety (frontend) | 4 |
| Linting / formatting | 4 |
| Testing / CI | 2 |
| Security practices | 6 |
| Error handling | 5 |
| Documentation | 8 |
| Git / team workflow | 7 |
| **Overall** | **~6.5** |

## Fix first (best value for effort)

1. Fix the 73 ESLint errors, starting with the `rules-of-hooks` one and unused vars. Then add `npm run lint` to CI.
2. Add a GitHub Actions workflow that runs `tsc --noEmit`, `eslint` and a build for both packages.
3. Replace `mock-auth` with the real `middleware/auth.ts` on all M3 routes.
4. Add a single Express error-handling middleware and stop returning `err.message` to clients.
5. Turn the most important `verify-*.ts` scripts into a Vitest suite (auth/RBAC, tenant routing, loan lifecycle).
6. Add ESLint and Prettier to the backend, and `ruff` to `ml/`.
7. Split the files over 700 lines.

## Method and limits

I read the config files, ran `eslint` on the frontend and `tsc --noEmit` on the backend, sampled a route file and the auth mock, and counted patterns with grep. I did not read every file, run the app, or review the ML models. Scores are my judgment, not a formal metric.
