import json

import pytest

from collect_fixtures import make_match
from ml.collect.extract import InvalidMatch, extract_match, patch_key, patch_of

POSITIONS = ("top", "jungle", "mid", "adc", "support")


def test_extracts_the_draft_by_team_and_position():
    row = extract_match(make_match(match_id="EUW1_42", blue_win=False), seed_tier="GOLD")

    assert row["match_id"] == "EUW1_42"
    assert row["patch"] == "16.18"
    assert row["game_version"] == "16.18.712.1234"
    assert row["seed_tier"] == "GOLD"
    assert [row[f"blue_{position}"] for position in POSITIONS] == [266, 64, 103, 222, 412]
    assert [row[f"red_{position}"] for position in POSITIONS] == [24, 76, 238, 51, 117]
    assert row["blue_win"] == 0


def test_keeps_real_bans_and_drops_empty_ban_slots():
    row = extract_match(make_match(), seed_tier="GOLD")

    assert json.loads(row["blue_bans"]) == [157]
    assert json.loads(row["red_bans"]) == [350]


def test_rejects_a_queue_other_than_ranked_solo():
    with pytest.raises(InvalidMatch, match="ranked solo"):
        extract_match(make_match(queue_id=440), seed_tier="GOLD")


def test_rejects_a_remake():
    with pytest.raises(InvalidMatch, match="remake"):
        extract_match(make_match(remake=True), seed_tier="GOLD")


def test_rejects_a_participant_without_a_position():
    raw = make_match()
    raw["info"]["participants"][3]["teamPosition"] = ""

    with pytest.raises(InvalidMatch, match="missing position"):
        extract_match(raw, seed_tier="GOLD")


def test_rejects_a_position_played_twice_in_one_team():
    raw = make_match()
    raw["info"]["participants"][1]["teamPosition"] = "TOP"

    with pytest.raises(InvalidMatch, match="duplicated position"):
        extract_match(raw, seed_tier="GOLD")


def test_patch_of_keeps_major_and_minor():
    assert patch_of("16.18.712.1234") == "16.18"
    assert patch_of("16.3.1") == "16.3"

    with pytest.raises(ValueError):
        patch_of("not-a-version")


def test_patch_key_orders_patches_numerically_not_alphabetically():
    assert patch_key("16.9") < patch_key("16.10")
