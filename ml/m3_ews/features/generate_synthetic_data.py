"""
M3 EWS — Synthetic Data Generator
==================================
Generates realistic Sri Lankan microfinance loan portfolios with temporal repayment
histories and collection visit outcomes.

Produces a feature matrix CSV directly (zero external dependencies, runs with stdlib),
or optionally outputs SQL inserts / raw tables for database testing.

Usage:
    python ml/m3_ews/features/generate_synthetic_data.py \
        --num-loans 1200 \
        --output ml/m3_ews/data/features/feature_matrix.csv \
        --seed 42
"""

import argparse
import csv
import math
import os
import random
from datetime import date, timedelta
from pathlib import Path


# ── Sri Lankan localized demo data ──────────────────────────────────────────

FIRST_NAMES_FEMALE = [
    "Kusumawathi", "Sunethra", "Anula", "Priyanthi", "Chamari",
    "Manel", "Shanthi", "Kamalawathi", "Nirmala", "Nilmini",
    "Sandamali", "Malkanthi", "Dilrukshi", "Renuka", "Chandrika",
]

FIRST_NAMES_MALE = [
    "Sunil", "Bandula", "Chaminda", "Dhammika", "Jagath",
    "Nimal", "Sarath", "Mahinda", "Ranjith", "Gamini",
    "Pradeep", "Nuwan", "Roshan", "Lalith", "Anura",
]

LAST_NAMES = [
    "Perera", "Silva", "Fernando", "Jayasinghe", "Bandara",
    "Wickramasinghe", "Karunaratne", "Gunasekara", "Dissanayake", "Herath",
    "Rajapaksha", "Weerasinghe", "Alwis", "Kulathunga", "Senanayake",
]

DISTRICTS = [
    "Colombo", "Gampaha", "Kalutara", "Kandy", "Matale",
    "Nuwara Eliya", "Galle", "Matara", "Kurunegala", "Anuradhapura",
]

OCCUPATIONS = [
    ("Batik & Garments", 45000, 15000),
    ("Tea Smallholder", 52000, 18000),
    ("Vegetable Cultivation", 48000, 20000),
    ("Grocery / Retail Shop", 65000, 22000),
    ("Poultry Farming", 58000, 16000),
    ("Handicrafts & Pottery", 38000, 12000),
    ("Bakery & Food Processing", 62000, 19000),
    ("Fisheries & Dry Fish", 54000, 21000),
]


def parse_args():
    parser = argparse.ArgumentParser(description="Generate synthetic M3 EWS training data")
    parser.add_argument("--num-loans", type=int, default=1500, help="Number of synthetic loans to simulate")
    parser.add_argument("--output", default="ml/m3_ews/data/features/feature_matrix.csv", help="Output CSV path")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--distress-rate", type=float, default=0.14, help="Target fraction of distressed loans (~14 percent)")
    return parser.parse_args()


def simulate_loan(loan_idx: int, ref_date: date, target_distress: bool, rng: random.Random) -> dict:
    """
    Simulates one loan's lifecycle up to ref_date.
    Distressed loans develop negative repayment momentum (missed payments, high arrears).
    Healthy loans stay mostly current.
    """
    is_female = rng.random() < 0.72  # Microfinance has strong female borrower representation
    first_name = rng.choice(FIRST_NAMES_FEMALE if is_female else FIRST_NAMES_MALE)
    last_name = rng.choice(LAST_NAMES)
    full_name = f"{first_name} {last_name}"

    occ_name, occ_mean, occ_std = rng.choice(OCCUPATIONS)
    monthly_income = max(22000.0, round(rng.gauss(occ_mean, occ_std), -2))

    is_group = rng.random() < 0.45
    group_id = f"grp-{rng.randint(100, 250):04d}" if is_group else None

    # Loan parameters
    principal = rng.choice([35000, 50000, 75000, 100000, 150000, 200000, 300000])
    term_months = rng.choice([6, 12, 18, 24])
    interest_rate = 0.18

    # Loan activation date: between 3 and 18 months before ref_date
    months_active = rng.randint(3, max(term_months, 4))
    activated_date = ref_date - timedelta(days=months_active * 30)

    poverty_proxy = round(rng.uniform(0.15, 0.75), 3)
    is_new_to_banking = 1 if rng.random() < 0.38 else 0

    # Installment schedule simulation
    monthly_installment = (principal * (1 + interest_rate * (term_months / 12))) / term_months
    total_due_installments = min(months_active, term_months)

    # Simulate payment behaviors across installments
    # If target_distress=True, behavior worsens especially in recent 3 months
    installments_status = []
    days_late_list = []
    collection_outcomes = []
    consecutive_missed = 0
    max_consec_missed = 0

    for inst_idx in range(1, total_due_installments + 1):
        months_ago = total_due_installments - inst_idx
        in_recent_3m = months_ago < 3

        if target_distress:
            # Deteriorating profile
            if in_recent_3m:
                roll = rng.random()
                if roll < 0.45:
                    outcome = "missed"
                    status = "missed"
                    consecutive_missed += 1
                    days_late = rng.randint(25, 65)
                elif roll < 0.75:
                    outcome = "partial"
                    status = "partial"
                    consecutive_missed = 0
                    days_late = rng.randint(10, 35)
                else:
                    outcome = "promise_to_pay"
                    status = "partial"
                    consecutive_missed = 0
                    days_late = rng.randint(14, 40)
            else:
                # Earlier on, maybe showed mild warning signs
                roll = rng.random()
                if roll < 0.20:
                    outcome = "partial"
                    status = "partial"
                    consecutive_missed = 0
                    days_late = rng.randint(5, 20)
                else:
                    outcome = "paid"
                    status = "paid"
                    consecutive_missed = 0
                    days_late = 0
        else:
            # Healthy profile
            roll = rng.random()
            if roll < 0.06:
                outcome = "partial"
                status = "partial"
                consecutive_missed = 0
                days_late = rng.randint(2, 10)
            elif roll < 0.02:
                outcome = "missed"
                status = "missed"
                consecutive_missed = 1
                days_late = rng.randint(5, 15)
            else:
                outcome = "paid"
                status = "paid"
                consecutive_missed = 0
                days_late = 0

        max_consec_missed = max(max_consec_missed, consecutive_missed)
        installments_status.append((inst_idx, status, in_recent_3m))
        days_late_list.append((days_late, in_recent_3m))
        collection_outcomes.append((outcome, in_recent_3m))

    # Calculate engineered features
    recent_3m_statuses = [s for _, s, rec in installments_status if rec]
    all_statuses = [s for _, s, _ in installments_status]

    on_time_3m = (
        sum(1 for s in recent_3m_statuses if s == "paid") / len(recent_3m_statuses)
        if recent_3m_statuses else 1.0
    )
    on_time_6m = (
        sum(1 for s in all_statuses[-6:] if s == "paid") / len(all_statuses[-6:])
        if all_statuses else 1.0
    )

    recent_3m_late = [dl for dl, rec in days_late_list if rec]
    avg_days_late_3m = sum(recent_3m_late) / len(recent_3m_late) if recent_3m_late else 0.0

    recent_outcomes = [o for o, rec in collection_outcomes if rec]
    n_rec_visits = len(recent_outcomes) or 1
    partial_rate = sum(1 for o in recent_outcomes if o == "partial") / n_rec_visits
    missed_rate = sum(1 for o in recent_outcomes if o == "missed") / n_rec_visits

    promise_count = sum(1 for o in recent_outcomes if o == "promise_to_pay")
    if promise_count > 0:
        promise_kept_rate = 0.20 if target_distress else 0.85
    else:
        promise_kept_rate = 1.0

    # Outstanding principal balance estimation
    paid_installments = sum(1 for _, s, _ in installments_status if s == "paid")
    unpaid_installments = max(term_months - paid_installments, 0)
    outstanding_principal = round(unpaid_installments * (principal / term_months), 2)

    loan_to_income = round(principal / monthly_income, 4)

    # Days since last payment
    if target_distress:
        days_since_last_payment = rng.randint(28, 75)
    else:
        days_since_last_payment = rng.randint(3, 26)

    # Group repayment stats
    if is_group:
        if target_distress:
            group_repayment_ratio = round(rng.uniform(0.60, 0.82), 4)
            group_arrears_ratio = round(rng.uniform(0.18, 0.40), 4)
        else:
            group_repayment_ratio = round(rng.uniform(0.92, 0.99), 4)
            group_arrears_ratio = round(rng.uniform(0.01, 0.07), 4)
    else:
        group_repayment_ratio = 0.0
        group_arrears_ratio = 0.0

    term_completion_pct = round(total_due_installments / term_months, 4)
    distress_label = 1 if target_distress else 0

    return {
        "loan_id": f"loan-{loan_idx:05d}",
        "borrower_id": f"borr-{loan_idx:05d}",
        "repayment_on_time_rate_3m": round(on_time_3m, 4),
        "repayment_on_time_rate_6m": round(on_time_6m, 4),
        "avg_days_late_3m": round(avg_days_late_3m, 2),
        "consecutive_missed": max_consec_missed,
        "partial_payment_rate": round(partial_rate, 4),
        "missed_payment_rate": round(missed_rate, 4),
        "promise_kept_rate": round(promise_kept_rate, 4),
        "outstanding_principal": outstanding_principal,
        "loan_to_income_ratio": loan_to_income,
        "days_since_last_payment": days_since_last_payment,
        "group_repayment_ratio": group_repayment_ratio,
        "group_arrears_ratio": group_arrears_ratio,
        "poverty_proxy_score": poverty_proxy,
        "is_new_to_banking": is_new_to_banking,
        "term_completion_pct": term_completion_pct,
        "distress_label": distress_label,
    }


def main():
    args = parse_args()
    rng = random.Random(args.seed)
    ref_date = date(2026, 10, 1)

    print(f"[M3 Synthetic Generator] Generating {args.num_loans} records (distress target: {args.distress_rate:.1%})...")

    records = []
    num_distressed = int(args.num_loans * args.distress_rate)
    num_healthy = args.num_loans - num_distressed

    distress_flags = [True] * num_distressed + [False] * num_healthy
    rng.shuffle(distress_flags)

    for i, is_distressed in enumerate(distress_flags, start=1):
        rec = simulate_loan(i, ref_date, is_distressed, rng)
        records.append(rec)

    out_file = Path(args.output)
    out_file.parent.mkdir(parents=True, exist_ok=True)

    fieldnames = list(records[0].keys())
    with open(out_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(records)

    actual_rate = sum(r["distress_label"] for r in records) / len(records)
    print(f"[M3 Synthetic Generator] Successfully written to: {out_file}")
    print(f"  Total records  : {len(records)}")
    print(f"  Distress rate  : {actual_rate:.2%}")
    print(f"  Features count : {len(fieldnames) - 3}")


if __name__ == "__main__":
    main()
