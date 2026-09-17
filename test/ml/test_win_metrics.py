import math

import numpy as np
import pytest

from ml.win.metrics import calibration_table, match_losses, paired_bootstrap, summary


def test_summary_reports_log_loss_auc_and_accuracy():
    labels = np.array([1, 0, 1, 0])
    probabilities = np.array([0.8, 0.3, 0.6, 0.6])

    result = summary(labels, probabilities)

    expected_loss = -(math.log(0.8) + math.log(0.7) + math.log(0.6) + math.log(0.4)) / 4
    assert result["matches"] == 4
    assert result["log_loss"] == pytest.approx(expected_loss)
    assert result["accuracy"] == pytest.approx(0.75)
    assert result["auc"] == pytest.approx(0.875)


def test_summary_has_no_auc_when_only_one_outcome_is_present():
    assert summary(np.array([1, 1]), np.array([0.6, 0.7]))["auc"] is None


def test_accuracy_does_not_credit_a_tie():
    labels = np.array([1, 1, 1, 0])
    probabilities = np.full(4, 0.5)

    result = summary(labels, probabilities)

    assert result["accuracy"] == pytest.approx(0.5)


def test_losses_stay_finite_for_certain_wrong_predictions():
    losses = match_losses(np.array([1, 0]), np.array([0.0, 1.0]))

    assert np.isfinite(losses).all()


def test_empty_input_raises():
    empty = np.array([])

    with pytest.raises(ValueError):
        summary(empty, empty)

    with pytest.raises(ValueError):
        paired_bootstrap(empty, empty, empty)


def test_identical_predictions_give_a_zero_interval():
    rng = np.random.default_rng(0)
    labels = rng.integers(0, 2, size=500)
    probabilities = rng.uniform(0.2, 0.8, size=500)

    result = paired_bootstrap(labels, probabilities, probabilities)

    assert result == {"difference": 0.0, "low": 0.0, "high": 0.0, "trimmed_difference": 0.0}


def test_a_model_better_by_the_same_amount_on_every_match_gets_that_exact_interval():
    labels = np.ones(300, dtype=int)
    reference = np.full(300, 0.5)
    model = np.full(300, 0.6)
    gap = math.log(0.6) - math.log(0.5)

    result = paired_bootstrap(labels, reference, model)

    assert result["difference"] == pytest.approx(gap)
    assert result["low"] == pytest.approx(gap)
    assert result["high"] == pytest.approx(gap)


def test_a_noisy_but_real_improvement_has_an_interval_above_zero_that_contains_the_mean():
    rng = np.random.default_rng(1)
    truth = rng.uniform(0.3, 0.7, size=4000)
    labels = (rng.uniform(size=4000) < truth).astype(int)

    result = paired_bootstrap(labels, np.full(4000, 0.5), truth, seed=3)

    assert 0 < result["low"] < result["difference"] < result["high"]
    assert result == paired_bootstrap(labels, np.full(4000, 0.5), truth, seed=3)


def test_a_model_that_is_no_better_does_not_clear_zero():
    rng = np.random.default_rng(2)
    truth = rng.uniform(0.3, 0.7, size=4000)
    labels = (rng.uniform(size=4000) < truth).astype(int)
    reference = np.clip(truth + rng.normal(0, 0.05, size=4000), 0.01, 0.99)
    model = np.clip(truth + rng.normal(0, 0.05, size=4000), 0.01, 0.99)

    result = paired_bootstrap(labels, reference, model, seed=4)

    assert result["low"] < 0 < result["high"]


def test_grouped_resampling_widens_the_interval_when_the_gap_varies_by_player():
    rng = np.random.default_rng(5)
    n_players = 150
    matches_per_player = 30
    player_offsets = rng.normal(0, 0.05, size=n_players)
    groups = np.repeat(np.arange(n_players), matches_per_player)
    model = np.repeat(np.clip(0.6 + player_offsets, 0.05, 0.95), matches_per_player)
    labels = np.ones(n_players * matches_per_player, dtype=int)
    reference = np.full(n_players * matches_per_player, 0.5)

    ungrouped = paired_bootstrap(labels, reference, model, seed=6)
    grouped = paired_bootstrap(labels, reference, model, groups=groups, seed=6)

    ungrouped_width = ungrouped["high"] - ungrouped["low"]
    grouped_width = grouped["high"] - grouped["low"]
    assert grouped_width >= 1.5 * ungrouped_width
    assert grouped["difference"] == pytest.approx(ungrouped["difference"])


def test_a_few_certain_and_wrong_predictions_show_up_in_the_diagnostics():
    labels = np.ones(600, dtype=int)
    reference = np.full(600, math.exp(-0.30))
    model = np.concatenate([np.zeros(3), np.full(597, math.exp(-0.15))])

    result = paired_bootstrap(labels, reference, model, seed=7)
    model_summary = summary(labels, model)

    assert result["difference"] < 0 < result["trimmed_difference"]
    assert model_summary["worst_share"] > 0.5


def test_calibration_table_bins_predictions_and_reports_observed_rates():
    probabilities = np.array([0.02, 0.05, 0.12, 0.20, 0.28, 0.40, 0.50, 0.62, 0.75, 0.85, 0.99])
    labels = np.array([0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0])

    table = calibration_table(labels, probabilities, bins=10)

    assert len(table) == 10
    assert table[0]["matches"] == 1 and table[0]["observed"] == 0
    assert table[1]["matches"] == 1 and table[1]["observed"] == 1
    assert table[9]["matches"] == 2
    assert table[9]["predicted"] == pytest.approx((0.85 + 0.99) / 2)
    assert table[9]["observed"] == pytest.approx(0.5)


def test_calibration_bins_hold_similar_numbers_of_matches():
    rng = np.random.default_rng(8)
    probabilities = np.clip(rng.normal(0.5, 0.01, size=1000), 0.4, 0.6)
    labels = rng.integers(0, 2, size=1000)

    table = calibration_table(labels, probabilities, bins=10)

    assert all(row["matches"] >= 50 for row in table)

    constant_table = calibration_table(np.array([0, 1, 0, 1]), np.full(4, 0.5), bins=10)
    assert sum(row["matches"] for row in constant_table) == 4
    assert constant_table[0]["matches"] == 4
