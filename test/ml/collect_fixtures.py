"""Test helpers for ml.collect: a Riot match builder and, later, a fake source."""

from __future__ import annotations

from typing import Any

PATCH = "16.18"
POSITIONS = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")


def make_match(
    match_id: str = "EUW1_1",
    game_version: str = "16.18.712.1234",
    queue_id: int = 420,
    blue_win: bool = True,
    remake: bool = False,
    blue_champions: tuple[int, ...] = (266, 64, 103, 222, 412),
    red_champions: tuple[int, ...] = (24, 76, 238, 51, 117),
) -> dict[str, Any]:
    """Builds a minimal Riot match-v5 response with only the fields the collector reads.

    Participants are ordered blue TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY, then red in the
    same order, so index 1 is blue JUNGLE and index 3 is blue BOTTOM.
    """
    participants = []
    for team_id, champions, win in ((100, blue_champions, blue_win), (200, red_champions, not blue_win)):
        for position, champion_id in zip(POSITIONS, champions):
            participants.append(
                {
                    "puuid": f"player-{team_id}-{position}",
                    "teamId": team_id,
                    "teamPosition": position,
                    "championId": champion_id,
                    "win": win,
                    "gameEndedInEarlySurrender": remake,
                }
            )

    return {
        "metadata": {"matchId": match_id, "participants": [p["puuid"] for p in participants]},
        "info": {
            "queueId": queue_id,
            "gameVersion": game_version,
            "gameCreation": 1_789_000_000_000,
            "gameDuration": 1800,
            "participants": participants,
            "teams": [
                {
                    "teamId": 100,
                    "win": blue_win,
                    "bans": [{"championId": 157, "pickTurn": 1}, {"championId": -1, "pickTurn": 3}],
                },
                {"teamId": 200, "win": not blue_win, "bans": [{"championId": 350, "pickTurn": 2}]},
            ],
        },
    }
