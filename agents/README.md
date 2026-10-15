# IMFS Agents (M4)

Phase 10 agent runtime (FastAPI). Graduated Trust policies, tiers, and audit
live in the **Node** backend. This service scores with **a3-iforest-v2** and may
call Node’s internal dispatch API with a shared service key.

Keep ML training under `/ml`. Keep agent runtime code under `/agents`.

**Requires Python 3.11+.**

## Status (Phase B)

- Health check + Isolation Forest score (no Node call for `/v1/anomaly/score`)
- Env-based `NODE_API_URL` + `AGENT_SERVICE_KEY` (Node service auth)
- Separate `AGENTS_LOCAL_TOKEN` for callers of the dispatch-stub route
- `ENABLE_DISPATCH_STUB=false` by default (route returns 404 until enabled)
- Agent 3 scores with **RobustScaler → Isolation Forest** (`a3-iforest-v2`)
- Fail closed (HTTP 503) if model artifacts are missing or invalid
- Scores are **non-probabilistic** — never treat them as fraud likelihoods
- **Limitation:** amount-only spikes (`amount_spike`) are often missed; A3 does
  **not** detect all financial anomalies
- Phase A train/eval tooling remains under `ml/` (see `ml/README.md`)

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
# Edit .env: set real AGENT_SERVICE_KEY (same as backend). Leave ENABLE_DISPATCH_STUB=false.
# Ensure artifacts exist (from Phase A):
#   python -m ml.generate_synthetic_volume
#   python -m ml.train_iforest
```

Run **localhost only**:

```powershell
cd agents
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

Do **not** bind `0.0.0.0` for research testing unless network exposure is reviewed.

### Endpoints

- `GET /health` — ok; `modelReady`, frozen `threshold`, `dispatchStubEnabled`
- `POST /v1/anomaly/score` — local IF score only (no Node). Requires all 10
  allowlisted features. Returns score, decision, explanations, limitations.
- `POST /v1/anomaly/stub-score` — **deprecated** alias of `/v1/anomaly/score`
- `POST /v1/anomaly/dispatch-stub` — **disabled by default** (404). When enabled
  + local token set, scores with IF then POSTs `volume_spike_alert` to Node
  (Tier 4 `alert_only` remains Node-owned). No financial writes from this service.

### Score request shape

```json
{
  "features": {
    "spike_ratio_count": 1.0,
    "spike_ratio_amount": 1.0,
    "counterparty_spike_ratio": 1.0,
    "after_hours_share_1d": 0.08,
    "after_hours_delta_vs_7d": 0.0,
    "new_payee_share_1d": 0.05,
    "new_payee_delta_vs_7d": 0.0,
    "amount_cv_7d": 0.23,
    "count_z_vs_branch_hist": 0.0,
    "amount_z_vs_branch_hist": 0.0
  }
}
```

`confidence` is `score * 100` for Node’s 0–100 field — **display mapping only**.

## Security notes

- Prefer `--host 127.0.0.1`.
- Do not give this service PostgreSQL / tenant DB URLs.
- Do not send `tier`, `agentId`, `agentName`, or `policyId` to Node (client omits them).
- Keep `ENABLE_DISPATCH_STUB=false` until an approved live E2E test.

## Offline tests

```powershell
cd agents
.\.venv\Scripts\Activate.ps1
python -m ml.test_phase_a_stdlib
python -m app.test_phase_b_inference
```

## Phase A — train / eval

See **`ml/README.md`**. Artifacts (`a3-iforest-v2.joblib` + `.meta.json`) are
gitignored and must be generated locally before scoring works.
