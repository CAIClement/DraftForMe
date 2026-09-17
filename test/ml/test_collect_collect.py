import random

import pytest
from collect_fixtures import PATCH, make_match, world
from ml.collect.collect import PatchMismatchError, collect
from ml.collect.riot_client import RiotServerError
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


def test_refuses_to_resume_a_database_filled_on_another_patch():
    store = Store(":memory:")
    run(world(), store)

    other_source = world()
    with pytest.raises(PatchMismatchError):
        collect(other_source, store, target=20, patch="16.19", rng=random.Random(1), log=lambda message: None)

    assert other_source.calls == []


def test_a_server_error_while_listing_stops_the_run_and_keeps_the_player_pending():
    source = world()

    def failing_match_ids(puuid, count=100):
        raise RiotServerError("outage")

    source.match_ids = failing_match_ids
    store = Store(":memory:")

    with pytest.raises(RiotServerError):
        run(source, store)

    assert store.pending_players("IRON") == ["iron-1"]


def test_ignores_league_entries_without_any_identifier():
    source = world()
    source.leagues["IRON"].append({"leaguePoints": 3})
    store = Store(":memory:")

    summary = run(source, store)

    assert summary.collected["IRON"] == 2


def test_a_match_whose_payload_id_does_not_match_the_requested_id_is_skipped_and_downloaded_once():
    source = world()
    # The payload's own metadata.matchId disagrees with the id it was requested under.
    source.matches["GOLD_2"] = make_match(match_id="GOLD_2_WRONG")
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("GOLD_2") == "skipped_invalid"
    assert summary.collected["GOLD"] == 2
    assert summary.short_tiers() == []
    assert source.calls.count(("match", "GOLD_2")) == 1


def test_a_null_game_version_is_skipped_invalid():
    source = world()
    source.matches["GOLD_2"] = make_match(match_id="GOLD_2", game_version=None)
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("GOLD_2") == "skipped_invalid"
    assert summary.collected["GOLD"] == 2
    assert summary.short_tiers() == []


def test_a_match_marked_failed_by_a_previous_run_is_retried_and_saved_on_the_next_run(tmp_path):
    path = tmp_path / "matches.sqlite"

    flaky = world(matches_per_player=2)
    original_match = flaky.match

    def flaky_match(match_id):
        if match_id == "GOLD_1":
            raise RiotServerError("outage")
        return original_match(match_id)

    flaky.match = flaky_match

    store = Store(path)
    run(flaky, store)

    assert store.matches_per_tier()["GOLD"] == 1
    assert store.match_status("GOLD_1") == "failed"
    store.close()

    healthy = world(matches_per_player=2)
    store = Store(path)
    summary = run(healthy, store)

    assert store.match_status("GOLD_1") == "done"
    assert summary.collected == {tier: 2 for tier in TIERS}
    assert ("match", "GOLD_1") in healthy.calls
    assert ("match", "GOLD_2") not in healthy.calls
    store.close()
