"""The candidate models, and choosing between them on validation log loss."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Protocol

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

from ml.win.baselines import RateTables
from ml.win.data import Dataset
from ml.win.encoding import STAGES, DraftEncoder, with_masked_copies
from ml.win.metrics import summary

MASKED_COPIES = 2
LOGISTIC_C_GRID = (0.003, 0.01, 0.03, 0.1, 0.3, 1.0)
BOOSTING_GRID = (
    {"learning_rate": 0.05, "max_leaf_nodes": 15, "l2_regularization": 1.0},
    {"learning_rate": 0.1, "max_leaf_nodes": 31, "l2_regularization": 1.0},
    {"learning_rate": 0.05, "max_leaf_nodes": 31, "l2_regularization": 10.0},
)
BOOSTING_ITERATIONS = 200
AGGREGATE_FOLDS = 5


class DraftModel(Protocol):
    kind: str
    name: str

    def fit(self, train: Dataset) -> DraftModel: ...

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray: ...


class LogisticDraftModel:
    kind = "logistic"

    def __init__(self, stage: int, c: float, seed: int) -> None:
        self.stage = stage
        self.c = c
        self.seed = seed
        self.name = f"régression logistique, palier {stage}, C={c}"

    def fit(self, train: Dataset) -> LogisticDraftModel:
        rng = np.random.default_rng(self.seed)
        drafts, labels, tiers, _ = with_masked_copies(train.drafts, train.labels, train.tiers, MASKED_COPIES, rng)
        # Columns come from the full drafts only: masked copies must not inflate pair counts.
        self.encoder = DraftEncoder(self.stage).fit(train.drafts, train.tiers)
        self.model = LogisticRegression(C=self.c, max_iter=5000)
        self.model.fit(self.encoder.transform(drafts, tiers), labels)
        return self

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(self.encoder.transform(drafts, tiers))[:, 1]

    def weights(self) -> dict[str, Any]:
        """Everything needed to score a draft without scikit-learn: intercept plus one weight per feature key."""
        coefficients = self.model.coef_[0]
        return {
            "stage": self.stage,
            "c": self.c,
            "intercept": float(self.model.intercept_[0]),
            "features": [
                {"key": list(key), "weight": float(coefficients[index])}
                for key, index in sorted(self.encoder.columns.items(), key=lambda item: item[1])
            ],
        }

    def top_weights(self, count: int = 10) -> list[dict[str, Any]]:
        features = self.weights()["features"]
        return sorted(features, key=lambda feature: abs(feature["weight"]), reverse=True)[:count]


def aggregate_features(tables: RateTables, drafts: np.ndarray) -> np.ndarray:
    """Blue and red summed champion log-odds, then the five lane matchup log-odds."""
    return np.hstack([tables.team_sums(drafts), tables.lane_terms(drafts)])


class BoostingDraftModel:
    kind = "boosting"

    def __init__(self, params: dict[str, float], seed: int) -> None:
        self.params = params
        self.seed = seed
        described = ", ".join(f"{key}={value}" for key, value in params.items())
        self.name = f"gradient boosting, {described}"

    def fit(self, train: Dataset) -> BoostingDraftModel:
        rng = np.random.default_rng(self.seed)
        drafts, labels, tiers, origin = with_masked_copies(train.drafts, train.labels, train.tiers, MASKED_COPIES, rng)
        self.encoder = DraftEncoder(1).fit(train.drafts, train.tiers)

        # Out of fold: a row's aggregates come from tables that never saw its own match.
        folds = np.random.default_rng(self.seed).permutation(len(train)) % AGGREGATE_FOLDS
        aggregates = np.zeros((len(drafts), 7))
        for fold in range(AGGREGATE_FOLDS):
            tables = RateTables().fit(train.drafts[folds != fold], train.labels[folds != fold])
            rows = folds[origin] == fold
            aggregates[rows] = aggregate_features(tables, drafts[rows])

        self.tables = RateTables().fit(train.drafts, train.labels)
        self.model = HistGradientBoostingClassifier(
            max_iter=BOOSTING_ITERATIONS, early_stopping=False, random_state=self.seed, **self.params
        )
        self.model.fit(self._matrix(drafts, tiers, aggregates), labels)
        return self

    def _matrix(self, drafts: np.ndarray, tiers: np.ndarray, aggregates: np.ndarray) -> np.ndarray:
        return np.hstack([self.encoder.transform(drafts, tiers).toarray(), aggregates]).astype(np.float32)

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        matrix = self._matrix(drafts, tiers, aggregate_features(self.tables, drafts))
        return self.model.predict_proba(matrix)[:, 1]


def candidate_models(seed: int) -> list[DraftModel]:
    logistic: list[DraftModel] = [LogisticDraftModel(stage, c, seed) for stage in STAGES for c in LOGISTIC_C_GRID]
    boosting: list[DraftModel] = [BoostingDraftModel(params, seed) for params in BOOSTING_GRID]
    return logistic + boosting


def select_model(
    train: Dataset,
    validation: Dataset,
    candidates: Sequence[DraftModel],
    log: Callable[[str], None] = print,
) -> tuple[DraftModel, list[dict[str, Any]]]:
    """Fits every candidate on training and keeps the one with the lowest validation log loss."""
    rows: list[dict[str, Any]] = []
    best: DraftModel | None = None
    best_loss = float("inf")
    for model in candidates:
        model.fit(train)
        result = summary(validation.labels, model.predict(validation.drafts, validation.tiers))
        rows.append({"model": model.name, "kind": model.kind, **result})
        log(f"  {model.name} : log loss {result['log_loss']:.4f}")
        if result["log_loss"] < best_loss:
            best, best_loss = model, result["log_loss"]
    assert best is not None, "select_model needs at least one candidate"
    return best, rows
