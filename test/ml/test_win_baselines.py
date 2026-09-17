import math

import numpy as np
import pytest

from ml.paths import SEED_SQL_PATH
from ml.win.baselines import (
    ChampionPrior,
    RateTables,
    References,
    ScoreCalibration,
    SeedDataError,
    champion_total,
    champions_missing_from_engine,
    engine_scores,
    engine_weights,
    load_engine_data,
    meta_score,
    score_counter,
    win_rate_log_odds,
)
from ml.win.encoding import swap_sides
from ml.win.metrics import summary
from win_fixtures import random_drafts, write_seed_sql

# The fixtures of src/lib/recommendation/counter.test.ts: zed is countered by galio; diana by zed.
COUNTER_RELATIONS = {("zed", "galio"), ("diana", "zed")}


def test_score_counter_matches_the_site_engine_cases():
    assert score_counter("galio", [], COUNTER_RELATIONS) == 50
    assert score_counter("galio", ["orianna"], COUNTER_RELATIONS) == 50
    assert score_counter("galio", ["zed"], COUNTER_RELATIONS) == 85
    assert score_counter("diana", ["zed"], COUNTER_RELATIONS) == 15
    # A known edge is diluted by an enemy with no known relation.
    assert score_counter("galio", ["zed", "orianna"], COUNTER_RELATIONS) == 67.5


def test_engine_weights_match_compute_weights_without_a_pool():
    assert engine_weights(False) == pytest.approx((0.95, 0.05, 0.0))
    assert engine_weights(True) == pytest.approx((0.57, 0.03, 0.40))


def test_meta_score_matches_the_site_formula_and_clamps():
    assert meta_score(1, 3) == 100
    assert meta_score(2, 3) == pytest.approx(70)
    assert meta_score(8, 3) == 0


def engine_fixture(tmp_path):
    # The counter fixtures of src/lib/recommendation/engine.test.ts: ahri, orianna, zed ranked 1, 2, 3 in mid;
    # zed is countered by orianna, ahri is countered by zed. Rows are out of order on purpose: rank comes
    # from win rate, as on the site.
    seed = write_seed_sql(
        tmp_path / "seed.sql",
        champions={"ahri": 103, "orianna": 61, "zed": 238, "garen": 86},
        stats=[("zed", "mid", 50.0), ("ahri", "mid", 52.0), ("orianna", "mid", 51.0), ("garen", "top", 50.0)],
        relations=[("zed", "orianna", "mid"), ("ahri", "zed", "mid")],
    )
    return load_engine_data(seed)


def test_champion_totals_reproduce_the_engine_test_scores(tmp_path):
    data = engine_fixture(tmp_path)

    # engine.test.ts: "orianna 74.05 against ahri 63.15" when the enemy has picked zed.
    assert champion_total("orianna", "mid", ["zed"], data) == pytest.approx(74.05)
    assert champion_total("ahri", "mid", ["zed"], data) == pytest.approx(63.15)


def test_ranks_come_from_win_rate_order_within_each_role(tmp_path):
    data = engine_fixture(tmp_path)

    assert data.meta_by_role["mid"] == pytest.approx({"ahri": 100, "orianna": 70, "zed": 40})
    assert data.meta_by_role["top"] == {"garen": 100}
    assert data.slug_by_key[103] == "ahri"
    assert data.win_rate_by_role["mid"] == pytest.approx({"ahri": 52.0, "orianna": 51.0, "zed": 50.0})


def test_ties_in_win_rate_are_broken_by_slug(tmp_path):
    # ahri and orianna are tied at 52.0 in mid; zed trails at 50.0. The site's own order on a tie
    # is undefined, so the port breaks it by slug: ahri ranks ahead of orianna.
    seed = write_seed_sql(
        tmp_path / "seed.sql",
        champions={"ahri": 103, "orianna": 61, "zed": 238},
        stats=[("zed", "mid", 50.0), ("ahri", "mid", 52.0), ("orianna", "mid", 52.0)],
    )
    data = load_engine_data(seed)

    assert data.meta_by_role["mid"] == pytest.approx({"ahri": 100, "orianna": 70, "zed": 40})


def test_a_champion_missing_from_the_statistics_gets_a_neutral_meta_score(tmp_path):
    data = engine_fixture(tmp_path)

    # 55 * 0.95 + 5 * 0.05, with no enemy known.
    assert champion_total("garen", "mid", [], data) == pytest.approx(52.5)
    assert champion_total(None, "mid", [], data) == pytest.approx(52.5)
    drafts = np.array([[86, 0, 103, 0, 0, 999, 0, 238, 0, 0]])
    assert champions_missing_from_engine(drafts, data) == 1


def test_engine_scores_are_team_differences_and_antisymmetric(tmp_path):
    data = engine_fixture(tmp_path)
    drafts = np.array([[0, 0, 61, 0, 0, 0, 0, 238, 0, 0], [0, 0, 103, 0, 0, 0, 0, 238, 0, 0]])

    scores = engine_scores(drafts, data)

    # Orianna into zed: 74.05 against zed's 40 * 0.57 + 0.15 + 15 * 0.4 = 28.95.
    # Ahri into zed: 63.15 against zed's 40 * 0.57 + 0.15 + 85 * 0.4 = 56.95.
    assert scores == pytest.approx([45.1, 6.2])
    assert np.allclose(engine_scores(swap_sides(drafts), data), -scores)


def test_reads_the_real_seed_file():
    data = load_engine_data(SEED_SQL_PATH)

    assert len(data.slug_by_key) == 172
    assert set(data.meta_by_role) == {"top", "jungle", "mid", "adc", "support"}
    assert sum(len(relations) for relations in data.relations_by_role.values()) == 725
    assert set(data.win_rate_by_role) == {"top", "jungle", "mid", "adc", "support"}
    for role, rates in data.win_rate_by_role.items():
        assert set(rates) == set(data.meta_by_role[role])
        assert all(0 < rate < 100 for rate in rates.values())


def test_refuses_a_missing_or_empty_seed_file(tmp_path):
    with pytest.raises(SeedDataError):
        load_engine_data(tmp_path / "absent.sql")

    empty = tmp_path / "empty.sql"
    empty.write_text("-- nothing\n", encoding="utf-8")
    with pytest.raises(SeedDataError):
        load_engine_data(empty)


def test_rate_tables_smooth_towards_even_odds():
    drafts = np.array([[101, 0, 0, 0, 0, 102, 0, 0, 0, 0]] * 4)
    labels = np.array([1, 1, 1, 0])

    tables = RateTables(prior_games=20).fit(drafts, labels)

    assert tables.champion[(0, 101)] == pytest.approx(math.log(13 / 11))
    assert tables.champion[(0, 102)] == pytest.approx(math.log(11 / 13))
    assert tables.lane[(0, 101, 102)] == pytest.approx(math.log(13 / 11))
    sums = tables.team_sums(drafts[:1])
    assert sums[0] == pytest.approx([math.log(13 / 11), math.log(11 / 13)])
    assert tables.lane_terms(swap_sides(drafts[:1]))[0, 0] == pytest.approx(-math.log(13 / 11))


def test_score_calibration_maps_scores_to_probabilities():
    rng = np.random.default_rng(0)
    scores = rng.normal(size=3000)
    labels = (rng.uniform(size=3000) < 1 / (1 + np.exp(-2 * scores))).astype(int)

    probabilities = ScoreCalibration().fit(scores, labels).predict(np.array([-3.0, 0.0, 3.0]))

    assert probabilities[0] < 0.05 and probabilities[2] > 0.95
    assert probabilities[1] == pytest.approx(0.5, abs=0.05)


def test_the_win_rate_reference_learns_a_dominant_champion(tmp_path):
    data = engine_fixture(tmp_path)
    rng = np.random.default_rng(0)
    drafts = random_drafts(3000, rng)
    blue_has = (drafts[:, 0] == 101).astype(float) - (drafts[:, 5] == 101).astype(float)
    labels = (rng.uniform(size=3000) < 1 / (1 + np.exp(-2 * blue_has))).astype(int)

    references = References(data).fit(drafts[:2000], labels[:2000])
    predictions = references.predict(drafts[2000:])

    rates = summary(labels[2000:], predictions[References.WIN_RATES])
    engine = summary(labels[2000:], predictions[References.ENGINE])
    assert rates["log_loss"] < engine["log_loss"]
    assert set(predictions) == {References.ENGINE, References.WIN_RATES}


# --- champion priors from public statistics -----------------------------------------


def prior_fixture(tmp_path):
    # mid: ahri ranked at 60 %, zed at 40 %. top: only garen, at 55 %. jungle/adc/support unranked.
    seed = write_seed_sql(
        tmp_path / "seed.sql",
        champions={"ahri": 103, "zed": 238, "garen": 86, "orianna": 61},
        stats=[("ahri", "mid", 60.0), ("zed", "mid", 40.0), ("garen", "top", 55.0), ("orianna", "adc", 65.0)],
    )
    return ChampionPrior(load_engine_data(seed))


def test_log_odds_matches_the_win_rate_in_that_role(tmp_path):
    prior = prior_fixture(tmp_path)

    assert prior.log_odds(103, "mid") == pytest.approx(win_rate_log_odds(60.0))
    assert prior.log_odds(238, "mid") == pytest.approx(win_rate_log_odds(40.0))


def test_log_odds_falls_back_to_the_mean_of_ranked_roles_then_to_neutral(tmp_path):
    prior = prior_fixture(tmp_path)

    # orianna is ranked in adc only: mid falls back to that single value.
    assert prior.log_odds(61, "mid") == pytest.approx(win_rate_log_odds(65.0))
    # garen is ranked in top only: jungle falls back to that single value too.
    assert prior.log_odds(86, "jungle") == pytest.approx(win_rate_log_odds(55.0))
    # a champion the statistics never rank anywhere, and a hidden pick, are both neutral.
    assert prior.log_odds(9999, "mid") == 0.0
    assert prior.log_odds(0, "mid") == 0.0


def test_prior_features_are_antisymmetric_and_the_sixth_is_the_sum(tmp_path):
    prior = prior_fixture(tmp_path)
    drafts = np.array([[103, 0, 0, 61, 0, 238, 0, 0, 0, 0]])

    features = prior.features(drafts)

    assert features.shape == (1, 6)
    assert features[0, 5] == pytest.approx(features[0, :5].sum())
    assert np.allclose(prior.features(swap_sides(drafts)), -features)


def test_prior_features_treat_a_hidden_or_unknown_pick_as_zero(tmp_path):
    prior = prior_fixture(tmp_path)
    drafts = np.array([[103, 0, 0, 0, 0, 0, 0, 0, 0, 0], [9999, 0, 0, 0, 0, 0, 0, 0, 0, 0]])

    features = prior.features(drafts)

    assert features[0, 0] == pytest.approx(win_rate_log_odds(60.0))
    assert features[0, 1:5].sum() == 0
    assert features[1] == pytest.approx([0.0] * 6)
