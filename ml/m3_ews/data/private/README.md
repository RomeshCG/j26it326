# ml/m3_ews/data/private/

This directory holds M1's cleaned partner PAR dataset and any other
non-public training data files.

## Files expected here (NEVER commit these to git)

| File                        | Source                        | Purpose                                 |
| :-------------------------- | :---------------------------- | :-------------------------------------- |
| `par30_clean_no_pii.csv`    | M1 (private share)            | Primary EWS training labels + features |

## How to obtain

Ask M1 to share `par30_clean_no_pii.csv` privately (Slack DM / encrypted
transfer).  Place it here before running:

```bash
python ml/m3_ews/features/par_to_ews_matrix.py \
    --par-csv ml/m3_ews/data/private/par30_clean_no_pii.csv \
    --output  ml/m3_ews/data/features/feature_matrix.csv
```

## gitignore rules

The parent `.gitignore` already covers this directory:

```
ml/**/data/private/
ml/**/data/features/
ml/**/data/scores/
ml/**/models/*.joblib
```

Do NOT override these rules.
