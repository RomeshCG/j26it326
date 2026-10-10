# Shared datasets for IMFS (M1–M4)

**Primary real extract:** M1’s cleaned partner PAR portfolio file  
(~7k loan/performance rows). Other modules should treat this as the **Sri Lanka / IMFS-shaped spine**, then add public or synthetic data for what the export does not contain.

Partner will not provide more finance-side extracts for now. Fill gaps with **public downloads** + **documented synthetic** data. Never commit private / PAR / large CSVs to git — keep them under `ml/**/data/private/` or `raw/` (gitignored).

---

## 1. Primary dataset (everyone)

| Item | Detail |
|------|--------|
| **What** | Cleaned PAR / portfolio export (PII stripped) |
| **Owner** | M1 holds the clean copy; share via private drive / USB, not GitHub |
| **Suggested local path** | `ml/shared/data/private/par30_clean_no_pii.csv` (or copy into your module’s `data/private/`) |
| **Use as** | Primary loan performance + product + branch/center signals |

### Columns to expect (after M1 clean)

**Keep / use:** `BRANCH NAME`, `CENTER`, `PRODUCT CATEGORY`, `PRODUCT TYPE`, `PRODUCT`, `CONTRACT AMOUNT`, `INTEREST` (LKR amount), `INSTALLMENT`, `TENURE`, balances, `BAL. PENALTY`, `BAL. CHARGES`, `ARR. CAP.`, `ARR. INT.`, paid fields, `PAID %`, `TOTAL PAID`, `OVER PAYMENT`, plus confirmed flags (`DEBTOR`, `STOCK`, `PORTFOLIO`) when M1 documents them.

**Drop / never share raw:** `CUSTOMER NAME`, `CUSTOMER NIC`, `CONTACT NO.` — replace codes with anonymous ids.

### What this primary file is good for

| Module | Use |
|--------|-----|
| **M1** | Train risk % model + SHAP |
| **M2** | Portfolio KPIs, arrears/PAR-style stress, product/branch mix |
| **M3** | Loan book, collections stress, EWS features from arrears / paid % |
| **M4** | Optional context for agent demos (not training HR/trust) |

---

## 2. What each member should download / generate

### M1 — Credit risk (C1)

| Source | Action | Role |
|--------|--------|------|
| **PAR clean (primary)** | Get from M1 private share | Main train/eval |
| **Synthetic enrichment** | Run `ml/m1_credit_risk` generators | Demographics / gaps |
| **Kiva** (optional secondary) | [Kaggle – Kiva](https://www.kaggle.com/datasets) search “Kiva” | Extra volume / domain adaptation only |

### M2 — Mission intel / social / finance KPIs (C2)

| Source | Download / create | Role |
|--------|-------------------|------|
| **PAR clean (primary)** | Same as M1 | Portfolio + product + arrears KPIs |
| **Kiva microloans** | Kaggle / data.world “Kiva” | Gender, sector, purpose → social / mission proxies |
| **World Bank Findex** | [datatopics.worldbank.org/financialinclusion](https://www.worldbank.org/en/publication/globalfindex) | Country-level inclusion priors (LK) |
| **MIX / CGAP / SPTF** | Search archives for social performance indicators | SPI-style KPI definitions / peer examples |
| **Finance ledgers** | **Generate synthetic** CoA + journals | P&L / BS / cash flow screens — no public MFI books |

**M2 does not wait on partner for P&L data.** Structure = synthetic; portfolio truth = PAR + Kiva proxies.

### M3 — EWS / field ops / collections (C3)

| Source | Download / create | Role |
|--------|-------------------|------|
| **PAR clean (primary)** | Same as M1 | Arrears, paid %, balances → delinquency / EWS labels |
| **Kiva** | Same as M2 | Application-like borrower/loan fields |
| **Payment timelines** | **Synthesize** from installment + tenure + random late payments | Temporal / collection demos if no DPD history |
| **Optional Kaggle credit** | e.g. Home Credit, Give Me Some Credit | Method practice only — not Sri Lanka truth |

**M3 labels should lean on PAR arrears**, not Lending Club as ground truth.

### M4 — Graduated Trust / HR / agents (C4)

| Source | Download / create | Role |
|--------|-------------------|------|
| **PAR / M1–M3 outputs** | Consume risk/EWS APIs or sample JSON | Agents act on scores, not raw PAR training |
| **HR / payroll** | **Synthetic employees** | No usable public MFI HR set |
| **Trust / approvals** | **Synthetic agent action logs** (approve / reject / escalate) | Graduated Trust demos |
| **Policy text** | CBSL / circular PDFs (read-only) | Report wording — not tabular ML |

**M4:** do not hunt Kaggle for “trust agents.” Generate event logs.

---

## 3. One shared public download (recommended for all)

**Kiva microloans** — best single free set that helps:

- M1 — demographic / sector context  
- M2 — mission / social proxies  
- M3 — application-shaped fields  

Still: **PAR remains primary performance truth** for the RP story.

---

## 4. Local folder convention

```text
ml/
  shared/data/private/     ← PAR clean + shared extracts (gitignored)
  m1_credit_risk/data/...
  m2_mission_intel/data/...
  m3_ews/data/...
```

Rules:

1. Generator **code** → git  
2. Data **files** → local / private drive only  
3. In reports: say *“IMFS-like PAR extract + public proxies + synthetic enrichment”*

---

## 5. How to get the primary PAR file from M1

1. M1 cleans export (drop PII, confirm INTEREST = LKR amount).  
2. Saves `par30_clean_no_pii.csv` privately.  
3. Shares with M2/M3 via agreed private channel.  
4. Each member copies into their `data/private/` and trains / builds KPIs locally.

Until the clean file is shared, M2/M3 can start on **Kiva + synthetic**; swap in PAR columns when available (schema aligned to the keep-list above).

---

## 6. Quick checklist for other members

- [ ] Copy M1 PAR clean into `data/private/` (when shared)  
- [ ] Download **Kiva**  
- [ ] M2: Findex + synthetic ledgers; skim CGAP/SPTF KPI defs  
- [ ] M3: synthesize payment schedules if needed  
- [ ] M4: synthetic HR + agent logs  
- [ ] Never commit passwords, NIC, or raw partner Excel  
