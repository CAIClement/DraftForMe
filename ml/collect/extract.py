"""Turns a raw Riot match into the compact row stored for training."""

from __future__ import annotations

import json
from typing import Any

RANKED_SOLO_QUEUE = 420
BLUE_TEAM = 100
RED_TEAM = 200
POSITION_ORDER = ("top", "jungle", "mid", "adc", "support")
RIOT_POSITIONS = {
    "TOP": "top",
    "JUNGLE": "jungle",
    "MIDDLE": "mid",
    "BOTTOM": "adc",
    "UTILITY": "support",
}


class InvalidMatch(ValueError):
    """The match must not enter the dataset. The message names the reason."""


def patch_of(game_version: str) -> str:
    """"16.18.712.1234" -> "16.18"."""
    parts = game_version.split(".")
    if len(parts) < 2 or not parts[0].isdigit() or not parts[1].isdigit():
        raise ValueError(f"unrecognised game version: {game_version!r}")
    return f"{int(parts[0])}.{int(parts[1])}"


def patch_key(patch: str) -> tuple[int, int]:
    """Numeric ordering key: "16.9" sorts before "16.10"."""
    major, minor = patch.split(".")
    return int(major), int(minor)


def extract_match(raw: dict[str, Any], seed_tier: str) -> dict[str, Any]:
    """Returns the row for the `matches` table, or raises InvalidMatch."""
    try:
        return _build_row(raw, seed_tier)
    except InvalidMatch:
        raise
    except (KeyError, TypeError, ValueError) as error:
        raise InvalidMatch(f"malformed payload: {error!r}") from error


def _build_row(raw: dict[str, Any], seed_tier: str) -> dict[str, Any]:
    info = raw.get("info") or {}

    if info.get("queueId") != RANKED_SOLO_QUEUE:
        raise InvalidMatch("not ranked solo/duo")
    if info.get("endOfGameResult", "GameComplete") != "GameComplete":
        raise InvalidMatch("game not completed")

    participants = info.get("participants") or []
    if any(participant.get("gameEndedInEarlySurrender") for participant in participants):
        raise InvalidMatch("remake")
    if len(participants) != 10:
        raise InvalidMatch("expected 10 participants")

    lineup: dict[int, dict[str, int]] = {BLUE_TEAM: {}, RED_TEAM: {}}
    for participant in participants:
        team_id = participant.get("teamId")
        if team_id not in lineup:
            raise InvalidMatch("unknown team")
        position = RIOT_POSITIONS.get(participant.get("teamPosition") or "")
        if position is None:
            raise InvalidMatch("missing position")
        if position in lineup[team_id]:
            raise InvalidMatch("duplicated position")
        lineup[team_id][position] = int(participant["championId"])

    if any(len(team) != len(POSITION_ORDER) for team in lineup.values()):
        raise InvalidMatch("incomplete team")

    teams = {team.get("teamId"): team for team in info.get("teams") or []}
    if set(teams) != {BLUE_TEAM, RED_TEAM}:
        raise InvalidMatch("expected two teams")
    if bool(teams[BLUE_TEAM].get("win")) == bool(teams[RED_TEAM].get("win")):
        raise InvalidMatch("no single winner")

    row: dict[str, Any] = {
        "match_id": raw["metadata"]["matchId"],
        "patch": patch_of(info["gameVersion"]),
        "game_version": info["gameVersion"],
        "game_creation": int(info["gameCreation"]),
        "game_duration": int(info["gameDuration"]),
        "seed_tier": seed_tier,
    }
    for side, team_id in (("blue", BLUE_TEAM), ("red", RED_TEAM)):
        for position in POSITION_ORDER:
            row[f"{side}_{position}"] = lineup[team_id][position]
        # Riot fills an unused ban slot with -1.
        bans = [int(ban["championId"]) for ban in teams[team_id].get("bans") or [] if int(ban["championId"]) > 0]
        row[f"{side}_bans"] = json.dumps(bans)
    row["blue_win"] = 1 if teams[BLUE_TEAM].get("win") else 0
    return row
