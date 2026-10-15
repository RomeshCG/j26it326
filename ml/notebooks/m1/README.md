# M1 notebooks — how to use (beginner)

A Jupyter notebook is a file (`.ipynb`) with **cells**:

- **Markdown cells** = notes / headings (like a document)
- **Code cells** = Python you run one block at a time

You do **not** need to memorize Jupyter. In Cursor / VS Code you can run cells with buttons.

## 1. One-time setup

```powershell
cd "d:\Education\SLIIT\4th Year\rp-p\ml"
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m ipykernel install --user --name=imfs-m1 --display-name "Python (imfs-m1)"
```

## 2. Open the notebook

1. In Cursor: open  
   `ml/notebooks/m1/01_eda_train_shap.ipynb`
2. Top-right: choose kernel **Python (imfs-m1)** or your `ml/.venv` interpreter.
3. If asked to install Jupyter / recommended extensions → accept.

## 3. Run it

- **Run one cell:** click the cell → press `Shift + Enter`
- **Run all:** click **Run All** (top of the notebook)
- Run cells **from top to bottom** the first time (later cells need earlier ones)

If a cell shows `*` or keeps spinning, wait. If it errors, read the red message — often the kernel is wrong or a file path is missing.

## 4. What this notebook does

1. Loads **PAR + synthetic** merged training CSV  
2. Quick EDA charts (risk distribution, arrears)  
3. Trains XGBoost  
4. Shows a SHAP-style factor list for one loan  

## 5. Before the notebook (data prep)

Run these once in the terminal (venv active):

```powershell
cd "d:\Education\SLIIT\4th Year\rp-p\ml"
.\.venv\Scripts\Activate.ps1
python m1_credit_risk/scripts/generate_synthetic.py -n 3000
python m1_credit_risk/scripts/merge_par_synthetic.py
```

Then open the notebook and **Run All**.
