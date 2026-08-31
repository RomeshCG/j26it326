const STORAGE_KEY = "mf_decision_log"

function readLogs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLogs(logs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.slice(0, 100)))
}

export function recordDecision(entry) {
  const record = {
    id: `DEC-${Date.now()}`,
    timestamp: new Date().toISOString(),
    mode: "ai-assisted",
    ...entry,
  }
  const logs = readLogs()
  logs.unshift(record)
  writeLogs(logs)
  return record
}

export function listDecisionLogs() {
  return readLogs()
}
