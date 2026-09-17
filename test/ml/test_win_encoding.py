import numpy as np
import pytest

import ml.collect.sampling
from ml.win.encoding import PICKS, TIER_GROUPS, DraftEncoder, hide_picks, swap_sides, with_masked_copies
from win_fixtures import random_drafts

DRAFT = np.array([[101, 201, 301, 401, 501, 102, 202, 302, 402, 502]])


def encoded(stage, drafts, tiers, min_pair_count=1):
    encoder = DraftEncoder(stage, min_pair_count=min_pair_count).fit(drafts, tiers)
    return encoder, encoder.transform(drafts, tiers).toarray()


def column(encoder, key):
    return encoder.columns[key]


def test_stage_0_produces_no_champion_columns_at_all():
    encoder, matrix = encoded(0, DRAFT, ["GOLD"])

    assert encoder.columns == {}
    assert matrix.shape == (1, 0)

    # Also true on a partially hidden draft, and for a draft with no champions the encoder ever saw.
    unseen = np.array([[199, 299, 399, 499, 599, 198, 298, 398, 498, 598]])
    assert encoder.transform(unseen, ["GOLD"]).shape == (1, 0)


def test_stage_1_signs_each_champion_by_side_and_role():
    encoder, matrix = encoded(1, DRAFT, ["GOLD"])

    assert len(encoder.columns) == 10
    assert matrix[0, column(encoder, ("champion", "top", 101))] == 1
    assert matrix[0, column(encoder, ("champion", "top", 102))] == -1
    assert matrix[0, column(encoder, ("champion", "support", 502))] == -1


def test_each_stage_adds_its_features_to_the_previous_ones():
    sizes = [len(encoded(stage, DRAFT, ["GOLD"])[0].columns) for stage in (0, 1, 2, 3, 4)]

    # No champion columns at stage 0, then 10 champions, then 5 lane pairs, then 2 synergies per
    # team, then 10 champion-by-elo features.
    assert sizes == [0, 10, 15, 19, 29]


def test_lane_and_synergy_features_carry_the_expected_signs():
    encoder, matrix = encoded(3, DRAFT, ["GOLD"])

    assert matrix[0, column(encoder, ("lane", "mid", 301, 302))] == 1
    assert matrix[0, column(encoder, ("synergy", "adc+support", 401, 501))] == 1
    assert matrix[0, column(encoder, ("synergy", "adc+support", 402, 502))] == -1


def test_swapping_the_teams_negates_every_feature():
    rng = np.random.default_rng(3)
    drafts = random_drafts(200, rng)
    tiers = np.array(["GOLD", "IRON", "MASTER", "EMERALD"] * 50)
    partial = hide_picks(drafts, rng.integers(1, PICKS, size=len(drafts)), rng)

    for candidate in (drafts, partial):
        encoder = DraftEncoder(4, min_pair_count=1).fit(candidate, tiers)
        original = encoder.transform(candidate, tiers).toarray()
        swapped = encoder.transform(swap_sides(candidate), tiers).toarray()
        assert np.array_equal(swapped, -original)


def test_a_hidden_pick_zeroes_its_champion_lane_and_synergy_features():
    encoder = DraftEncoder(3, min_pair_count=1).fit(DRAFT, ["GOLD"])
    draft = DRAFT.copy()
    draft[0, 3] = 0  # blue adc hidden

    matrix = encoder.transform(draft, ["GOLD"]).toarray()

    assert matrix[0, column(encoder, ("champion", "adc", 401))] == 0
    assert matrix[0, column(encoder, ("lane", "adc", 401, 402))] == 0
    assert matrix[0, column(encoder, ("synergy", "adc+support", 401, 501))] == 0
    assert matrix[0, column(encoder, ("synergy", "adc+support", 402, 502))] == -1


def test_rare_pairs_get_no_column_and_unknown_features_are_ignored():
    drafts = np.repeat(DRAFT, 4, axis=0)
    encoder = DraftEncoder(2).fit(drafts, ["GOLD"] * 4)

    assert not any(key[0] == "lane" for key in encoder.columns)

    unseen = np.array([[199, 299, 399, 499, 599, 198, 298, 398, 498, 598]])
    assert encoder.transform(unseen, ["GOLD"]).nnz == 0


def test_rejects_an_unknown_stage():
    with pytest.raises(ValueError):
        DraftEncoder(5)


def test_hide_picks_hides_exactly_the_requested_number():
    rng = np.random.default_rng(0)
    drafts = np.repeat(DRAFT, 9, axis=0)

    hidden = hide_picks(drafts, list(range(1, 10)), rng)

    assert [int((row == 0).sum()) for row in hidden] == list(range(1, 10))
    assert (drafts != 0).all()

    # A real draft always hides a suffix of B, R, R, B, B, R, R, B, B, R: hiding 5 picks is
    # always 2 blue and 3 red, and the split for every other total follows the same rule.
    blue_hidden = [int((row[:5] == 0).sum()) for row in hidden]
    red_hidden = [int((row[5:] == 0).sum()) for row in hidden]
    assert blue_hidden == [0, 1, 2, 2, 2, 3, 4, 4, 4]
    assert red_hidden == [total - blue for total, blue in zip(range(1, 10), blue_hidden)]


def test_rejects_a_tier_list_that_does_not_match_the_drafts():
    with pytest.raises(ValueError):
        DraftEncoder(1).fit(np.repeat(DRAFT, 2, axis=0), ["GOLD"])

    encoder = DraftEncoder(1).fit(DRAFT, ["GOLD"])
    with pytest.raises(ValueError):
        encoder.transform(np.repeat(DRAFT, 2, axis=0), ["GOLD"])


def test_every_collected_tier_has_a_group():
    assert set(TIER_GROUPS) == set(ml.collect.sampling.TIERS)


def test_column_order_does_not_depend_on_the_order_of_the_training_rows():
    rng = np.random.default_rng(5)
    drafts = random_drafts(30, rng)
    tiers = np.array((["GOLD", "IRON", "MASTER", "EMERALD"] * 8)[:30])
    permutation = rng.permutation(len(drafts))

    encoder = DraftEncoder(4, min_pair_count=1).fit(drafts, tiers)
    shuffled_encoder = DraftEncoder(4, min_pair_count=1).fit(drafts[permutation], tiers[permutation])

    assert encoder.columns == shuffled_encoder.columns


def test_masked_copies_keep_labels_tiers_and_origin_aligned():
    rng = np.random.default_rng(0)
    drafts = random_drafts(50, rng)
    labels = np.arange(50) % 2
    tiers = np.array(["GOLD"] * 25 + ["IRON"] * 25)

    all_drafts, all_labels, all_tiers, origin = with_masked_copies(drafts, labels, tiers, 2, rng)

    assert len(all_drafts) == 150
    assert np.array_equal(all_drafts[:50], drafts)
    assert np.array_equal(all_labels, labels[origin])
    assert np.array_equal(all_tiers, tiers[origin])
    hidden = (all_drafts[50:] == 0).sum(axis=1)
    assert hidden.min() >= 1 and hidden.max() <= 9
    kept = all_drafts[50:] != 0
    assert np.array_equal(all_drafts[50:][kept], drafts[origin[50:]][kept])
