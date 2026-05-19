from pathlib import Path

from ml.build_dataset import build_rows_for_context, discover_player_pools


def test_build_rows_for_context_adds_expert_scores():
    stats = [
        {"rank": 1, "name": "Ahri", "win_rate": 51.0, "pick_rate": 7.0, "ban_rate": 2.0, "games_played": "1000"},
        {"rank": 2, "name": "Zed", "win_rate": 49.0, "pick_rate": 6.0, "ban_rate": 20.0, "games_played": "900"},
    ]
    pool = [{"champion": "Ahri", "games": 20, "win_rate": 55.0}]

    rows = build_rows_for_context(
        stats=stats,
        player_pool=pool,
        role="mid",
        region="euw",
        tier="emerald_plus",
        enemy_picks=["Zed"],
        bans=["Zed"],
        priority=50,
    )

    assert len(rows) == 1
    assert rows[0]["champion"] == "Ahri"
    assert "target_total_score" in rows[0]
    assert "expert_meta_score" in rows[0]
    assert rows[0]["target_total_score"] > 0


def test_discover_player_pools_reads_most_played(tmp_path: Path):
    path = tmp_path / "player_euw_demo.json"
    path.write_text(
        '{"most_played":[{"champion":"Kled","games":53,"win_rate":51.0}]}',
        encoding="utf-8",
    )

    pools = discover_player_pools(tmp_path)

    assert pools == [[], [{"champion": "Kled", "games": 53, "win_rate": 51.0}]]
