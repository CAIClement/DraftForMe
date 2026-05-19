from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split

from ml.features import FEATURE_COLUMNS
from ml.paths import ARTIFACT_DIR, DATASET_PATH, METADATA_PATH, MODEL_PATH


def train_model(dataset_path: Path = DATASET_PATH, model_path: Path = MODEL_PATH) -> dict[str, float]:
    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}. Run python -m ml.build_dataset first.")

    dataset = pd.read_csv(dataset_path)
    missing = [column for column in FEATURE_COLUMNS + ["target_total_score"] if column not in dataset.columns]
    if missing:
        raise ValueError(f"Dataset is missing required columns: {missing}")

    x = dataset[FEATURE_COLUMNS].fillna(0)
    y = dataset["target_total_score"]
    x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=42)

    candidates = {
        "hist_gradient_boosting": HistGradientBoostingRegressor(random_state=42),
        "random_forest": RandomForestRegressor(n_estimators=120, random_state=42, n_jobs=-1),
    }

    best_name = ""
    best_model = None
    best_mae = float("inf")
    metrics: dict[str, float] = {}

    for name, model in candidates.items():
        model.fit(x_train, y_train)
        predictions = model.predict(x_test)
        mae = float(mean_absolute_error(y_test, predictions))
        metrics[f"{name}_mae"] = mae
        if mae < best_mae:
            best_name = name
            best_model = model
            best_mae = mae

    if best_model is None:
        raise RuntimeError("No model was trained.")

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": best_model, "feature_columns": FEATURE_COLUMNS}, model_path)
    METADATA_PATH.write_text(
        json.dumps(
            {
                "best_model": best_name,
                "mae": best_mae,
                "rows": int(len(dataset)),
                "feature_columns": FEATURE_COLUMNS,
                "metrics": metrics,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    return {"mae": best_mae, "rows": float(len(dataset))}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train DraftForMe champion recommendation model.")
    parser.add_argument("--dataset", type=Path, default=DATASET_PATH)
    parser.add_argument("--model", type=Path, default=MODEL_PATH)
    args = parser.parse_args()

    metrics = train_model(args.dataset, args.model)
    print(f"Trained model with MAE={metrics['mae']:.3f} on {int(metrics['rows'])} rows")


if __name__ == "__main__":
    main()
