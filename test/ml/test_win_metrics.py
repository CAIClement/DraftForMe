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


def test_losses_stay_finite_for_certain_wrong_predictions():
    losses = match_losses(np.array([1, 0]), np.array([0.0, 1.0]))

    assert np.isfinite(losses).all()


def test_identical_predictions_give_a_zero_interval():
    rng = np.random.default_rng(0)
    labels = rng.integers(0, 2, size=500)
    probabilities = rng.uniform(0.2, 0.8, size=500)

    result = paired_bootstrap(labels, probabilities, probabilities)

    assert result == {"difference": 0.0, "low": 0.0, "high": 0.0}


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


def test_calibration_table_bins_predictions_and_reports_observed_rates():
    labels = np.array([0, 1, 1, 1])
    probabilities = np.array([0.05, 0.15, 0.95, 1.0])

    table = calibration_table(labels, probabilities, bins=10)

    assert len(table) == 10
    assert table[0]["matches"] == 1 and table[0]["observed"] == 0
    assert table[1]["matches"] == 1 and table[1]["observed"] == 1
    assert table[9]["matches"] == 2 and table[9]["predicted"] == pytest.approx(0.975)
    assert table[5]["matches"] == 0 and table[5]["predicted"] is None
