"""Scores for probabilities of a blue win, and the paired bootstrap that decides between two models."""

from __future__ import annotations

from typing import Any

import numpy as np
from scipy.stats import trim_mean
from sklearn.metrics import roc_auc_score

EPSILON = 1e-15
BOOTSTRAP_RESAMPLES = 10000
BOOTSTRAP_CHUNK = 200
TRIM_PROPORTION = 0.005
WORST_MATCHES = 10


def match_losses(labels: np.ndarray, probabilities: np.ndarray) -> np.ndarray:
    """Log loss of each match on its own."""
    clipped = np.clip(probabilities, EPSILON, 1 - EPSILON)
    return -(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped))


def summary(labels: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    if len(labels) == 0:
        raise ValueError("aucune partie a evaluer")
    losses = match_losses(labels, probabilities)
    worst = np.sort(losses)[-WORST_MATCHES:]
    both_outcomes = len(np.unique(labels)) == 2
    ties = probabilities == 0.5
    correct = np.where(ties, 0.5, ((probabilities > 0.5) == (labels == 1)).astype(float))
    return {
        "matches": int(len(labels)),
        "log_loss": float(losses.mean()),
        "auc": float(roc_auc_score(labels, probabilities)) if both_outcomes else None,
        "accuracy": float(correct.mean()),
        "worst_share": float(worst.sum() / losses.sum()),
    }


def paired_bootstrap(
    labels: np.ndarray,
    reference: np.ndarray,
    model: np.ndarray,
    *,
    groups: np.ndarray | None = None,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = 0,
) -> dict[str, float]:
    """Log loss of `reference` minus log loss of `model`, with a 95 % interval.

    Both are resampled on the same matches, so the interval reflects how much the gap
    itself varies. A positive difference means the model is better.

    When `groups` is given, whole groups are resampled together instead of individual
    matches: matches of one seed player share a tier and a seed champion, so resampling
    them independently can understate how much the gap varies.
    """
    if len(labels) == 0:
        raise ValueError("aucune partie a evaluer")
    differences = match_losses(labels, reference) - match_losses(labels, model)
    rng = np.random.default_rng(seed)
    means = []
    remaining = resamples

    if groups is None:
        while remaining:
            size = min(BOOTSTRAP_CHUNK, remaining)
            draws = rng.integers(0, len(differences), size=(size, len(differences)))
            means.append(differences[draws].mean(axis=1))
            remaining -= size
    else:
        _, indices = np.unique(groups, return_inverse=True)
        indices = indices.reshape(-1)
        n_groups = indices.max() + 1
        group_sums = np.bincount(indices, weights=differences, minlength=n_groups)
        group_counts = np.bincount(indices, minlength=n_groups)
        while remaining:
            size = min(BOOTSTRAP_CHUNK, remaining)
            draws = rng.integers(0, n_groups, size=(size, n_groups))
            totals = group_sums[draws].sum(axis=1)
            counts = group_counts[draws].sum(axis=1)
            means.append(totals / counts)
            remaining -= size

    samples = np.concatenate(means)
    return {
        "difference": float(differences.mean()),
        "low": float(np.percentile(samples, 2.5)),
        "high": float(np.percentile(samples, 97.5)),
        "trimmed_difference": float(trim_mean(differences, TRIM_PROPORTION)),
    }


def calibration_table(labels: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict[str, Any]]:
    """Predicted against observed blue win rate, in quantile probability bins.

    Equal-width bins leave most of them empty when predictions cluster near 0.5, which is
    typical for drafts. Quantile edges are deduplicated, so a degenerate input (every
    probability identical) collapses to one bin holding everything instead of crashing.
    """
    raw_edges = np.quantile(probabilities, np.linspace(0, 1, bins + 1))
    edges = np.unique(raw_edges)
    if len(edges) == 1:
        edges = np.array([edges[0], edges[0]])
    n_bins = len(edges) - 1
    indices = np.clip(np.digitize(probabilities, edges[1:-1]), 0, n_bins - 1)

    table = []
    for index in range(bins):
        if index < n_bins:
            in_bin = indices == index
            low, high = edges[index], edges[index + 1]
        else:
            in_bin = np.zeros(len(probabilities), dtype=bool)
            low, high = edges[-1], edges[-1]
        count = int(in_bin.sum())
        table.append(
            {
                "low": float(low),
                "high": float(high),
                "matches": count,
                "predicted": float(probabilities[in_bin].mean()) if count else None,
                "observed": float(labels[in_bin].mean()) if count else None,
            }
        )
    return table
