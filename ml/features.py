from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROLES = ("top", "jungle", "mid", "adc", "support")


def normalize_name(value: str) -> str:
    return value.strip().lower()


def parse_float(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, (int, float)):
        return float(value)
    try:
        return float(str(value).replace("%", "").replace(",", "").strip())
    except (TypeError, ValueError):
        return default


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def player_lookup(player_pool: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    return {
        normalize_name(entry.get("champion", "")): entry
        for entry in player_pool
        if entry.get("champion")
    }


def filter_candidate_names(
    champions: list[dict[str, Any]],
    bans: list[str] | None = None,
    already_picked: list[str] | None = None,
) -> list[str]:
    banned = {normalize_name(name) for name in (bans or [])}
    picked = {normalize_name(name) for name in (already_picked or [])}
    names: list[str] = []

    for champion in champions:
        name = champion.get("name", "")
        normalized = normalize_name(name)
        if name and normalized not in banned and normalized not in picked:
            names.append(name)

    return names


def one_hot_role(role: str) -> dict[str, int]:
    normalized = role.strip().lower()
    return {f"role_{item}": int(normalized == item) for item in ROLES}


def build_candidate_features(
    champion: dict[str, Any],
    role: str,
    region: str,
    tier: str,
    player_pool: list[dict[str, Any]],
    enemy_picks: list[str],
    bans: list[str],
    already_picked: list[str],
    total_champions: int,
    priority: int,
) -> dict[str, Any]:
    name = champion.get("name", "")
    normalized_name = normalize_name(name)
    pool = player_lookup(player_pool)
    player_entry = pool.get(normalized_name, {})
    banned = {normalize_name(item) for item in bans}
    picked = {normalize_name(item) for item in already_picked}
    player_games = parse_float(player_entry.get("games"), 0.0)
    player_win_rate = parse_float(player_entry.get("win_rate"), 50.0)

    row: dict[str, Any] = {
        "champion": name,
        "role": role,
        "region": region,
        "tier": tier,
        "priority": int(priority),
        "total_champions": int(total_champions),
        "candidate_rank": int(parse_float(champion.get("rank"), total_champions)),
        "candidate_win_rate": parse_float(champion.get("win_rate"), 50.0),
        "candidate_pick_rate": parse_float(champion.get("pick_rate"), 0.0),
        "candidate_ban_rate": parse_float(champion.get("ban_rate"), 0.0),
        "candidate_games_played": parse_float(champion.get("games_played"), 0.0),
        "player_has_champion": int(normalized_name in pool),
        "player_games": player_games,
        "player_win_rate": player_win_rate,
        "player_missing_pool": int(len(player_pool) == 0),
        "enemy_pick_count": len(enemy_picks),
        "ban_count": len(bans),
        "already_picked_count": len(already_picked),
        "is_banned": int(normalized_name in banned),
        "is_already_picked": int(normalized_name in picked),
    }
    row.update(one_hot_role(role))
    return row


FEATURE_COLUMNS = [
    "priority",
    "total_champions",
    "candidate_rank",
    "candidate_win_rate",
    "candidate_pick_rate",
    "candidate_ban_rate",
    "candidate_games_played",
    "player_has_champion",
    "player_games",
    "player_win_rate",
    "player_missing_pool",
    "enemy_pick_count",
    "ban_count",
    "already_picked_count",
    "is_banned",
    "is_already_picked",
    "role_top",
    "role_jungle",
    "role_mid",
    "role_adc",
    "role_support",
]
