# A4 domain — review log

**Status:** Batches 1–4 applied. Wave-2 expansion. Improve-v1 trained. **Node JSON + gate integrated; `enforce` OFF.**

| Item | State |
|------|--------|
| Eligible | **218** |
| Preferred model | improve-v1 `lr_mindf1` |
| JSON + Node parity | **max \|Δp\| ≈ 0** (`verify:a4-domain-clf` 235 pass) |
| Gate | `off` (default) / `shadow` / `enforce` |
| Recommended τ | **0.45** (`ml_tau`) |
| Strict prompt flag | `A4_KNOWLEDGE_STRICT_PROMPT` default off |
| Activation | **Do not enable enforce** without approval |
| Docs | [`INTEGRATION_EXPERIMENT.md`](./INTEGRATION_EXPERIMENT.md) |
