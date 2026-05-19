from ml.predict import rank_candidates


class FakeModel:
    def predict(self, frame):
        return [100 - rank for rank in frame["candidate_rank"]]


def test_rank_candidates_filters_bans_and_orders_scores():
    stats = [
        {"rank": 1, "name": "Ahri", "win_rate": 51.0, "pick_rate": 7.0, "ban_rate": 2.0, "games_played": "1000"},
        {"rank": 2, "name": "Zed", "win_rate": 49.0, "pick_rate": 6.0, "ban_rate": 20.0, "games_played": "900"},
        {"rank": 3, "name": "Lux", "win_rate": 50.0, "pick_rate": 5.0, "ban_rate": 4.0, "games_played": "800"},
    ]

    result = rank_candidates(
        model=FakeModel(),
        feature_columns=["candidate_rank"],
        stats=stats,
        role="mid",
        region="euw",
        tier="emerald_plus",
        player_pool=[],
        enemy_picks=[],
        bans=["Ahri"],
        priority=50,
        top_n=2,
    )

    assert [item["champion"] for item in result] == ["Zed", "Lux"]
    assert result[0]["score"] > result[1]["score"]
