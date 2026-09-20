"""The candidate models, and choosing between them on validation log loss.

Full drafts are weighted so they carry the same total weight as their masked copies combined: half
the training objective instead of a third, while partial drafts are still learned.
"""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Protocol

import numpy as np
from scipy import sparse
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

from ml.win.baselines import ChampionPrior, RateTables
from ml.win.data import ROLES, Dataset
from ml.win.encoding import STAGES, DraftEncoder, with_masked_copies
from ml.win.metrics import summary

MASKED_COPIES = 2
# Every match then carries the same total weight as its masked copies together, so full drafts are
# half the objective instead of a third, while partial drafts are still learned.
MASKED_WEIGHT = 1 / MASKED_COPIES
LOGISTIC_C_GRID = (0.0003, 0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0)
# The six champion-prior feature keys, in the order `ChampionPrior.features` produces its columns.
PRIOR_FEATURE_KEYS = [("prior", role) for role in ROLES] + [("prior", "total")]
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

    def __init__(self, stage: int, c: float, seed: int, prior: ChampionPrior) -> None:
        self.stage = stage
        self.c = c
        self.seed = seed
        self.prior = prior
        self.name = f"régression logistique, palier {stage}, C={c}"

    def _design(self, drafts: np.ndarray, tiers: np.ndarray) -> sparse.csr_matrix:
        encoded = self.encoder.transform(drafts, tiers)
        prior_features = sparse.csr_matrix(self.prior.features(drafts))
        return sparse.hstack([encoded, prior_features], format="csr")

    def fit(self, train: Dataset) -> LogisticDraftModel:
        rng = np.random.default_rng(self.seed)
        drafts, labels, tiers, _ = with_masked_copies(train.drafts, train.labels, train.tiers, MASKED_COPIES, rng)
        # Columns come from the full drafts only: masked copies must not inflate pair counts.
        self.encoder = DraftEncoder(self.stage).fit(train.drafts, train.tiers)
        sample_weight = np.concatenate(
            [np.full(len(train), 1.0), np.full(len(drafts) - len(train), MASKED_WEIGHT)]
        )
        self.model = LogisticRegression(C=self.c, max_iter=5000)
        self.model.fit(self._design(drafts, tiers), labels, sample_weight=sample_weight)
        return self

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(self._design(drafts, tiers))[:, 1]

    def weights(self) -> dict[str, Any]:
        """Everything needed to score a draft without scikit-learn: intercept plus one weight per feature key,
        the champion-by-role features from the encoder followed by the six named prior features."""
        coefficients = self.model.coef_[0]
        n_encoded = len(self.encoder.columns)
        features = [
            {"key": list(key), "weight": float(coefficients[index])}
            for key, index in sorted(self.encoder.columns.items(), key=lambda item: item[1])
        ]
        features += [
            {"key": list(key), "weight": float(coefficients[n_encoded + offset])}
            for offset, key in enumerate(PRIOR_FEATURE_KEYS)
        ]
        return {
            "stage": self.stage,
            "c": self.c,
            "intercept": float(self.model.intercept_[0]),
            "features": features,
            "prior_table": self._prior_table(),
        }

    def _prior_table(self) -> list[dict[str, Any]]:
        """Every champion key the prior knows, with the log-odds it uses in each role (its own
        off-role fallback already applied), so project 3 can recompute the prior features without
        `ChampionPrior` or `supabase/seed.sql`."""
        return [
            {"champion": key, "role": role, "log_odds": self.prior.log_odds(key, role)}
            for key in sorted(self.prior.data.slug_by_key)
            for role in ROLES
        ]

    def top_weights(self, count: int = 10) -> list[dict[str, Any]]:
        features = self.weights()["features"]
        return sorted(features, key=lambda feature: abs(feature["weight"]), reverse=True)[:count]


def aggregate_features(tables: RateTables, drafts: np.ndarray) -> np.ndarray:
    """Blue and red summed champion log-odds, then the five lane matchup log-odds."""
    return np.hstack([tables.team_sums(drafts), tables.lane_terms(drafts)])


class BoostingDraftModel:
    kind = "boosting"

    def __init__(self, params: dict[str, float], seed: int, prior: ChampionPrior) -> None:
        self.params = params
        self.seed = seed
        self.prior = prior
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

        # Kept so tests can check that a row's aggregates never see its own outcome.
        self.train_aggregates_ = aggregates

        self.tables = RateTables().fit(train.drafts, train.labels)
        sample_weight = np.concatenate(
            [np.full(len(train), 1.0), np.full(len(drafts) - len(train), MASKED_WEIGHT)]
        )
        self.model = HistGradientBoostingClassifier(
            max_iter=BOOSTING_ITERATIONS, early_stopping=False, random_state=self.seed, **self.params
        )
        self.model.fit(self._matrix(drafts, tiers, aggregates), labels, sample_weight=sample_weight)
        return self

    def _matrix(self, drafts: np.ndarray, tiers: np.ndarray, aggregates: np.ndarray) -> np.ndarray:
        return np.hstack(
            [self.encoder.transform(drafts, tiers).toarray(), self.prior.features(drafts), aggregates]
        ).astype(np.float32)

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        matrix = self._matrix(drafts, tiers, aggregate_features(self.tables, drafts))
        return self.model.predict_proba(matrix)[:, 1]


def candidate_models(seed: int, prior: ChampionPrior) -> list[DraftModel]:
    logistic: list[DraftModel] = [
        LogisticDraftModel(stage, c, seed, prior) for stage in STAGES for c in LOGISTIC_C_GRID
    ]
    boosting: list[DraftModel] = [BoostingDraftModel(params, seed, prior) for params in BOOSTING_GRID]
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
