"""Scores for probabilities of a blue win, and the paired bootstrap that decides between two models."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import roc_auc_score

EPSILON = 1e-15
BOOTSTRAP_RESAMPLES = 2000
BOOTSTRAP_CHUNK = 200


def match_losses(labels: np.ndarray, probabilities: np.ndarray) -> np.ndarray:
    """Log loss of each match on its own."""
    clipped = np.clip(probabilities, EPSILON, 1 - EPSILON)
    return -(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped))


def summary(labels: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    both_outcomes = len(np.unique(labels)) == 2
    return {
        "matches": int(len(labels)),
        "log_loss": float(match_losses(labels, probabilities).mean()),
        "auc": float(roc_auc_score(labels, probabilities)) if both_outcomes else None,
        "accuracy": float(((probabilities >= 0.5) == (labels == 1)).mean()),
    }


def paired_bootstrap(
    labels: np.ndarray,
    reference: np.ndarray,
    model: np.ndarray,
    *,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = 0,
) -> dict[str, float]:
    """Log loss of `reference` minus log loss of `model`, with a 95 % interval.

    Both are resampled on the same matches, so the interval reflects how much the gap
    itself varies. A positive difference means the model is better.
    """
    differences = match_losses(labels, reference) - match_losses(labels, model)
    rng = np.random.default_rng(seed)
    means = []
    remaining = resamples
    while remaining:
        size = min(BOOTSTRAP_CHUNK, remaining)
        draws = rng.integers(0, len(differences), size=(size, len(differences)))
        means.append(differences[draws].mean(axis=1))
        remaining -= size
    samples = np.concatenate(means)
    return {
        "difference": float(differences.mean()),
        "low": float(np.percentile(samples, 2.5)),
        "high": float(np.percentile(samples, 97.5)),
    }


def calibration_table(labels: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict[str, Any]]:
    """Predicted against observed blue win rate, in equal-width probability bins."""
    edges = np.linspace(0, 1, bins + 1)
    indices = np.clip(np.digitize(probabilities, edges[1:-1]), 0, bins - 1)
    table = []
    for index in range(bins):
        in_bin = indices == index
        count = int(in_bin.sum())
        table.append(
            {
                "low": float(edges[index]),
                "high": float(edges[index + 1]),
                "matches": count,
                "predicted": float(probabilities[in_bin].mean()) if count else None,
                "observed": float(labels[in_bin].mean()) if count else None,
            }
        )
    return table
