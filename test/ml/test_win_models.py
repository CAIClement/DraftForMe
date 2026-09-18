import json
import math

import numpy as np

from ml.win.baselines import ChampionPrior, References, load_engine_data
from ml.win.data import ROLES, Dataset
from ml.win.encoding import draft_terms, hide_picks
from ml.win.metrics import summary
from ml.win.models import AGGREGATE_FOLDS, BoostingDraftModel, LogisticDraftModel, candidate_models, select_model
from win_fixtures import neutral_prior, random_drafts, write_seed_sql


def dataset(drafts, labels, tier="GOLD"):
    return Dataset(
        match_ids=np.array([f"EUW1_{index}" for index in range(len(drafts))]),
        drafts=drafts,
        labels=labels,
        tiers=np.array([tier] * len(drafts)),
        groups=np.array([f"player-{index // 5}" for index in range(len(drafts))]),
    )


def synergy_world(count, seed):
    """Wins depend only on whether a team's adc and support are 'matched': both the planted pair, or neither."""
    rng = np.random.default_rng(seed)
    drafts = random_drafts(count, rng, champions_per_role=3)

    def matched(adc, support):
        return np.where((adc == 401) == (support == 501), 1.0, -1.0)

    logit = 1.5 * (matched(drafts[:, 3], drafts[:, 4]) - matched(drafts[:, 8], drafts[:, 9]))
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(np.int64)
    return drafts, labels


def dominant_champion_world(count, seed):
    rng = np.random.default_rng(seed)
    drafts = random_drafts(count, rng)
    logit = 1.5 * ((drafts[:, 0] == 101).astype(float) - (drafts[:, 5] == 101).astype(float))
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(np.int64)
    return drafts, labels


def prior_engine_data(tmp_path, champions_per_role=20):
    """Public win rates for every champion `random_drafts` can deal, spread from 35 % to 60 %."""
    champions = {}
    stats = []
    for role_index, role in enumerate(ROLES):
        base = (role_index + 1) * 100
        for offset in range(1, champions_per_role + 1):
            key = base + offset
            slug = f"c{key}"
            champions[slug] = key
            stats.append((slug, role, 35.0 + (offset % 6) * 5.0))
    return load_engine_data(write_seed_sql(tmp_path / "seed.sql", champions, stats))


def prior_world(prior, count, seed, champions_per_role=20):
    """Drafts whose outcome follows the champion prior's total feature exactly, nothing else."""
    rng = np.random.default_rng(seed)
    drafts = random_drafts(count, rng, champions_per_role=champions_per_role)
    logit = prior.features(drafts)[:, 5]
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(np.int64)
    return drafts, labels


def test_stage_3_recovers_a_planted_synergy_that_champion_win_rates_cannot_see(tmp_path):
    drafts, labels = synergy_world(8000, seed=1)
    train, validation = dataset(drafts[:6000], labels[:6000]), dataset(drafts[6000:], labels[6000:])
    engine = load_engine_data(write_seed_sql(tmp_path / "seed.sql", {"ahri": 103}, [("ahri", "mid", 50.0)]))

    stage_1 = LogisticDraftModel(1, 1.0, seed=0, prior=neutral_prior()).fit(train)
    stage_3 = LogisticDraftModel(3, 1.0, seed=0, prior=neutral_prior()).fit(train)
    references = References(engine).fit(train.drafts, train.labels)

    loss_1 = summary(validation.labels, stage_1.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_3 = summary(validation.labels, stage_3.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_rates = summary(validation.labels, references.predict(validation.drafts)[References.WIN_RATES])["log_loss"]

    assert loss_3 < loss_1 - 0.02
    assert loss_3 < loss_rates - 0.02


def test_logistic_model_scores_partial_drafts_and_exports_its_weights():
    drafts, labels = dominant_champion_world(3000, seed=2)
    model = LogisticDraftModel(2, 0.3, seed=0, prior=neutral_prior()).fit(dataset(drafts, labels))

    partial = hide_picks(drafts[:100], [7] * 100, np.random.default_rng(0))
    probabilities = model.predict(partial, np.array(["GOLD"] * 100))
    assert ((probabilities > 0) & (probabilities < 1)).all()

    weights = json.loads(json.dumps(model.weights()))
    assert weights["stage"] == 2
    # The champion-by-role columns from the encoder, plus the six named prior features.
    assert len(weights["features"]) == len(model.encoder.columns) + 6
    assert model.top_weights(1)[0]["key"] == ["champion", "top", 101]


def test_weights_export_names_the_six_prior_features():
    drafts, labels = dominant_champion_world(500, seed=7)
    model = LogisticDraftModel(1, 1.0, seed=0, prior=neutral_prior()).fit(dataset(drafts, labels))

    keys = [feature["key"] for feature in model.weights()["features"]]
    for role in ROLES:
        assert ["prior", role] in keys
    assert ["prior", "total"] in keys


def manual_predict(weights, draft, tier):
    """Recomputes a probability from an exported `weights()` dict alone: no scikit-learn, no
    `ChampionPrior`. `draft_terms` is the pure key-generation logic a non-Python consumer would
    reimplement too; the point of the test is that the *numbers* (feature weights and the
    per-champion prior log-odds) come entirely from the JSON.
    """
    feature_lookup = {tuple(feature["key"]): feature["weight"] for feature in weights["features"]}
    prior_lookup = {(row["champion"], row["role"]): row["log_odds"] for row in weights["prior_table"]}

    total = weights["intercept"]
    for key, sign in draft_terms(list(draft), tier, weights["stage"]):
        weight = feature_lookup.get(key)
        if weight is not None:
            total += sign * weight

    role_diffs = []
    for role_index, role in enumerate(ROLES):
        blue, red = int(draft[role_index]), int(draft[5 + role_index])
        blue_log_odds = prior_lookup.get((blue, role), 0.0) if blue else 0.0
        red_log_odds = prior_lookup.get((red, role), 0.0) if red else 0.0
        diff = blue_log_odds - red_log_odds
        role_diffs.append(diff)
        total += diff * feature_lookup[("prior", role)]
    total += sum(role_diffs) * feature_lookup[("prior", "total")]

    return 1 / (1 + math.exp(-total))


def test_weights_export_lets_you_recompute_predictions_by_lookups_alone(tmp_path):
    engine = prior_engine_data(tmp_path)
    prior = ChampionPrior(engine)
    drafts, labels = prior_world(prior, count=600, seed=40)
    model = LogisticDraftModel(2, 1.0, seed=0, prior=prior).fit(dataset(drafts, labels))
    weights = json.loads(json.dumps(model.weights()))

    sample = drafts[:5].copy()
    tiers = np.array(["GOLD"] * 5)
    partial = hide_picks(sample, [4, 0, 6, 2, 8], np.random.default_rng(0))

    expected = model.predict(partial, tiers)
    manual = np.array([manual_predict(weights, draft, tier) for draft, tier in zip(partial, tiers)])

    assert np.allclose(manual, expected, atol=1e-9)


def test_logistic_model_is_deterministic_for_a_seed():
    drafts, labels = dominant_champion_world(1500, seed=3)
    train = dataset(drafts, labels)

    first = LogisticDraftModel(1, 1.0, seed=5, prior=neutral_prior()).fit(train).predict(drafts[:50], train.tiers[:50])
    second = LogisticDraftModel(1, 1.0, seed=5, prior=neutral_prior()).fit(train).predict(drafts[:50], train.tiers[:50])

    assert np.array_equal(first, second)


def test_boosting_model_learns_a_dominant_champion():
    drafts, labels = dominant_champion_world(4000, seed=4)
    train, validation = dataset(drafts[:3000], labels[:3000]), dataset(drafts[3000:], labels[3000:])

    model = BoostingDraftModel(
        {"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}, seed=0, prior=neutral_prior()
    )
    probabilities = model.fit(train).predict(validation.drafts, validation.tiers)

    constant = summary(validation.labels, np.full(len(validation), validation.labels.mean()))
    assert summary(validation.labels, probabilities)["log_loss"] < constant["log_loss"] - 0.02


def test_boosting_prior_clearly_beats_no_prior_when_matches_follow_public_rates_only(tmp_path):
    """The boosting analogue of the logistic prior-ablation test: guards `BoostingDraftModel._matrix`
    against silently dropping `self.prior.features(drafts)` from its design matrix."""
    engine = prior_engine_data(tmp_path)
    prior = ChampionPrior(engine)
    drafts, labels = prior_world(prior, count=300, seed=21)
    train, validation = dataset(drafts[:150], labels[:150]), dataset(drafts[150:], labels[150:])
    params = {"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}

    with_prior = BoostingDraftModel(params, seed=0, prior=prior).fit(train)
    without_prior = BoostingDraftModel(params, seed=0, prior=neutral_prior()).fit(train)

    loss_with = summary(validation.labels, with_prior.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_without = summary(validation.labels, without_prior.predict(validation.drafts, validation.tiers))["log_loss"]

    assert loss_with < loss_without - 0.02


def test_select_model_keeps_the_lowest_validation_log_loss_and_reports_every_candidate():
    drafts, labels = synergy_world(5000, seed=5)
    train, validation = dataset(drafts[:4000], labels[:4000]), dataset(drafts[4000:], labels[4000:])
    candidates = [
        LogisticDraftModel(1, 1.0, seed=0, prior=neutral_prior()),
        LogisticDraftModel(3, 1.0, seed=0, prior=neutral_prior()),
    ]
    lines = []

    best, rows = select_model(train, validation, candidates, log=lines.append)

    assert best is candidates[1]
    assert [row["model"] for row in rows] == [candidate.name for candidate in candidates]
    assert rows[1]["log_loss"] == min(row["log_loss"] for row in rows)
    assert len(lines) == 2


def test_a_matchs_own_outcome_never_reaches_its_aggregate_features():
    """`BoostingDraftModel.fit` keeps its out-of-fold aggregates as `train_aggregates_`. Fits the real
    model twice on the same training set, the second time with one match's label flipped, and checks
    that match's own row is untouched (its own fold's table always excludes it) while a match from a
    different fold does move (that fold's table does include it), the way true out-of-fold tables should.
    """
    drafts, labels = dominant_champion_world(60, seed=6)
    seed = 0
    params = {"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}

    baseline = BoostingDraftModel(params, seed=seed, prior=neutral_prior()).fit(dataset(drafts, labels)).train_aggregates_

    # Only used to pick which rows to compare; the model computes the real fold assignment itself.
    folds = np.random.default_rng(seed).permutation(len(drafts)) % AGGREGATE_FOLDS
    flipped_row = 0
    other_rows = np.flatnonzero(folds != folds[flipped_row])

    flipped_labels = labels.copy()
    flipped_labels[flipped_row] = 1 - flipped_labels[flipped_row]
    after = BoostingDraftModel(params, seed=seed, prior=neutral_prior()).fit(dataset(drafts, flipped_labels)).train_aggregates_

    assert np.array_equal(after[flipped_row], baseline[flipped_row])
    assert any(not np.array_equal(after[row], baseline[row]) for row in other_rows[:5])


def test_the_candidate_list_covers_every_stage_and_the_boosting_grid():
    names = [model.name for model in candidate_models(seed=0, prior=neutral_prior())]

    assert len(names) == 43
    assert sum("palier 4" in name for name in names) == 8
    assert sum(name.startswith("gradient boosting") for name in names) == 3


def test_the_prior_clearly_beats_no_prior_when_matches_follow_public_rates_only(tmp_path):
    # Stage 0 isolates the comparison to the prior alone: "without it" leaves only the intercept.
    engine = prior_engine_data(tmp_path)
    prior = ChampionPrior(engine)
    drafts, labels = prior_world(prior, count=1000, seed=10)
    train, validation = dataset(drafts[:700], labels[:700]), dataset(drafts[700:], labels[700:])

    with_prior = LogisticDraftModel(0, 1.0, seed=0, prior=prior).fit(train)
    without_prior = LogisticDraftModel(0, 1.0, seed=0, prior=neutral_prior()).fit(train)

    loss_with = summary(validation.labels, with_prior.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_without = summary(validation.labels, without_prior.predict(validation.drafts, validation.tiers))["log_loss"]

    assert loss_with < loss_without - 0.02


def test_stage_0_beats_a_champion_only_model_trained_on_too_few_matches(tmp_path):
    engine = prior_engine_data(tmp_path)
    prior = ChampionPrior(engine)
    drafts, labels = prior_world(prior, count=300, seed=11)
    train, validation = dataset(drafts[:150], labels[:150]), dataset(drafts[150:], labels[150:])

    stage_0 = LogisticDraftModel(0, 1.0, seed=0, prior=prior).fit(train)
    champion_only = LogisticDraftModel(1, 1.0, seed=0, prior=neutral_prior()).fit(train)

    loss_0 = summary(validation.labels, stage_0.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_champion_only = summary(
        validation.labels, champion_only.predict(validation.drafts, validation.tiers)
    )["log_loss"]

    assert loss_0 < loss_champion_only - 0.02
