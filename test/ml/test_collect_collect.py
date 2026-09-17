import random

from collect_fixtures import PATCH, make_match, world
from ml.collect.collect import collect
from ml.collect.sampling import TIERS
from ml.collect.store import Store


def run(source, store, target=20):
    return collect(source, store, target=target, patch=PATCH, rng=random.Random(1), log=lambda message: None)


def test_fills_every_tier_quota():
    summary = run(world(), Store(":memory:"))

    assert summary.collected == {tier: 2 for tier in TIERS}
    assert summary.short_tiers() == []
    assert summary.exhausted == []


def test_an_older_patch_ends_collection_for_that_player():
    source = world()
    source.matches["GOLD_2"] = make_match(match_id="GOLD_2", game_version="16.17.500.1")
    source.matches["GOLD_3"] = make_match(match_id="GOLD_3", game_version="16.17.400.1")
    store = Store(":memory:")

    summary = run(source, store)

    assert summary.collected["GOLD"] == 1
    assert ("match", "GOLD_3") not in source.calls
    assert store.match_status("GOLD_2") == "skipped_patch"
    assert store.match_status("GOLD_3") == "skipped_patch"
    assert "GOLD" in summary.short_tiers()
    assert "GOLD" in summary.exhausted


def test_a_remake_is_skipped_and_not_counted():
    source = world()
    source.matches["IRON_1"] = make_match(match_id="IRON_1", remake=True)
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("IRON_1") == "skipped_invalid"
    assert summary.collected["IRON"] == 2


def test_a_missing_match_is_recorded_and_collection_continues():
    source = world()
    del source.matches["SILVER_1"]
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("SILVER_1") == "not_found"
    assert summary.collected["SILVER"] == 2


def test_a_tier_without_players_does_not_stop_the_others():
    source = world(tiers=[tier for tier in TIERS if tier != "CHALLENGER"])

    summary = run(source, Store(":memory:"))

    assert "CHALLENGER" not in summary.collected
    assert summary.exhausted == ["CHALLENGER"]
    assert all(summary.collected[tier] == 2 for tier in TIERS if tier != "CHALLENGER")


def test_a_second_run_resumes_without_downloading_again(tmp_path):
    path = tmp_path / "matches.sqlite"
    first = Store(path)
    run(world(), first)
    first.close()

    source = world()
    second = Store(path)
    summary = run(source, second)
    second.close()

    assert source.calls == []
    assert summary.collected == {tier: 2 for tier in TIERS}
