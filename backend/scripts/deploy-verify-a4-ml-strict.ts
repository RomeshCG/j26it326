/**
 * Deploy verification against local MicroFlow backend (default http://127.0.0.1:4000).
 * Reads gitignored .zz-test-credentials.local — never prints passwords/tokens.
 *
 *   npx tsx scripts/deploy-verify-a4-ml-strict.ts
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const API = (process.env.A4_E2E_API_BASE ?? "http://127.0.0.1:4000").replace(
  /\/$/,
  ""
)
const backendRoot = join(dirname(fileURLToPath(import.meta.url)), "..")
const CRED = join(backendRoot, ".zz-test-credentials.local")

type Cred = { role: string; email: string; password: string }
type Expect = "knowledge" | "grounded" | "unsupported" | "nlq"

function loadCred(): Cred {
  if (!existsSync(CRED)) throw new Error("missing ZZ credentials file")
  const text = readFileSync(CRED, "utf8")
  const blocks: Cred[] = []
  let cur: Partial<Cred> = {}
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (t.startsWith("role=")) cur.role = t.slice(5)
    else if (t.startsWith("email=")) cur.email = t.slice(6)
    else if (t.startsWith("password=")) cur.password = t.slice(9)
    if (cur.role && cur.email && cur.password) {
      blocks.push(cur as Cred)
      cur = {}
    }
  }
  for (const r of [
    "branch_manager",
    "executive",
    "finance_officer",
    "loan_officer",
  ]) {
    const hit = blocks.find((b) => b.role === r)
    if (hit) return hit
  }
  if (!blocks[0]) throw new Error("no creds")
  return blocks[0]
}

const CASES: Array<{ id: string; q: string; expect: Expect }> = [
  { id: "D01", q: "What is ROI in microfinance lending?", expect: "knowledge" },
  { id: "D02", q: "What is a loan?", expect: "knowledge" },
  {
    id: "D03",
    q: "When money is repaid late, how do lenders talk about that risk?",
    expect: "knowledge",
  },
  { id: "D04", q: "What is Graduated Trust in MicroFlow?", expect: "grounded" },
  {
    id: "D05",
    q: "What forces keep a glider aloft without an engine?",
    expect: "unsupported",
  },
  { id: "D06", q: "Which river runs through Cairo?", expect: "unsupported" },
  {
    id: "D07",
    q: "What particles orbit the nucleus of an atom?",
    expect: "unsupported",
  },
  {
    id: "D08",
    q: "How do you write a for-loop over a list in Python?",
    expect: "unsupported",
  },
  {
    id: "D09",
    q: "Explain progressive lending, then tell me who won the last Cricket World Cup",
    expect: "unsupported",
  },
  {
    id: "D10",
    q: "PAR30 NPL portfolio — which mountain is the tallest on Earth?",
    expect: "unsupported",
  },
  {
    id: "D11",
    q: "How many Tier 3 actions are awaiting approval?",
    expect: "nlq",
  },
]

function got(body: Record<string, unknown>): Expect | "other" {
  if (body.kind === "nlq") return "nlq"
  if (body.kind === "knowledge" && body.supported === true) {
    if (body.grounded === true || body.groundedTopic) return "grounded"
    return "knowledge"
  }
  if (body.kind === "unsupported" || body.supported === false)
    return "unsupported"
  return "other"
}

async function main(): Promise<number> {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error("health fail", health.status)
    return 2
  }
  const cred = loadCred()
  const login = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: cred.email, password: cred.password }),
  })
  const lb = (await login.json()) as Record<string, unknown>
  const token = typeof lb.token === "string" ? lb.token : null
  if (!token) {
    console.error("login fail", login.status, Object.keys(lb))
    return 2
  }

  const rows: Record<string, unknown>[] = []
  let pass = 0
  let fail = 0
  let strictSeen = false
  let enforceSeen = false

  for (const c of CASES) {
    const t0 = Date.now()
    const res = await fetch(`${API}/api/tenant/agent-actions/nlq/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: c.q }),
    })
    const body = (await res.json()) as Record<string, unknown>
    const ms = Date.now() - t0
    const actual = got(body)
    const gate = (body.domainGate ?? null) as Record<string, unknown> | null
    if (gate?.mode === "enforce") enforceSeen = true
    if (body.knowledgeStrictPrompt === true) strictSeen = true
    const ok = res.status === 200 && actual === c.expect
    if (ok) pass++
    else fail++
    rows.push({
      id: c.id,
      result: ok ? "PASS" : "FAIL",
      expect: c.expect,
      got: actual,
      ms,
      kind: body.kind,
      reason: body.reason ?? null,
      groundedTopic: body.groundedTopic ?? null,
      strict: body.knowledgeStrictPrompt === true,
      model: body.ollamaModel ?? null,
      gateMode: gate?.mode ?? null,
      gateReason: gate?.reason ?? null,
      mlPred: gate?.mlPred ?? null,
      pFinance: gate?.pFinance ?? null,
      stage0Allow: gate?.stage0Allow ?? null,
      answerHead:
        typeof body.answer === "string"
          ? body.answer.slice(0, 110).replace(/\s+/g, " ")
          : null,
    })
    console.log(JSON.stringify(rows[rows.length - 1]))
  }

  const summary = {
    api: API,
    auth_role: cred.role,
    pass,
    fail,
    enforceActive: enforceSeen,
    strictObserved: strictSeen,
    knownLimitation:
      "PAR30-class FR may still refuse; threshold unchanged",
  }
  console.log("summary=" + JSON.stringify(summary))
  const out = join(
    backendRoot,
    "..",
    "agents",
    "ml",
    "data",
    "a4_domain",
    "a4-deploy-verify.json"
  )
  writeFileSync(
    out,
    JSON.stringify({ summary, rows, ts: new Date().toISOString() }, null, 2),
    "utf8"
  )
  console.log("wrote " + out)
  if (!enforceSeen || !strictSeen) return 3
  return fail > 0 ? 1 : 0
}

main()
  .then((c) => process.exit(c))
  .catch((e) => {
    console.error(e)
    process.exit(2)
  })
