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


import copy

from ml.collect.riot_client import NotFoundError
from ml.collect.sampling import TIERS


class FakeSource:
    """Stands in for RiotClient. Only division "I", page 1 has players; every call is recorded."""

    def __init__(
        self,
        leagues: dict[str, list[dict[str, Any]]],
        player_matches: dict[str, list[str]],
        matches: dict[str, dict[str, Any]],
    ) -> None:
        self.leagues = leagues
        self.player_matches = player_matches
        self.matches = matches
        self.calls: list[tuple[str, ...]] = []

    def league_page(self, tier: str, division: str, page: int) -> list[dict[str, Any]]:
        self.calls.append(("league", tier, division, str(page)))
        if division != "I" or page != 1:
            return []
        return [dict(entry) for entry in self.leagues.get(tier, [])]

    def resolve_puuid(self, entry: dict[str, Any]) -> str:
        return str(entry["puuid"])

    def match_ids(self, puuid: str, count: int = 100) -> list[str]:
        self.calls.append(("ids", puuid))
        return list(self.player_matches.get(puuid, []))[:count]

    def match(self, match_id: str) -> dict[str, Any]:
        self.calls.append(("match", match_id))
        if match_id not in self.matches:
            raise NotFoundError(match_id)
        return copy.deepcopy(self.matches[match_id])

    def close(self) -> None:
        pass


def world(tiers: tuple[str, ...] | list[str] = TIERS, matches_per_player: int = 3) -> FakeSource:
    """One player per tier, each with `matches_per_player` current-patch matches named TIER_1, TIER_2, ..."""
    leagues: dict[str, list[dict[str, Any]]] = {}
    player_matches: dict[str, list[str]] = {}
    matches: dict[str, dict[str, Any]] = {}
    for tier in tiers:
        puuid = f"{tier.lower()}-1"
        leagues[tier] = [{"puuid": puuid, "summonerId": f"s-{puuid}"}]
        match_ids = [f"{tier}_{n}" for n in range(1, matches_per_player + 1)]
        player_matches[puuid] = match_ids
        for match_id in match_ids:
            matches[match_id] = make_match(match_id=match_id)
    return FakeSource(leagues, player_matches, matches)
