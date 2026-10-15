# IMFS Agents (M4)

Phase 10 agent runtime (FastAPI). Graduated Trust policies, tiers, and audit
live in the **Node** backend. This service only scores (stub today) and calls
Node’s internal dispatch API with a shared service key.

Keep ML training under `/ml`. Keep agent runtime code under `/agents`.

**Requires Python 3.11+.**

## S0c status

- Health check + stub score (no Node call, no dispatch credentials required)
- Env-based `NODE_API_URL` + `AGENT_SERVICE_KEY` (Node service auth)
- Separate `AGENTS_LOCAL_TOKEN` for callers of the dispatch-stub route
- `ENABLE_DISPATCH_STUB=false` by default (route returns 404 until enabled)
- Agent 3 **stub** anomaly score (no Isolation Forest yet)

## Two secrets (do not mix them)

| Variable | Purpose |
|----------|---------|
| `AGENT_SERVICE_KEY` | Agents → Node (`X-Agent-Service-Key`). Must match `backend/.env`. |
| `AGENTS_LOCAL_TOKEN` | You → Agents (`X-Agents-Local-Token`) for `dispatch-stub` only. |

Never commit real values. Never use the same string for both in production-like setups if avoidable.

## Local setup (Windows)

```powershell
cd agents
# Python 3.11+ required
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
# Edit .env: set real AGENT_SERVICE_KEY (same as backend). Leave ENABLE_DISPATCH_STUB=false until S0d.
```

Run **localhost only**:

```powershell
cd agents
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Do **not** bind `0.0.0.0` for research testing unless network exposure is reviewed.

### Endpoints

- `GET /health` — ok; shows whether Node service key is configured (not the value); `dispatchStubEnabled`
- `POST /v1/anomaly/stub-score` — local stub score only (no Node, no local token)
- `POST /v1/anomaly/dispatch-stub` — **disabled by default** (404). When `ENABLE_DISPATCH_STUB=true` and `AGENTS_LOCAL_TOKEN` is set, requires header `X-Agents-Local-Token`, then calls Node with `AGENT_SERVICE_KEY`

## Security notes

- Prefer `--host 127.0.0.1`.
- Do not give this service PostgreSQL / tenant DB URLs.
- Do not send `tier`, `agentId`, `agentName`, or `policyId` to Node (client omits them).
- Dispatch stub stays off until an approved S0d test.
