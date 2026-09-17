import sqlite3

import pytest
from collect_fixtures import make_match
from ml.collect.extract import extract_match
from ml.collect.store import Store


def test_players_are_added_once_and_known_by_puuid_and_summoner_id():
    store = Store(":memory:")

    assert store.add_player("puuid-1", "GOLD", "II", summoner_id="sum-1") is True
    assert store.add_player("puuid-1", "GOLD", "II", summoner_id="sum-1") is False
    assert store.known_player_keys() == {"puuid-1", "sum-1"}
    assert store.pending_players("GOLD") == ["puuid-1"]

    store.mark_player("puuid-1", "done")

    assert store.pending_players("GOLD") == []


def test_match_ids_are_deduplicated_across_players():
    store = Store(":memory:")

    assert store.add_match_ids(["M1", "M2"], seed_tier="GOLD", seed_puuid="a") == 2
    assert store.add_match_ids(["M2", "M3"], seed_tier="SILVER", seed_puuid="b") == 1

    first = store.next_pending_match("GOLD")
    assert (first["match_id"], first["seed_puuid"], first["position"]) == ("M1", "a", 0)
    assert store.match_status("M2") == "pending"


def test_saving_a_match_counts_it_and_keeps_the_raw_response():
    store = Store(":memory:")
    raw = make_match(match_id="M1")
    store.add_match_ids(["M1"], seed_tier="GOLD", seed_puuid="a")

    store.save_match(extract_match(raw, seed_tier="GOLD"), raw)

    assert store.matches_per_tier() == {"GOLD": 1}
    assert store.match_status("M1") == "done"
    assert store.load_raw("M1") == raw
    assert store.next_pending_match("GOLD") is None


def test_saving_the_same_match_twice_counts_it_once():
    store = Store(":memory:")
    raw = make_match(match_id="M1")
    store.add_match_ids(["M1"], seed_tier="GOLD", seed_puuid="a")
    row = extract_match(raw, seed_tier="GOLD")

    store.save_match(row, raw)
    store.save_match(row, raw)

    assert store.matches_per_tier() == {"GOLD": 1}


def test_patches_returns_the_distinct_saved_patches():
    store = Store(":memory:")
    raw_1 = make_match(match_id="M1", game_version="16.18.712.1234")
    raw_2 = make_match(match_id="M2", game_version="16.19.100.1")
    store.add_match_ids(["M1"], seed_tier="GOLD", seed_puuid="a")
    store.add_match_ids(["M2"], seed_tier="GOLD", seed_puuid="b")

    store.save_match(extract_match(raw_1, seed_tier="GOLD"), raw_1)
    store.save_match(extract_match(raw_2, seed_tier="GOLD"), raw_2)

    assert store.patches() == {"16.18", "16.19"}


def test_saving_a_row_with_a_missing_required_value_raises():
    store = Store(":memory:")
    raw = make_match(match_id="M1")
    store.add_match_ids(["M1"], seed_tier="GOLD", seed_puuid="a")
    row = extract_match(raw, seed_tier="GOLD")
    row["game_creation"] = None

    with pytest.raises(sqlite3.IntegrityError):
        store.save_match(row, raw)

    assert store.matches_per_tier() == {}
    assert store.match_status("M1") == "pending"


def test_skipping_older_matches_only_touches_that_players_later_positions():
    store = Store(":memory:")
    store.add_match_ids(["A0", "A1", "A2"], seed_tier="GOLD", seed_puuid="a")
    store.add_match_ids(["B0", "B1"], seed_tier="GOLD", seed_puuid="b")

    assert store.skip_older_matches("a", after_position=0) == 2

    assert store.match_status("A0") == "pending"
    assert store.match_status("A1") == "skipped_patch"
    assert store.match_status("A2") == "skipped_patch"
    assert store.match_status("B1") == "pending"


def test_league_cursor_advances_then_exhausts():
    store = Store(":memory:")

    assert store.cursor("GOLD", "II") == (1, False)
    store.advance_cursor("GOLD", "II", exhausted=False)
    assert store.cursor("GOLD", "II") == (2, False)
    store.advance_cursor("GOLD", "II", exhausted=True)
    assert store.cursor("GOLD", "II") == (2, True)


def test_state_survives_closing_and_reopening_the_database(tmp_path):
    path = tmp_path / "matches.sqlite"
    raw = make_match(match_id="M1")

    store = Store(path)
    store.add_player("a", "GOLD", "I")
    store.add_match_ids(["M1", "M2"], seed_tier="GOLD", seed_puuid="a")
    store.save_match(extract_match(raw, seed_tier="GOLD"), raw)
    store.close()

    reopened = Store(path)
    assert reopened.matches_per_tier() == {"GOLD": 1}
    assert reopened.next_pending_match("GOLD")["match_id"] == "M2"
    assert reopened.pending_players("GOLD") == ["a"]
    reopened.close()
