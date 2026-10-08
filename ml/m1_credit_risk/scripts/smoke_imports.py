"""Phase A smoke test — run from ml/ with venv active:
python m1_credit_risk/scripts/smoke_imports.py
"""

from __future__ import annotations


def main() -> None:
    import dotenv
    import joblib
    import numpy
    import pandas
    import shap
    import sklearn
    import xgboost

    print("M1 Phase A - imports OK")
    print(f"  numpy      {numpy.__version__}")
    print(f"  pandas     {pandas.__version__}")
    print(f"  sklearn    {sklearn.__version__}")
    print(f"  xgboost    {xgboost.__version__}")
    print(f"  shap       {shap.__version__}")
    print(f"  joblib     {joblib.__version__}")
    print(f"  dotenv     {getattr(dotenv, '__version__', 'installed')}")


if __name__ == "__main__":
    main()
