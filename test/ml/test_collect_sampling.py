import random

import pytest

from ml.collect.sampling import APEX_TIERS, BATCH_SIZE, DIVISIONS, TIERS, divisions_for, draw_batch, tier_quotas


def test_thirty_thousand_matches_split_evenly_across_ten_tiers():
    quotas = tier_quotas(30000)

    assert list(quotas) == list(TIERS)
    assert set(quotas.values()) == {3000}


def test_a_remainder_goes_to_the_lowest_tiers_first():
    quotas = tier_quotas(25)

    assert [quotas[tier] for tier in TIERS] == [3, 3, 3, 3, 3, 2, 2, 2, 2, 2]
    assert sum(quotas.values()) == 25


def test_a_target_smaller_than_the_tier_count_is_refused():
    with pytest.raises(ValueError):
        tier_quotas(9)


def test_apex_tiers_have_one_listing_and_the_others_four_divisions():
    assert APEX_TIERS == {"MASTER", "GRANDMASTER", "CHALLENGER"}
    assert divisions_for("CHALLENGER") == ("I",)
    assert divisions_for("GOLD") == DIVISIONS


def test_draw_batch_skips_known_players_and_caps_the_size():
    candidates = [f"p{n}" for n in range(120)]

    batch = draw_batch(candidates, known={"p0", "p1"}, rng=random.Random(7))

    assert len(batch) == BATCH_SIZE
    assert len(set(batch)) == BATCH_SIZE
    assert not {"p0", "p1"} & set(batch)


def test_draw_batch_is_reproducible_whatever_the_candidate_order():
    candidates = [f"p{n}" for n in range(120)]

    first = draw_batch(candidates, known=set(), rng=random.Random(7))
    second = draw_batch(list(reversed(candidates)), known=set(), rng=random.Random(7))

    assert first == second
