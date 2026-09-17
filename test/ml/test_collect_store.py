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
