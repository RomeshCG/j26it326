# M1 feature list (PAR-aligned)

Risk target is a **percentage** `risk_pct` (0–100), derived from arrears + repayment progress. UI may map to low / medium / high.

## From partner PAR (primary)

| Feature | Source column | Notes |
|---------|---------------|--------|
| branch | BRANCH NAME | categorical |
| center | CENTER | categorical |
| product_category | PRODUCT CATEGORY | categorical |
| product_type | PRODUCT TYPE | categorical |
| product | PRODUCT | categorical |
| contract_amount | CONTRACT AMOUNT | LKR |
| interest_amount | INTEREST | LKR (not rate) |
| installment | INSTALLMENT | LKR |
| tenure | TENURE | periods |
| balance_capital | BALANCE CAPITAL | |
| balance_interest | BALANCE INTEREST | |
| balance_total | BALANCE (CAPITAL + INTEREST) | |
| bal_penalty | BAL. PENALTY | |
| bal_charges | BAL. CHARGES | |
| arr_cap | ARR. CAP. | arrears capital |
| arr_int | ARR. INT. | arrears interest |
| paid_capital | PAID CAPITAL | |
| paid_interest | PAID INTEREST | |
| paid_total | PAID (CAP. + INT.) | |
| paid_pct | PAID % | |
| total_paid | TOTAL PAID | |
| over_payment | OVER PAYMENT | |

## Derived (always)

| Feature | Rule |
|---------|------|
| arrears_total | arr_cap + arr_int |
| arrears_ratio | arrears_total / max(balance_total, 1) |
| utilization | balance_total / max(contract_amount, 1) |

## Synthetic enrichment (not in PAR)

| Feature | Notes |
|---------|--------|
| gender | female / male (meeting prior: women-heavy) |
| area_type | rural / urban |
| is_group_loan | bool (~60% group prior) |
| income_band | low / mid / high |

## Label

```text
risk_pct ≈ clip(
  40 * arrears_ratio
  + 25 * (1 - paid_pct/100)
  + 20 * min(bal_penalty / max(contract_amount,1), 1)
  + 15 * min(bal_charges / max(contract_amount,1), 1)
, 0, 100)
```

Optional bands: low &lt; 35, medium 35–65, high &gt; 65.

## Drop (never train on)

CUSTOMER NAME, CUSTOMER NIC, CONTACT NO., raw CUSTOMER CODE / CONTRACT NUMBER (use anonymous id only).
