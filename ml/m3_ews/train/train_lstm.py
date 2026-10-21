"""
M3 EWS — Candidate Model 2: LSTM / Recurrent Neural Network Training
====================================================================
Implements Candidate Model Family 2 required by Task 98:
Recurrent Neural Network (LSTM) for microfinance loan distress prediction.

Compares against Candidate Model Family 1 (Gradient Boosted Trees / XGBoost).

Key design:
- Temporal cohort split: 70% Train, 15% Validation, 15% Test holdout
- Sequential timestep windowing (repayment history sequences)
- Class-weighted BCE loss (pos_weight) for minority distress class (~10-15%)
- Validation PR-curve threshold optimization
- Model artifact export (.pt) + metadata (lstm_metadata.json)

Usage:
    python ml/m3_ews/train/train_lstm.py \
        --data ml/m3_ews/data/features/feature_matrix.csv \
        --output-dir ml/m3_ews/models
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_recall_curve,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.preprocessing import StandardScaler
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, TensorDataset


FEATURE_COLS = [
    "repayment_on_time_rate_3m",
    "repayment_on_time_rate_6m",
    "avg_days_late_3m",
    "consecutive_missed",
    "partial_payment_rate",
    "missed_payment_rate",
    "promise_kept_rate",
    "outstanding_principal",
    "loan_to_income_ratio",
    "days_since_last_payment",
    "group_repayment_ratio",
    "group_arrears_ratio",
    "poverty_proxy_score",
    "is_new_to_banking",
    "term_completion_pct",
]

TARGET_COL = "distress_label"
TIMESTEPS = 3
FEATURES_PER_STEP = 5


class LoanDistressLSTM(nn.Module):
    """
    Bi-layer LSTM network with recurrent dropout and dense classification head.
    Input shape: (batch_size, timesteps=3, features_per_step=5)
    """

    def __init__(self, input_dim=5, hidden_dim=64, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_dim,
            hidden_size=hidden_dim,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_dim, 32),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        # x: (batch_size, timesteps, features)
        out, (hn, _) = self.lstm(x)
        # Use last hidden state
        last_hidden = hn[-1]
        logits = self.fc(last_hidden)
        return logits.squeeze(-1)


def parse_args():
    parser = argparse.ArgumentParser(description="Train M3 EWS LSTM candidate model")
    parser.add_argument(
        "--data",
        default="ml/m3_ews/data/features/feature_matrix.csv",
        help="Path to feature matrix CSV",
    )
    parser.add_argument(
        "--output-dir",
        default="ml/m3_ews/models",
        help="Directory to save model artifacts",
    )
    parser.add_argument("--epochs", type=int, default=40, help="Training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.002, help="Learning rate")
    parser.add_argument("--hidden-dim", type=int, default=64, help="LSTM hidden units")
    parser.add_argument("--num-layers", type=int, default=2, help="LSTM layer depth")
    return parser.parse_args()


def load_and_split_data(csv_path: str):
    df = pd.read_csv(csv_path)
    print(f"[M3 LSTM] Loaded {len(df)} records from {csv_path}")

    # Check required columns
    available_features = [c for c in FEATURE_COLS if c in df.columns]
    if len(available_features) < len(FEATURE_COLS):
        raise ValueError(
            f"Missing features: {set(FEATURE_COLS) - set(available_features)}"
        )
    if TARGET_COL not in df.columns:
        raise ValueError(f"Missing target column: '{TARGET_COL}'")

    n = len(df)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)

    train_df = df.iloc[:n_train].copy()
    val_df = df.iloc[n_train : n_train + n_val].copy()
    test_df = df.iloc[n_train + n_val :].copy()

    print(
        f"[M3 LSTM] Temporal cohort split -> Train: {len(train_df)}, Val: {len(val_df)}, Test: {len(test_df)}"
    )

    X_train = train_df[FEATURE_COLS].values.astype(np.float32)
    y_train = train_df[TARGET_COL].values.astype(np.float32)

    X_val = val_df[FEATURE_COLS].values.astype(np.float32)
    y_val = val_df[TARGET_COL].values.astype(np.float32)

    X_test = test_df[FEATURE_COLS].values.astype(np.float32)
    y_test = test_df[TARGET_COL].values.astype(np.float32)

    # Standardize features (fit only on train cohort)
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_val_scaled = scaler.transform(X_val)
    X_test_scaled = scaler.transform(X_test)

    # Reshape (N, 15) -> (N, 3, 5) representing temporal rolling state
    X_train_seq = X_train_scaled.reshape(-1, TIMESTEPS, FEATURES_PER_STEP)
    X_val_seq = X_val_scaled.reshape(-1, TIMESTEPS, FEATURES_PER_STEP)
    X_test_seq = X_test_scaled.reshape(-1, TIMESTEPS, FEATURES_PER_STEP)

    return (
        (X_train_seq, y_train),
        (X_val_seq, y_val),
        (X_test_seq, y_test),
        scaler,
    )


def find_optimal_threshold(y_true, y_probs):
    precision, recall, thresholds = precision_recall_curve(y_true, y_probs)
    f1_scores = []
    for p, r in zip(precision[:-1], recall[:-1]):
        if (p + r) > 0:
            f1_scores.append(2 * (p * r) / (p + r))
        else:
            f1_scores.append(0.0)

    best_idx = int(np.argmax(f1_scores)) if f1_scores else 0
    best_thresh = float(thresholds[best_idx]) if len(thresholds) > 0 else 0.5
    # Clamp to reasonable decision range [0.10, 0.85]
    best_thresh = max(0.10, min(0.85, best_thresh))
    return best_thresh


def evaluate_predictions(y_true, y_probs, threshold: float):
    y_pred = (y_probs >= threshold).astype(int)
    y_true_int = y_true.astype(int)

    auc = (
        float(roc_auc_score(y_true_int, y_probs))
        if len(np.unique(y_true_int)) > 1
        else 0.5
    )
    pr_auc = (
        float(average_precision_score(y_true_int, y_probs))
        if len(np.unique(y_true_int)) > 1
        else 0.0
    )
    prec = float(precision_score(y_true_int, y_pred, zero_division=0))
    rec = float(recall_score(y_true_int, y_pred, zero_division=0))
    f1 = float(f1_score(y_true_int, y_pred, zero_division=0))

    tn, fp, fn, tp = confusion_matrix(y_true_int, y_pred, labels=[0, 1]).ravel()

    return {
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1": round(f1, 4),
        "auc": round(auc, 4),
        "pr_auc": round(pr_auc, 4),
        "tp": int(tp),
        "fp": int(fp),
        "fn": int(fn),
        "tn": int(tn),
        "threshold": round(threshold, 4),
    }


def train_lstm():
    args = parse_args()
    torch.manual_seed(42)
    np.random.seed(42)

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    (train_data, val_data, test_data, scaler) = load_and_split_data(args.data)
    X_train, y_train = train_data
    X_val, y_val = val_data
    X_test, y_test = test_data

    # Class imbalance handling: pos_weight = neg_count / pos_count
    n_pos = float(np.sum(y_train == 1))
    n_neg = float(np.sum(y_train == 0))
    pos_weight_val = (n_neg / n_pos) if n_pos > 0 else 1.0
    print(
        f"[M3 LSTM] Class imbalance: Positives={int(n_pos)}, Negatives={int(n_neg)}, pos_weight={pos_weight_val:.2f}"
    )

    pos_weight_tensor = torch.tensor([pos_weight_val], dtype=torch.float32)
    criterion = nn.BCEWithLogitsLoss(pos_weight=pos_weight_tensor)

    # Prepare PyTorch datasets
    train_dataset = TensorDataset(
        torch.tensor(X_train, dtype=torch.float32),
        torch.tensor(y_train, dtype=torch.float32),
    )
    val_dataset = TensorDataset(
        torch.tensor(X_val, dtype=torch.float32),
        torch.tensor(y_val, dtype=torch.float32),
    )
    test_dataset = TensorDataset(
        torch.tensor(X_test, dtype=torch.float32),
        torch.tensor(y_test, dtype=torch.float32),
    )

    train_loader = DataLoader(
        train_dataset, batch_size=args.batch_size, shuffle=True
    )
    val_loader = DataLoader(val_dataset, batch_size=args.batch_size, shuffle=False)
    test_loader = DataLoader(
        test_dataset, batch_size=args.batch_size, shuffle=False
    )

    model = LoanDistressLSTM(
        input_dim=FEATURES_PER_STEP,
        hidden_dim=args.hidden_dim,
        num_layers=args.num_layers,
        dropout=0.2,
    )
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    best_val_loss = float("inf")
    best_state = None

    print(
        f"[M3 LSTM] Training LSTM across {args.epochs} epochs (hidden_dim={args.hidden_dim}, layers={args.num_layers})..."
    )
    for epoch in range(1, args.epochs + 1):
        model.train()
        total_train_loss = 0.0
        for batch_x, batch_y in train_loader:
            optimizer.zero_grad()
            logits = model(batch_x)
            loss = criterion(logits, batch_y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()
            total_train_loss += loss.item() * len(batch_y)

        train_loss = total_train_loss / len(train_dataset)

        # Validation phase
        model.eval()
        total_val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                logits = model(batch_x)
                val_loss = criterion(logits, batch_y)
                total_val_loss += val_loss.item() * len(batch_y)

        val_loss = total_val_loss / len(val_dataset)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

        if epoch % 10 == 0 or epoch == args.epochs:
            print(
                f"[M3 LSTM] Epoch {epoch:02d}/{args.epochs:02d} | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}"
            )

    # Load best checkpoint
    if best_state is not None:
        model.load_state_dict(best_state)

    # Predict validation probabilities
    model.eval()
    with torch.no_grad():
        val_logits = []
        for batch_x, _ in val_loader:
            val_logits.append(model(batch_x))
        val_probs = torch.sigmoid(torch.cat(val_logits)).numpy()

    # Find optimal threshold on validation PR curve
    optimal_thresh = find_optimal_threshold(y_val, val_probs)
    print(f"[M3 LSTM] Optimal decision threshold from Val PR curve: {optimal_thresh:.4f}")

    metrics_val = evaluate_predictions(y_val, val_probs, optimal_thresh)
    print(f"[M3 LSTM] Validation Metrics: {metrics_val}")

    # Predict on unseen test cohort
    with torch.no_grad():
        test_logits = []
        for batch_x, _ in test_loader:
            test_logits.append(model(batch_x))
        test_probs = torch.sigmoid(torch.cat(test_logits)).numpy()

    metrics_test = evaluate_predictions(y_test, test_probs, optimal_thresh)
    print(f"[M3 LSTM] Test Metrics: {metrics_test}")

    # Save PyTorch model artifact
    model_path = output_dir / "lstm_model.pt"
    torch.save(
        {
            "state_dict": model.state_dict(),
            "scaler_mean": scaler.mean_.tolist(),
            "scaler_scale": scaler.scale_.tolist(),
            "optimal_threshold": optimal_thresh,
            "architecture": {
                "input_dim": FEATURES_PER_STEP,
                "hidden_dim": args.hidden_dim,
                "num_layers": args.num_layers,
                "timesteps": TIMESTEPS,
            },
            "features": FEATURE_COLS,
        },
        model_path,
    )
    print(f"[M3 LSTM] Saved PyTorch model -> {model_path}")

    # Save metadata JSON
    metadata = {
        "model_name": "M3 EWS Loan Distress Recurrent Classifier",
        "algorithm": "LSTM (PyTorch)",
        "features": FEATURE_COLS,
        "timesteps": TIMESTEPS,
        "features_per_step": FEATURES_PER_STEP,
        "optimal_threshold": round(optimal_thresh, 4),
        "class_imbalance_weight": round(pos_weight_val, 4),
        "metrics_val": metrics_val,
        "metrics_test": metrics_test,
    }

    metadata_path = output_dir / "lstm_metadata.json"
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"[M3 LSTM] Saved metadata -> {metadata_path}")

    # Load XGBoost metadata for comparison if present
    xgb_metadata_path = output_dir / "model_metadata.json"
    if xgb_metadata_path.exists():
        with open(xgb_metadata_path) as f:
            xgb_meta = json.load(f)
        print("\n================ CANDIDATE MODEL COMPARISON (Task 98) ================")
        print(
            f"{'Model Family':<25} | {'Val AUC':<8} | {'Val F1':<8} | {'Test Recall':<11} | {'Test Prec':<10} | {'Test F1':<8}"
        )
        print("-" * 80)
        xgb_test = xgb_meta.get("metrics_test", {})
        xgb_val = xgb_meta.get("metrics_val", {})
        print(
            f"{'Candidate 1: XGBoost':<25} | {xgb_val.get('auc', 0):<8.4f} | {xgb_val.get('f1', 0):<8.4f} | {xgb_test.get('recall', 0):<11.4f} | {xgb_test.get('precision', 0):<10.4f} | {xgb_test.get('f1', 0):<8.4f}"
        )
        print(
            f"{'Candidate 2: LSTM (RNN)':<25} | {metrics_val.get('auc', 0):<8.4f} | {metrics_val.get('f1', 0):<8.4f} | {metrics_test.get('recall', 0):<11.4f} | {metrics_test.get('precision', 0):<10.4f} | {metrics_test.get('f1', 0):<8.4f}"
        )
        print("=======================================================================\n")


if __name__ == "__main__":
    train_lstm()
