from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from sklearn.metrics import mean_absolute_error

from ml.paths import DATASET_PATH
from ml.predict import load_artifact


def top_k_overlap(expert: list[str], predicted: list[str], k: int) -> float:
    if k <= 0:
        return 0.0
    expert_set = set(expert[:k])
    predicted_set = set(predicted[:k])
    return len(expert_set & predicted_set) / k


def evaluate(dataset_path: Path = DATASET_PATH) -> dict[str, float]:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}. Run python -m ml.build_dataset first.")

    model, feature_columns = load_artifact()
    dataset = pd.read_csv(dataset_path)
    predictions = model.predict(dataset[feature_columns].fillna(0))
    mae = float(mean_absolute_error(dataset["target_total_score"], predictions))

    comparison = dataset[["champion", "target_total_score"]].copy()
    comparison["predicted_score"] = predictions
    if "context_id" in dataset.columns:
        comparison["context_id"] = dataset["context_id"]
        top_1_scores = []
        top_5_scores = []
        for _, group in comparison.groupby("context_id"):
            expert_order = group.sort_values("target_total_score", ascending=False)["champion"].tolist()
            predicted_order = group.sort_values("predicted_score", ascending=False)["champion"].tolist()
            top_1_scores.append(top_k_overlap(expert_order, predicted_order, 1))
            top_5_scores.append(top_k_overlap(expert_order, predicted_order, 5))
        top_1 = float(sum(top_1_scores) / len(top_1_scores)) if top_1_scores else 0.0
        top_5 = float(sum(top_5_scores) / len(top_5_scores)) if top_5_scores else 0.0
    else:
        expert_order = comparison.sort_values("target_total_score", ascending=False)["champion"].tolist()
        predicted_order = comparison.sort_values("predicted_score", ascending=False)["champion"].tolist()
        top_1 = top_k_overlap(expert_order, predicted_order, 1)
        top_5 = top_k_overlap(expert_order, predicted_order, 5)

    return {
        "mae": mae,
        "top_1_overlap": top_1,
        "top_5_overlap": top_5,
        "rows": float(len(dataset)),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate DraftForMe ML model against expert labels.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    args = parser.parse_args()

    metrics = evaluate(args.dataset)
    print(f"Rows: {int(metrics['rows'])}")
    print(f"MAE: {metrics['mae']:.3f}")
    print(f"Top-1 overlap: {metrics['top_1_overlap']:.2f}")
    print(f"Top-5 overlap: {metrics['top_5_overlap']:.2f}")


if __name__ == "__main__":
    main()
