/**
 * M4 Stage 1 Slice 1 — offline evaluation runner (functional regression only).
 *
 * Runs existing verify scripts in-process via child processes. No DB, Ollama,
 * network dispatches, or A3 Python accuracy numbers.
 *
 * Usage (from backend/):
 *   npm run eval:offline
 *
 * Writes gitignored artifacts under backend/eval-results/.
 */
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { execSync } from "node:child_process"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const backendRoot = path.resolve(__dirname, "..")
const outDir = path.join(backendRoot, "eval-results")

type SuiteId =
  | "a1-compliance"
  | "a1-fixtures"
  | "a1-fixture-guards"
  | "a2-budget"
  | "a2-fixtures"
  | "a2-fixture-guards"
  | "a4-nlq"
  | "zz-seed-safety"
  | "safe-api-errors"
  | "graduated-trust"

type SuiteKind = "functional_regression" | "rule_fixture_agreement"

interface SuiteSpec {
  id: SuiteId
  label: string
  /** Existing package.json script (preferred over ad-hoc tsx paths). */
  npmScript: string
  /** Functional regression or labelled rule-fixture agreement — not ML accuracy. */
  kind: SuiteKind
}

interface SuiteResult {
  id: SuiteId
  label: string
  kind: SuiteKind
  passed: boolean
  exitCode: number | null
  durationMs: number
  assertionsPassed: number | null
  assertionsFailed: number | null
  parseNote: string | null
}

interface EvalReport {
  schemaVersion: 1
  reportKind: "m4_offline_functional_regression"
  disclaimer: string
  generatedAt: string
  gitSha: string | null
  nodeVersion: string
  suites: SuiteResult[]
  summary: {
    totalSuites: number
    suitesPassed: number
    suitesFailed: number
    allPassed: boolean
  }
  excluded: string[]
}

const DISCLAIMER =
  "These results are FUNCTIONAL REGRESSION and/or deterministic RULE-FIXTURE " +
  "AGREEMENT checks. They are NOT AI/ML accuracy metrics (no intent confusion " +
  "matrices, no A3 P/R/F1, no live ZZ governance rates, no real M2 alert " +
  "effectiveness). Do not cite suite pass rates as model accuracy."

const SUITES: SuiteSpec[] = [
  {
    id: "a1-compliance",
    label: "A1 compliance readiness (offline)",
    npmScript: "verify:a1-compliance",
    kind: "functional_regression",
  },
  {
    id: "a1-fixtures",
    label: "A1 labelled readiness fixtures (rule agreement)",
    npmScript: "verify:a1-fixtures",
    kind: "rule_fixture_agreement",
  },
  {
    id: "a1-fixture-guards",
    label: "A1 fixture fail-closed guards (category/S0)",
    npmScript: "verify:a1-fixture-guards",
    kind: "functional_regression",
  },
  {
    id: "a2-budget",
    label: "A2 budget threshold (offline)",
    npmScript: "verify:a2-budget",
    kind: "functional_regression",
  },
  {
    id: "a2-fixtures",
    label: "A2 labelled threshold/validation fixtures (rule agreement)",
    npmScript: "verify:a2-fixtures",
    kind: "rule_fixture_agreement",
  },
  {
    id: "a2-fixture-guards",
    label: "A2 fixture fail-closed guards (overrides/category)",
    npmScript: "verify:a2-fixture-guards",
    kind: "functional_regression",
  },
  {
    id: "a4-nlq",
    label: "A4 NLQ unit/offline (no live Ollama)",
    npmScript: "verify:a4-nlq",
    kind: "functional_regression",
  },
  {
    id: "zz-seed-safety",
    label: "ZZ seed safety helpers (offline)",
    npmScript: "verify:zz-seed-safety",
    kind: "functional_regression",
  },
  {
    id: "safe-api-errors",
    label: "Safe API error contracts (source)",
    npmScript: "verify:safe-api-errors",
    kind: "functional_regression",
  },
  {
    id: "graduated-trust",
    label: "Graduated Trust engine (offline fake Prisma)",
    npmScript: "verify:graduated-trust",
    kind: "functional_regression",
  },
]

function gitSha(): string | null {
  try {
    return execSync("git rev-parse HEAD", {
      cwd: backendRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

/** Parse assertion totals when scripts print a reliable summary line. */
export function parseAssertionCounts(combined: string): {
  passed: number | null
  failed: number | null
  note: string | null
} {
  // A1/A2/A4/zz/safe: "62 passed, 0 failed"
  const simple = combined.match(/(\d+)\s+passed,\s+(\d+)\s+failed/i)
  if (simple) {
    return {
      passed: Number(simple[1]),
      failed: Number(simple[2]),
      note: null,
    }
  }
  // GT: "Verification Complete: 123 Passed, 0 Failed"
  const gt = combined.match(
    /Verification Complete:\s+(\d+)\s+Passed,\s+(\d+)\s+Failed/i
  )
  if (gt) {
    return {
      passed: Number(gt[1]),
      failed: Number(gt[2]),
      note: null,
    }
  }
  return {
    passed: null,
    failed: null,
    note: "Assertion counts not parsed from script output",
  }
}

/**
 * Suite PASS only when the process started, exited 0, and (if parsed)
 * reported zero assertion failures. Unparsed counts stay null and do not
 * invent a failure — exit code remains authoritative in that case.
 */
export function isSuitePassed(opts: {
  exitCode: number | null
  spawnFailed: boolean
  assertionsFailed: number | null
}): boolean {
  if (opts.spawnFailed) return false
  if (opts.exitCode !== 0) return false
  if (opts.assertionsFailed != null && opts.assertionsFailed > 0) return false
  return true
}

function runSuite(spec: SuiteSpec): SuiteResult {
  const started = Date.now()
  // shell:true — reliable under Windows PowerShell 5.1 for npm.cmd
  const child = spawnSync("npm", ["run", "-s", spec.npmScript], {
    cwd: backendRoot,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", npm_config_loglevel: "error" },
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
    windowsHide: true,
  })
  const durationMs = Date.now() - started
  const combined = `${child.stdout ?? ""}\n${child.stderr ?? ""}`
  const counts = parseAssertionCounts(combined)
  const exitCode = child.status
  const spawnFailed = Boolean(child.error) || exitCode === null
  const passed = isSuitePassed({
    exitCode,
    spawnFailed,
    assertionsFailed: counts.failed,
  })

  // Stream a short console progress line (not full suite logs)
  const countLabel =
    counts.passed != null
      ? `${counts.passed} passed / ${counts.failed ?? "?"} failed`
      : "counts n/a"
  console.log(
    `  ${passed ? "OK" : "FAIL"}  ${spec.id}  (${durationMs} ms, ${countLabel})`
  )

  return {
    id: spec.id,
    label: spec.label,
    kind: spec.kind,
    passed,
    exitCode,
    durationMs,
    assertionsPassed: counts.passed,
    assertionsFailed: counts.failed,
    parseNote: counts.note,
  }
}

function writeMarkdown(report: EvalReport, filePath: string): void {
  const lines: string[] = [
    "# M4 offline evaluation — functional regression",
    "",
    `Generated: ${report.generatedAt}`,
    `Git SHA: ${report.gitSha ?? "unknown"}`,
    `Node: ${report.nodeVersion}`,
    "",
    "> **Disclaimer:** " + report.disclaimer,
    "",
    "## Summary",
    "",
    `- Suites: ${report.summary.suitesPassed}/${report.summary.totalSuites} passed`,
    `- All passed: ${report.summary.allPassed}`,
    "",
    "## Suites",
    "",
    "| Suite | Result | Assertions (pass/fail) | Duration (ms) |",
    "|-------|--------|------------------------|---------------|",
  ]
  for (const s of report.suites) {
    const asserts =
      s.assertionsPassed != null
        ? `${s.assertionsPassed}/${s.assertionsFailed ?? "?"}`
        : "n/a"
    lines.push(
      `| ${s.id} | ${s.passed ? "PASS" : "FAIL"} | ${asserts} | ${s.durationMs} |`
    )
  }
  lines.push(
    "",
    "## Excluded from this runner",
    "",
    ...report.excluded.map((e) => `- ${e}`),
    "",
    "## How to re-run",
    "",
    "```powershell",
    "cd backend",
    "npm run eval:offline",
    "```",
    ""
  )
  fs.writeFileSync(filePath, lines.join("\n"), "utf8")
}

function main(): void {
  console.log("\n=== M4 offline eval (functional regression only) ===\n")
  console.log(DISCLAIMER + "\n")

  fs.mkdirSync(outDir, { recursive: true })

  const suites: SuiteResult[] = []
  for (const spec of SUITES) {
    suites.push(runSuite(spec))
  }

  const suitesFailed = suites.filter((s) => !s.passed).length
  const suitesPassed = suites.length - suitesFailed
  const report: EvalReport = {
    schemaVersion: 1,
    reportKind: "m4_offline_functional_regression",
    disclaimer: DISCLAIMER,
    generatedAt: new Date().toISOString(),
    gitSha: gitSha(),
    nodeVersion: process.version,
    suites,
    summary: {
      totalSuites: suites.length,
      suitesPassed,
      suitesFailed,
      allPassed: suitesFailed === 0,
    },
    excluded: [
      "A3 Isolation Forest train/eval metrics (Python; reproduce separately)",
      "A1 SoD/hash-gate labelled fixtures (later slice)",
      "GT labelled fixture pack (later slice)",
      "A2 dedupe fixtures (later extension)",
      "Live ZZ E2E governance scenarios",
      "Live Ollama A4 intent accuracy / confusion matrix",
      "DB-backed verifies (auth-rbac, tenant provisioning, stub-api, etc.)",
    ],
  }

  const stamp = report.generatedAt.replace(/[:.]/g, "-")
  const jsonPath = path.join(outDir, `offline-eval-${stamp}.json`)
  const mdPath = path.join(outDir, `offline-eval-${stamp}.md`)
  const latestJson = path.join(outDir, "offline-eval-latest.json")
  const latestMd = path.join(outDir, "offline-eval-latest.md")

  const jsonBody = JSON.stringify(report, null, 2)
  fs.writeFileSync(jsonPath, jsonBody, "utf8")
  fs.writeFileSync(latestJson, jsonBody, "utf8")
  writeMarkdown(report, mdPath)
  writeMarkdown(report, latestMd)

  console.log(`\nWrote ${path.relative(backendRoot, latestJson)}`)
  console.log(`Wrote ${path.relative(backendRoot, latestMd)}`)
  console.log(
    `\nSummary: ${suitesPassed}/${suites.length} suites passed` +
      (suitesFailed ? ` (${suitesFailed} failed)` : "")
  )

  process.exit(suitesFailed === 0 ? 0 : 1)
}

const isDirectRun =
  process.argv[1] != null &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectRun) {
  main()
}
