# Team guide: shared public data + how to make synthetic data

**Who this is for:** M2, M3, M4 (and M1 reference).  
**Goal:** You do **not** need ML expertise. Follow the paths and copy-paste steps.

**Where files live (on M1’s machine / shared drive):**

```text
ml/shared/data/
```

Copy this folder to your laptop (USB / Google Drive / private share).  
**Do not commit these big files to GitHub** (they are gitignored).

**Primary Sri Lanka loan book (from partner):** ask M1 for  
`par30_clean_no_pii.csv` — that is still your **#1 real dataset**. Public files below are **support / benchmarks / synthetic seeds**.

---

## 1. What is already in `ml/shared/data`

| File | What it is | Ready to use? |
|------|------------|---------------|
| `GlobalFindexDatabase2025.csv` | World Bank Findex — country financial inclusion rates by year / group | **Yes** |
| `MFIsdata_mixmarket.xlsx` | MIX Market MFI stats 2005–2015 (borrowers, % female, assets, etc.) | **Yes** |
| `mix-market-social-performance-dataset.xlsx` | MIX social goals / SPI-style flags (women, rural, poverty, …) | **Yes** |
| `kiva-microloans-a-data-exploration.ipynb` | Kaggle **notebook only** (example exploration) | **Not the data** — still download Kiva CSVs (see §5) |

### Quick facts

- **Findex:** includes **Sri Lanka** rows (account %, borrow %, etc. by year).
- **MIX MFI file:** includes **Sri Lanka MFIs** (e.g. Lak Jaya) with `% female borrowers`, active borrowers, etc.
- **MIX social performance:** many columns on target markets (women, rural/urban, poverty, education, …).

---

## 2. Who uses what (module map)

### Everyone

| Dataset | Use |
|---------|-----|
| **PAR clean** (from M1) | Real loans, arrears, paid %, products, branches |
| Public files below | Benchmarks + synthetic priors — **not** a replacement for PAR |

### M1 — Credit risk (mostly done)

| Dataset | Use |
|---------|-----|
| PAR + synthetic (already merged) | Train risk % + SHAP |
| Findex / MIX | Optional report priors (“women-heavy outreach in LK MFIs”) |
| Kiva (when downloaded) | Optional second experiment only |

### M2 — Mission intel / social / finance KPIs (C2)

| Dataset | Use |
|---------|-----|
| **PAR** | Portfolio KPIs: arrears, product mix, branch mix, paid % |
| **MIX social performance** | Social goal indicators → mission / SPI dashboard |
| **MIX MFI data** | Peer benchmarks: % female, outreach, avg loan size |
| **Findex** | Country-level inclusion context (Sri Lanka charts) |
| **Synthetic CoA / journals** | P&L, balance sheet, cash flow (no public ledger) — see §4 |
| **Kiva** (when you have CSV) | Loan purpose / gender / sector proxies |

### M3 — EWS / collections / field ops (C3)

| Dataset | Use |
|---------|-----|
| **PAR** | Primary: arrears, balances, paid %, tenure, last paid fields |
| **Kiva** (when CSV exists) | Application-like borrower/loan fields |
| **Synthetic payment schedules** | Build from PAR installment + tenure if no full history — see §4 |
| Home Credit / Give Me Some Credit | **Optional practice only** — not required if you have PAR |

### M4 — Graduated Trust / HR / agents (C4)

| Dataset | Use |
|---------|-----|
| Public MF files | Almost unused for training |
| **Synthetic employees + agent logs** | Required — see §4 |
| M1/M3 API outputs | Agents consume risk/EWS scores |

---

## 3. One-time setup (every member)

```powershell
cd "path\to\rp-p\ml"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Put shared files here (same structure as M1):

```text
ml/shared/data/
  GlobalFindexDatabase2025.csv
  MFIsdata_mixmarket.xlsx
  mix-market-social-performance-dataset.xlsx
  (optional) kiva_loans.csv   ← after you download
```

PAR from M1:

```text
ml/m2_mission_intel/data/private/par30_clean_no_pii.csv
  or
ml/m3_ews/data/private/par30_clean_no_pii.csv
```

---

## 4. How to make synthetic data (beginner recipes)

### Rule for the whole team

1. **Real spine** = PAR (and public stats for country/MFI priors).  
2. **Synthetic** = fill gaps the partner did not give.  
3. Always add a column `data_source` = `par` | `public_prior` | `synthetic`.  
4. In the report write: *“PAR + public benchmarks + controlled synthetic enrichment.”*

---

### Recipe A — M2: synthetic finance statements (P&L / BS / cash flow)

**You cannot download real MFI books.** Generate them.

Idea:

1. From PAR, compute monthly-ish totals:  
   `disbursed ≈ sum(contract_amount)`, `collections ≈ sum(total_paid)`, `arrears ≈ sum(arr_cap+arr_int)`.
2. Build a simple chart of accounts (Cash, Loan Portfolio, Interest Income, Operating Expense, …).
3. Create journal lines that roughly match those totals (interest income, opex as % of portfolio, etc.).
4. Save under `ml/m2_mission_intel/data/synthetic/journals_v1.csv` (gitignored).

Minimal starter columns for journals:

```text
date, account_code, account_name, debit, credit, memo, data_source
```

You can do this in Excel first, then export CSV. Or ask your AI assistant:  
*“Generate 12 months of simple MFI journals consistent with these PAR totals: …”*

---

### Recipe B — M2: mission / social KPIs from MIX + Findex

**Not synthetic — use the real public files.**

Example (Python, after activating venv):

```python
import pandas as pd

# Sri Lanka inclusion (Findex)
findex = pd.read_csv("shared/data/GlobalFindexDatabase2025.csv")
lk = findex[findex["countrynewwb"] == "Sri Lanka"]
print(lk[["year", "group", "account_t_d", "borrow_any_t_d"]].head(20))

# MIX MFI peers (Sri Lanka)
mix = pd.read_excel("shared/data/MFIsdata_mixmarket.xlsx")
lk_mfi = mix[mix["Country"].str.contains("Sri", case=False, na=False)]
print(lk_mfi[["MFIname", "year", "Percentoffemaleborrowers", "Numberofactiveborrowers"]].tail(20))

# Social goals (MIX SPI-style)
spi = pd.read_excel("shared/data/mix-market-social-performance-dataset.xlsx", sheet_name=0)
print(spi.columns[:15].tolist())
```

Use these numbers as **dashboard benchmarks** (e.g. “peer MFIs ~X% female”).  
Compare to your PAR product/branch mix (and synthetic gender on PAR if M1 enriched demographics).

---

### Recipe C — M3: synthetic payment timeline from one PAR loan

PAR often has installment + tenure + last paid, but not a full schedule. Create one:

For each loan:

- `n = tenure` periods  
- each due = `installment`  
- mark some periods late if `arr_cap + arr_int > 0`  
- save:

```text
loan_id, period, due_date, amount_due, amount_paid, days_late, data_source=synthetic_schedule
```

Ask AI: *“Given these PAR columns, generate a weekly payment schedule CSV with random late payments proportional to arrears.”*

---

### Recipe D — M4: synthetic HR + Graduated Trust logs

No public dataset needed.

**Employees (example columns):**

```text
employee_id, name, role, branch, join_date, salary, data_source=synthetic
```

Roles: `loan_officer`, `branch_manager`, `credit_manager`, `admin`, …

**Agent / trust events:**

```text
event_id, timestamp, agent_name, action, risk_pct, decision, trust_tier, approved_by, data_source=synthetic
```

`decision` = `auto_approve` | `suggest` | `escalate` | `reject`  
Generate 200–500 rows with random timestamps.

---

### Recipe E — Optional: borrow Kiva shapes for synthetic borrowers

After you download Kiva CSV:

1. Keep sector, gender, loan_amount, country, repayment_interval.  
2. Filter or re-weight toward South Asia if possible.  
3. **Do not** pretend Kiva rows are your partner’s clients.  
4. Join ideas to PAR only at **distribution** level (e.g. “sample genders with same % as Kiva women in Agriculture”).

---

## 5. Still missing — download Kiva data (not just the notebook)

You currently have only:

`kiva-microloans-a-data-exploration.ipynb`

That teaches exploration; it does **not** include the loan table.

**Someone (M2 or M3) should download** (Kaggle / data.world), then place e.g.:

```text
ml/shared/data/kiva/
  kiva_loans.csv
  (any other kiva_* files)
```

Then tell the group in chat. Until then, M2/M3 can start with **PAR + MIX + Findex**.

---

## 6. Suggested work order (no ML experience needed)

### M2 checklist

1. [ ] Copy `ml/shared/data` + PAR clean from M1  
2. [ ] Open MIX + Findex; filter Sri Lanka; screenshot 2–3 charts for mission board  
3. [ ] From PAR: branch / product / arrears KPI tables  
4. [ ] Generate synthetic journals (Recipe A) for finance screens  
5. [ ] Wire numbers into C2 UI (mock JSON is OK at first)

### M3 checklist

1. [ ] Copy PAR clean  
2. [ ] Define EWS label from arrears / paid % (same idea as M1 `risk_pct`)  
3. [ ] Build synthetic schedules (Recipe C) for collection timeline UI  
4. [ ] Optional: add Kiva when downloaded  
5. [ ] Expose simple API or JSON for field screens

### M4 checklist

1. [ ] Skip heavy public MF downloads  
2. [ ] Generate employees + agent logs (Recipe D)  
3. [ ] Call M1 risk demo / API when available for trust-tier rules  

---

## 7. Paths cheat sheet

| Thing | Path |
|-------|------|
| Public downloads | `ml/shared/data/` |
| This guide | `docs/TEAM_DATA_AND_SYNTHETIC_GUIDE.md` |
| Older overview | `docs/SHARED_DATASETS.md` |
| M1 clean PAR (ask M1) | `…/par30_clean_no_pii.csv` |
| M1 train merge example | `ml/m1_credit_risk/scripts/merge_par_synthetic.py` |
| M1 notebook example | `ml/notebooks/m1/01_eda_train_shap.ipynb` |

---

## 8. Rules (please follow)

1. Never commit PAR, NIC, or raw partner Excel.  
2. Never commit large CSVs under `ml/shared/data` to git if avoidable — share privately.  
3. Label synthetic rows with `data_source`.  
4. Public data = **proxy / benchmark**, not “our customers.”  
5. If stuck: ask M1 for the PAR file + point your AI at this markdown.

---

**Bottom line for members:**  
Use **PAR** for real loans. Use **Findex + MIX (+ SPI)** for mission/social benchmarks. **Generate** finance ledgers, payment schedules, and HR/trust logs. **Download real Kiva CSVs** if you want loan-purpose/gender micro-data (the `.ipynb` alone is not enough).
