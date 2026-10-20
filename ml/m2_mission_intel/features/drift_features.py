"""M2 Drift Feature Engineering.

Transforms longitudinal financial KPIs, social performance indicators, and branch portfolios
into a structured feature matrix for training and evaluating predictive Mission Drift models.

Calculates:
- Trajectory velocities (3-month rolling growth/decline rates)
- Commercialization pressure metrics (ticket size inflation, yield spread)
- Demographic shifts (female ratio contraction, rural vs urban migration)
- Delinquency pressure (PAR30 shifts causing risk-averse exclusion)
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

FEATURE_COLUMNS = [
    "current_mdi",
    "mdi_velocity_1m",
    "avg_loan_size",
    "loan_size_growth_3m",
    "female_borrower_ratio",
    "female_ratio_change_3m",
    "poverty_proxy_score",
    "poverty_change_3m",
    "rural_borrower_ratio",
    "rural_change_3m",
    "par30_ratio",
    "par30_change_3m",
    "portfolio_yield",
    "oer_ratio",
    "oss_ratio",
    "new_to_banking_ratio",
]

TARGET_BINARY = "drift_event_forward"
TARGET_CONTINUOUS = "forward_mdi_score"


def compute_velocity_features(df_combined: pd.DataFrame) -> pd.DataFrame:
    """Computes rate-of-change and velocity features over rolling windows.

    df_combined must be sorted chronologically and contain columns:
    month, score, avg_loan_size, female, rural, poverty, par30, yield, oer, oss, new_to_banking
    """
    df = df_combined.copy()

    # 1-month MDI velocity
    df["current_mdi"] = df["score"]
    df["mdi_velocity_1m"] = df["score"].diff().fillna(0.0)

    # 3-month rolling relative changes
    def rel_change(series: pd.Series, periods: int = 3) -> pd.Series:
        shifted = series.shift(periods)
        return (series - shifted) / shifted.replace(0, np.nan)

    df["loan_size_growth_3m"] = rel_change(df["avg_loan_size"], 3).fillna(0.0)
    df["female_ratio_change_3m"] = (df["female"] - df["female"].shift(3)).fillna(0.0)
    df["poverty_change_3m"] = (df["poverty"] - df["poverty"].shift(3)).fillna(0.0)
    df["rural_change_3m"] = (df["rural"] - df["rural"].shift(3)).fillna(0.0)
    df["par30_change_3m"] = (df["par30"] - df["par30"].shift(3)).fillna(0.0)

    # Feature mapping with fallback defaults
    df["female_borrower_ratio"] = df["female"]
    df["poverty_proxy_score"] = df["poverty"]
    df["rural_borrower_ratio"] = df["rural"]
    df["par30_ratio"] = df["par30"]
    
    # Handle yield column name variation
    if "yield" in df.columns:
        df["portfolio_yield"] = df["yield"]
    elif "yield_contract" in df.columns:
        df["portfolio_yield"] = df["yield_contract"]
    else:
        df["portfolio_yield"] = 0.26

    df["oer_ratio"] = df["oer"] if "oer" in df.columns else 0.13
    df["oss_ratio"] = df["oss"] if "oss" in df.columns else 1.09
    df["new_to_banking_ratio"] = df["new_to_banking"] if "new_to_banking" in df.columns else 0.20

    return df


def generate_branch_scenario_dataset(
    borrowers_df: pd.DataFrame,
    base_kpi: pd.DataFrame,
    base_social: pd.DataFrame,
    n_scenarios: int = 40,
    random_seed: int = 42,
) -> pd.DataFrame:
    """Generates a realistic multi-branch, multi-month longitudinal dataset for model training.

    Simulates four classic microfinance operating trajectories:
    1. Mission-Aligned: High female/poverty outreach, stable ticket sizes, low drift.
    2. Modest Commercialization: Moderate growth, minor demographic shifts, MDI near 10-15.
    3. Aggressive Commercialization (Drift): Rapid ticket size inflation, female/poverty contraction, MDI > 20.
    4. Delinquency-Driven Retreat: PAR30 spike leading officers to abandon poorer clients.
    """
    rng = np.random.default_rng(random_seed)
    records = []

    branches = borrowers_df["branch"].dropna().unique().tolist() if "branch" in borrowers_df.columns else ["Headquarters"]

    # Trajectory types and probabilities
    trajectory_types = ["stable", "modest_growth", "commercial_drift", "delinquency_drift"]
    probs = [0.35, 0.25, 0.25, 0.15]

    for scenario_idx in range(n_scenarios):
        traj = rng.choice(trajectory_types, p=probs)
        branch = rng.choice(branches)

        # Baseline priors with branch-level variation
        base_loan_size = rng.normal(85000, 10000)
        base_female = np.clip(rng.normal(0.78, 0.04), 0.50, 0.95)
        base_poverty = np.clip(rng.normal(0.48, 0.05), 0.20, 0.70)
        base_rural = np.clip(rng.normal(0.75, 0.06), 0.40, 0.90)
        base_par30 = np.clip(rng.normal(0.045, 0.01), 0.01, 0.15)
        base_oss = np.clip(rng.normal(1.05, 0.05), 0.85, 1.30)
        base_oer = np.clip(rng.normal(0.13, 0.02), 0.08, 0.20)
        base_yield = np.clip(rng.normal(0.24, 0.03), 0.15, 0.35)
        base_ntb = np.clip(rng.normal(0.20, 0.03), 0.05, 0.40)

        loan_size = base_loan_size
        female = base_female
        poverty = base_poverty
        rural = base_rural
        par30 = base_par30
        oss = base_oss
        oer = base_oer
        yield_val = base_yield
        ntb = base_ntb

        # Simulate 8 consecutive months
        for m_idx in range(8):
            month_label = f"S{scenario_idx:02d}-M{m_idx:02d}"

            # Apply trajectory dynamics
            if traj == "commercial_drift" and m_idx >= 3:
                loan_size *= rng.uniform(1.03, 1.07)
                female = np.clip(female - rng.uniform(0.015, 0.035), 0.30, 0.95)
                poverty = np.clip(poverty - rng.uniform(0.02, 0.045), 0.10, 0.70)
                rural = np.clip(rural - rng.uniform(0.01, 0.025), 0.20, 0.90)
                oss *= rng.uniform(1.01, 1.03)
                yield_val *= rng.uniform(1.005, 1.02)
            elif traj == "delinquency_drift" and m_idx >= 2:
                par30 = np.clip(par30 + rng.uniform(0.015, 0.04), 0.01, 0.35)
                # Officers react by ditching high-poverty clients
                poverty = np.clip(poverty - rng.uniform(0.02, 0.04), 0.10, 0.70)
                female = np.clip(female - rng.uniform(0.01, 0.02), 0.30, 0.95)
                loan_size *= rng.uniform(1.01, 1.04)
            elif traj == "modest_growth":
                loan_size *= rng.uniform(1.005, 1.02)
                female = np.clip(female + rng.normal(0.0, 0.005), 0.40, 0.95)
                poverty = np.clip(poverty + rng.normal(0.0, 0.005), 0.15, 0.70)
            else:  # stable
                loan_size *= rng.normal(1.0, 0.005)
                female = np.clip(female + rng.normal(0.0, 0.004), 0.40, 0.95)
                poverty = np.clip(poverty + rng.normal(0.0, 0.004), 0.15, 0.70)

            # Calculate synthetic MDI contribution
            # Baseline = first month
            rel_female = (female - base_female) / base_female
            rel_pov = (poverty - base_poverty) / base_poverty
            rel_rural = (rural - base_rural) / base_rural
            rel_size = (loan_size - base_loan_size) / base_loan_size

            # Formula: 100 * sum(w * clip(drift/0.20, -1, 1))
            # Direction: -1 for female, pov, rural; +1 for size
            drift_female = -1.0 * rel_female
            drift_pov = -1.0 * rel_pov
            drift_rural = -1.0 * rel_rural
            drift_size = 1.0 * rel_size

            norm_f = np.clip(drift_female / 0.20, -1.0, 1.0)
            norm_p = np.clip(drift_pov / 0.20, -1.0, 1.0)
            norm_r = np.clip(drift_rural / 0.20, -1.0, 1.0)
            norm_s = np.clip(drift_size / 0.20, -1.0, 1.0)

            mdi_score = float(100.0 * (0.25 * norm_f + 0.20 * norm_p + 0.15 * norm_r + 0.15 * norm_s))

            records.append({
                "scenario_id": scenario_idx,
                "trajectory": traj,
                "branch": branch,
                "month_idx": m_idx,
                "month": month_label,
                "score": round(mdi_score, 3),
                "avg_loan_size": round(loan_size, 2),
                "female": round(female, 4),
                "poverty": round(poverty, 4),
                "rural": round(rural, 4),
                "par30": round(par30, 4),
                "oss": round(oss, 4),
                "oer": round(oer, 4),
                "yield": round(yield_val, 4),
                "new_to_banking": round(ntb, 4),
            })

    raw_df = pd.DataFrame(records)

    # Compute velocity features per scenario group
    processed_groups = []
    for _, grp in raw_df.groupby("scenario_id"):
        grp_features = compute_velocity_features(grp)
        # Target: Forward MDI score (next month) and forward drift event (MDI >= 20 within next 2 months)
        grp_features[TARGET_CONTINUOUS] = grp_features["score"].shift(-1)
        # Forward binary event: any MDI >= 20 in next 2 months
        forward_scores = grp_features["score"].shift(-1).combine(
            grp_features["score"].shift(-2), max
        )
        grp_features[TARGET_BINARY] = (forward_scores >= 20.0).astype(int)
        processed_groups.append(grp_features)

    final_df = pd.concat(processed_groups, ignore_index=True)
    # Drop rows without forward targets
    final_df = final_df.dropna(subset=[TARGET_CONTINUOUS, TARGET_BINARY]).reset_index(drop=True)
    return final_df
