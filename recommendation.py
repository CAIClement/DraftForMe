"""
Moteur de recommandation de champions pour DraftForMe.
Combine 3 axes :
  1. Meta (win rate, pick rate, ban rate depuis op.gg)
  2. Champion pool du joueur (ses meilleurs champions)
  3. Counterpicks (matchups contre les picks ennemis)
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
    """Score méta (0-100) basé sur win rate, pick rate, ban rate.
    champion_stats : un élément de la liste renvoyée par fetch_champion_stats()
    """
    wr = _safe_float(champion_stats.get("win_rate"), 50)
    pr = _safe_float(champion_stats.get("pick_rate"), 5)
    br = _safe_float(champion_stats.get("ban_rate"), 0)

    # Win rate : 50% = neutre, chaque point au-dessus vaut beaucoup
    wr_score = (wr - 50) * 15  # -75..+75 pour 45-55%

    # Pick rate : un champion populaire est fiable
    pr_score = min(pr * 1.5, 25)  # 0..25

    # Ban rate : indicateur de force perçue
    br_score = min(br * 0.8, 20)  # 0..20

    return max(0, min(100, 50 + wr_score + pr_score + br_score))


def player_score(champion_name: str, player_pool: list[dict]) -> float:
    """Score joueur (0-100).
    player_pool : liste de dicts avec {champion, win_rate, games, ...}
    """
    for p in player_pool:
        if p.get("champion", "").lower() == champion_name.lower():
            wr = _safe_float(p.get("win_rate"), 50)
            games = _safe_float(p.get("games"), 0)

            wr_bonus = (wr - 50) * 2  # -100..+100
            games_bonus = min(games * 0.8, 40)  # 0..40
            return max(0, min(100, 30 + wr_bonus + games_bonus))

    # Champion pas dans le pool : score bas mais pas éliminatoire
    return 15


def counter_score(
    champion_name: str,
    enemy_picks: list[str],
    matchup_data: dict[str, dict],
) -> float:
    """Score de counterpick (0-100).
    matchup_data : {champion_name: {"all_matchups": [{"enemy": ..., "win_rate": ...}]}}
    """
    if not enemy_picks:
        return 50  # neutre

    scores = []
    champ_matchups = matchup_data.get(champion_name, {}).get("all_matchups", [])
    matchup_lookup = {m["enemy"].lower(): m for m in champ_matchups if m.get("enemy")}

    for enemy in enemy_picks:
        m = matchup_lookup.get(enemy.lower())
        if m and m.get("win_rate") is not None:
            wr = _safe_float(m["win_rate"], 50)
            scores.append((wr - 50) * 4)  # chaque point de WR = 4 points de score
        else:
            scores.append(0)

    avg = sum(scores) / len(scores) if scores else 0
    return max(0, min(100, 50 + avg))


# ---------------------------------------------------------------------------
# Score composite + recommandations
# ---------------------------------------------------------------------------

def compute_champion_score(
    champion_stats: dict,
    champion_name: str,
    player_pool: list[dict],
    enemy_picks: list[str],
    matchup_data: dict[str, dict],
    picking_first: bool = True,
) -> dict:
    """Calcule le score composite pour un champion."""
    ms = meta_score(champion_stats)
    ps = player_score(champion_name, player_pool)
    cs = counter_score(champion_name, enemy_picks, matchup_data)

    if picking_first or not enemy_picks:
        # Pas de counter info : on pondère meta + joueur
        w_meta, w_player, w_counter = 0.45, 0.55, 0.0
    else:
        w_meta, w_player, w_counter = 0.20, 0.35, 0.45

    total = w_meta * ms + w_player * ps + w_counter * cs

    return {
        "champion": champion_name,
        "total_score": round(total, 1),
        "meta_score": round(ms, 1),
        "player_score": round(ps, 1),
        "counter_score": round(cs, 1),
        "weights": {"meta": w_meta, "player": w_player, "counter": w_counter},
    }


def recommend_champions(
    all_champion_stats: list[dict],
    player_pool: list[dict],
    enemy_picks: list[str] | None = None,
    matchup_data: dict[str, dict] | None = None,
    role: str = "all",
    banned_champions: list[str] | None = None,
    already_picked: list[str] | None = None,
    top_n: int = 10,
) -> list[dict]:
    """
    Génère les top-N recommandations de champions.

    Paramètres :
        all_champion_stats : liste complète des stats (fetch_champion_stats)
        player_pool : champions du joueur [{champion, win_rate, games, ...}]
        enemy_picks : picks de l'ennemi (peut être vide)
        matchup_data : données de matchups par champion
        role : rôle du joueur (filtre les stats si != 'all')
        banned_champions : champions bannis
        already_picked : champions déjà sélectionnés (exclure)
        top_n : nombre de recommandations
    """
    enemy_picks = enemy_picks or []
    matchup_data = matchup_data or {}
    banned = set(c.lower() for c in (banned_champions or []))
    picked = set(c.lower() for c in (already_picked or []))
    picking_first = len(enemy_picks) == 0

    scored = []
    for champ_stat in all_champion_stats:
        name = champ_stat.get("name", "")
        if not name:
            continue
        if name.lower() in banned or name.lower() in picked:
            continue

        result = compute_champion_score(
            champ_stat, name, player_pool, enemy_picks, matchup_data, picking_first
        )
        # Ajouter les stats brutes pour les graphiques
        result["stats"] = {
            "win_rate": _safe_float(champ_stat.get("win_rate")),
            "pick_rate": _safe_float(champ_stat.get("pick_rate")),
            "ban_rate": _safe_float(champ_stat.get("ban_rate")),
            "kda": champ_stat.get("kda"),
            "games_played": champ_stat.get("games_played"),
        }
        scored.append(result)

    scored.sort(key=lambda x: x["total_score"], reverse=True)
    return scored[:top_n]
