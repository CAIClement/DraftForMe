from __future__ import annotations

from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data"
ML_DIR = PROJECT_ROOT / "ml"
ARTIFACT_DIR = ML_DIR / "artifacts"
DATASET_PATH = ARTIFACT_DIR / "training_dataset.csv"
MODEL_PATH = ARTIFACT_DIR / "champion_recommender.joblib"
METADATA_PATH = ARTIFACT_DIR / "champion_recommender_metadata.json"

DEFAULT_REGION = "euw"
DEFAULT_TIER = "emerald_plus"
ROLES = ("top", "jungle", "mid", "adc", "support")
