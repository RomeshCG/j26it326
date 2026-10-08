# ML environment setup (Phase A)

## Windows

```powershell
cd ml
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
python m1_credit_risk/scripts/smoke_imports.py
```

You should see `M1 Phase A — imports OK`.

## Notes

- `.venv/` is gitignored — each teammate creates their own
- Activate the venv every time you work in `ml/`
- Deactivate with: `deactivate`
