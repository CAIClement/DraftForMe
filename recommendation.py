"""
Moteur de recommandation de champions pour DraftForMe.

3 axes :
  1. Meta : basé sur le RANG dans la tier list op.gg (rang 1 = meilleur)
  2. Pool joueur : champions avec 10+ games (en dessous = pas significatif)
  3. Counter : matchups contre les picks ennemis

priority (0-100) : 0 = full pool, 50 = mix, 100 = full meta
"""

from __future__ import annotations

MIN_GAMES_FOR_POOL = 10  # Seuil : 10+ games pour etre considere comme un pick du joueur


def _safe_float(v, default=0.0) -> float:
    if v is None:
        return default
    if isinstance(v, (int, float)):
        return float(v)
    try:
        return float(str(v).replace("%", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Scores individuels
# ---------------------------------------------------------------------------

def meta_score(champion_stats: dict, total_champions: int) -> float:
    """Score meta (0-100) base sur le rang dans la tier list.
    Rang 1 = 100, dernier rang = ~10.
    """
    rank = champion_stats.get("rank", 50)
    if not isinstance(rank, (int, float)):
        rank = 50
    total = max(total_champions, 1)
    # Rang 1 -> 100, dernier -> 10
    score = 100 - (rank - 1) / total * 90
    return max(0, min(100, score))


def player_score(champion_name: str, player_pool: list[dict]) -> float:
    """Score joueur (0-100).
    Seuls les champions avec MIN_GAMES_FOR_POOL+ games comptent.
    """
    for p in player_pool:
        if p.get("champion", "").lower() == champion_name.lower():
            games = _safe_float(p.get("games"), 0)
            if games < MIN_GAMES_FOR_POOL:
                return 5  # Pas assez de games -> pas significatif

            wr = _safe_float(p.get("win_rate"), 50)
            wr_bonus = (wr - 50) * 2  # -100..+100
            games_bonus = min(games * 0.6, 35)  # 0..35
            return max(0, min(100, 35 + wr_bonus + games_bonus))

    # Champion pas dans le pool du tout
    return 5


def counter_score(
    champion_name: str,
    enemy_picks: list[str],
    matchup_data: dict[str, dict],
) -> float:
    """Score de counterpick (0-100)."""
    if not enemy_picks:
        return 50

    scores = []
    champ_matchups = matchup_data.get(champion_name, {}).get("all_matchups", [])
    matchup_lookup = {m["enemy"].lower(): m for m in champ_matchups if m.get("enemy")}

    for enemy in enemy_picks:
        m = matchup_lookup.get(enemy.lower())
        if m and m.get("win_rate") is not None:
            wr = _safe_float(m["win_rate"], 50)
            scores.append((wr - 50) * 4)
        else:
            scores.append(0)

    avg = sum(scores) / len(scores) if scores else 0
    return max(0, min(100, 50 + avg))


# ---------------------------------------------------------------------------
# Poids selon priority
# ---------------------------------------------------------------------------

def _compute_weights(priority: int, has_enemy: bool, has_pool: bool) -> tuple[float, float, float]:
    p = max(0, min(100, priority)) / 100.0
    base_meta = 0.05 + p * 0.90
    base_player = 0.95 - p * 0.90

    if not has_pool:
        base_meta = 0.95
        base_player = 0.05

    if has_enemy:
        counter_share = 0.40
        w_meta = base_meta * (1 - counter_share)
        w_player = base_player * (1 - counter_share)
        w_counter = counter_share
    else:
        w_meta = base_meta
        w_player = base_player
        w_counter = 0.0

    total = w_meta + w_player + w_counter
    return (w_meta / total, w_player / total, w_counter / total)


# ---------------------------------------------------------------------------
# Score composite + recommandations
# ---------------------------------------------------------------------------

def compute_champion_score(
    champion_stats: dict,
    champion_name: str,
    player_pool: list[dict],
    enemy_picks: list[str],
    matchup_data: dict[str, dict],
    priority: int = 50,
    total_champions: int = 55,
) -> dict:
    ms = meta_score(champion_stats, total_champions)
    ps = player_score(champion_name, player_pool)
    cs = counter_score(champion_name, enemy_picks, matchup_data)

    has_enemy = len(enemy_picks) > 0
    # has_pool = le joueur a au moins 1 champion avec 10+ games
    has_pool = any(
        _safe_float(p.get("games"), 0) >= MIN_GAMES_FOR_POOL
        for p in player_pool
    )
    w_meta, w_player, w_counter = _compute_weights(priority, has_enemy, has_pool)

    total = w_meta * ms + w_player * ps + w_counter * cs

    # Flags utiles pour le frontend
    is_in_pool = False
    player_games = 0
    for p in player_pool:
        if p.get("champion", "").lower() == champion_name.lower():
            player_games = _safe_float(p.get("games"), 0)
            is_in_pool = player_games >= MIN_GAMES_FOR_POOL
            break

    return {
        "champion": champion_name,
        "total_score": round(total, 1),
        "meta_score": round(ms, 1),
        "player_score": round(ps, 1),
        "counter_score": round(cs, 1),
        "is_in_pool": is_in_pool,
        "player_games": int(player_games),
        "weights": {
            "meta": round(w_meta, 3),
            "player": round(w_player, 3),
            "counter": round(w_counter, 3),
        },
    }


def recommend_champions(
    all_champion_stats: list[dict],
    player_pool: list[dict],
    enemy_picks: list[str] | None = None,
    matchup_data: dict[str, dict] | None = None,
    role: str = "all",
    banned_champions: list[str] | None = None,
    already_picked: list[str] | None = None,
    priority: int = 50,
    top_n: int = 10,
) -> list[dict]:
    enemy_picks = enemy_picks or []
    matchup_data = matchup_data or {}
    banned = set(c.lower() for c in (banned_champions or []))
    picked = set(c.lower() for c in (already_picked or []))
    total_champions = len(all_champion_stats)

    scored = []
    for champ_stat in all_champion_stats:
        name = champ_stat.get("name", "")
        if not name or name.lower() in banned or name.lower() in picked:
            continue

        result = compute_champion_score(
            champ_stat, name, player_pool, enemy_picks, matchup_data,
            priority, total_champions,
        )
        result["stats"] = {
            "win_rate": _safe_float(champ_stat.get("win_rate")),
            "pick_rate": _safe_float(champ_stat.get("pick_rate")),
            "ban_rate": _safe_float(champ_stat.get("ban_rate")),
            "kda": champ_stat.get("kda"),
            "games_played": champ_stat.get("games_played"),
            "cs": champ_stat.get("cs"),
            "gold": champ_stat.get("gold"),
            "counters": champ_stat.get("counters", []),
            "rank": champ_stat.get("rank"),
        }
        scored.append(result)

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored[:top_n]
