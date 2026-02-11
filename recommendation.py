"""
Moteur de recommandation de champions pour DraftForMe.
Combine 3 axes :
  1. Meta (win rate, pick rate, ban rate depuis op.gg)
  2. Champion pool du joueur (ses meilleurs champions)
  3. Counterpicks (matchups contre les picks ennemis)

Le paramètre `priority` (0-100) contrôle la balance :
  0   = 100% pool du joueur
  50  = équilibré
  100 = 100% meta
"""

from __future__ import annotations


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

def meta_score(champion_stats: dict) -> float:
    """Score méta (0-100) basé sur win rate, pick rate, ban rate."""
    wr = _safe_float(champion_stats.get("win_rate"), 50)
    pr = _safe_float(champion_stats.get("pick_rate"), 5)
    br = _safe_float(champion_stats.get("ban_rate"), 0)

    wr_score = (wr - 50) * 15
    pr_score = min(pr * 1.5, 25)
    br_score = min(br * 0.8, 20)

    return max(0, min(100, 50 + wr_score + pr_score + br_score))


def player_score(champion_name: str, player_pool: list[dict]) -> float:
    """Score joueur (0-100)."""
    for p in player_pool:
        if p.get("champion", "").lower() == champion_name.lower():
            wr = _safe_float(p.get("win_rate"), 50)
            games = _safe_float(p.get("games"), 0)

            wr_bonus = (wr - 50) * 2
            games_bonus = min(games * 0.8, 40)
            return max(0, min(100, 30 + wr_bonus + games_bonus))

    # Champion pas dans le pool
    return 10


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
# Calcul des poids selon le slider priority
# ---------------------------------------------------------------------------

def _compute_weights(priority: int, has_enemy: bool, has_pool: bool) -> tuple[float, float, float]:
    """
    Calcule (w_meta, w_player, w_counter) selon :
      - priority : 0 = full pool, 50 = équilibré, 100 = full meta
      - has_enemy : si l'ennemi a pick (active le counter)
      - has_pool : si le joueur a un pool défini
    """
    # priority 0-100 -> ratio meta vs player
    # 0   -> meta=0.05, player=0.95
    # 50  -> meta=0.50, player=0.50
    # 100 -> meta=0.95, player=0.05
    p = max(0, min(100, priority)) / 100.0
    base_meta = 0.05 + p * 0.90       # 0.05 .. 0.95
    base_player = 0.95 - p * 0.90     # 0.95 .. 0.05

    if not has_pool:
        # Pas de pool -> tout sur meta
        base_meta = 0.95
        base_player = 0.05

    if has_enemy:
        # Réserver une part pour le counter (40%)
        counter_share = 0.40
        w_meta = base_meta * (1 - counter_share)
        w_player = base_player * (1 - counter_share)
        w_counter = counter_share
    else:
        w_meta = base_meta
        w_player = base_player
        w_counter = 0.0

    # Normaliser
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
) -> dict:
    """Calcule le score composite pour un champion."""
    ms = meta_score(champion_stats)
    ps = player_score(champion_name, player_pool)
    cs = counter_score(champion_name, enemy_picks, matchup_data)

    has_enemy = len(enemy_picks) > 0
    has_pool = len(player_pool) > 0
    w_meta, w_player, w_counter = _compute_weights(priority, has_enemy, has_pool)

    total = w_meta * ms + w_player * ps + w_counter * cs

    return {
        "champion": champion_name,
        "total_score": round(total, 1),
        "meta_score": round(ms, 1),
        "player_score": round(ps, 1),
        "counter_score": round(cs, 1),
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
    """
    Génère les top-N recommandations de champions.

    priority: 0 = favoriser le pool du joueur, 100 = favoriser la meta
    """
    enemy_picks = enemy_picks or []
    matchup_data = matchup_data or {}
    banned = set(c.lower() for c in (banned_champions or []))
    picked = set(c.lower() for c in (already_picked or []))

    scored = []
    for champ_stat in all_champion_stats:
        name = champ_stat.get("name", "")
        if not name:
            continue
        if name.lower() in banned or name.lower() in picked:
            continue

        result = compute_champion_score(
            champ_stat, name, player_pool, enemy_picks, matchup_data, priority
        )
        result["stats"] = {
            "win_rate": _safe_float(champ_stat.get("win_rate")),
            "pick_rate": _safe_float(champ_stat.get("pick_rate")),
            "ban_rate": _safe_float(champ_stat.get("ban_rate")),
            "kda": champ_stat.get("kda"),
            "games_played": champ_stat.get("games_played"),
            "cs": champ_stat.get("cs"),
            "gold": champ_stat.get("gold"),
        }
        scored.append(result)

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored[:top_n]
