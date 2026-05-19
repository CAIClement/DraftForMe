from ml.features import (
    build_candidate_features,
    filter_candidate_names,
    parse_float,
    player_lookup,
)


def test_parse_float_accepts_numbers_and_percent_strings():
    assert parse_float(51.2) == 51.2
    assert parse_float("51.2%") == 51.2
    assert parse_float(None, default=7.0) == 7.0


def test_player_lookup_normalizes_champion_names():
    pool = [{"champion": "Kai'Sa", "games": 24, "win_rate": 58.0}]
    lookup = player_lookup(pool)
    assert lookup["kai'sa"]["games"] == 24
    assert lookup["kai'sa"]["win_rate"] == 58.0


def test_filter_candidate_names_excludes_bans_and_picks():
    champions = [{"name": "Ahri"}, {"name": "Zed"}, {"name": "Lux"}]
    result = filter_candidate_names(champions, bans=["zed"], already_picked=["Lux"])
    assert result == ["Ahri"]


def test_build_candidate_features_marks_player_and_draft_context():
    champion = {
        "rank": 2,
        "name": "Ahri",
        "games_played": "714379",
        "win_rate": 50.11,
        "pick_rate": 9.59,
        "ban_rate": 3.21,
    }
    pool = [{"champion": "Ahri", "games": 32, "win_rate": 56.0}]
    row = build_candidate_features(
        champion=champion,
        role="mid",
        region="euw",
        tier="emerald_plus",
        player_pool=pool,
        enemy_picks=["Zed"],
        bans=["Yasuo"],
        already_picked=["Lux"],
        total_champions=55,
        priority=50,
    )

    assert row["champion"] == "Ahri"
    assert row["role_mid"] == 1
    assert row["candidate_rank"] == 2
    assert row["candidate_win_rate"] == 50.11
    assert row["player_has_champion"] == 1
    assert row["player_games"] == 32
    assert row["player_win_rate"] == 56.0
    assert row["enemy_pick_count"] == 1
    assert row["ban_count"] == 1
    assert row["already_picked_count"] == 1
    assert row["is_banned"] == 0
    assert row["is_already_picked"] == 0
