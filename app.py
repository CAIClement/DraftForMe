"""
DraftForMe - Serveur Flask.
Lance l'interface de draft et expose les API pour le scraping + recommandations.
"""

import json
import os
import threading
from pathlib import Path

from flask import Flask, jsonify, render_template, request
from flask_cors import CORS

from opgg_scraper import (
    close_driver,
    fetch_champion_matchups,
    fetch_champion_stats,
    fetch_ddragon_champions,
    fetch_player_profile,
)
from recommendation import recommend_champions

app = Flask(__name__)
CORS(app)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

# Cache en mémoire
_cache = {
    "champion_stats": [],
    "ddragon": {},
    "player_pool": [],
    "matchup_data": {},
}
_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Pages
# ---------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API : Data Dragon
# ---------------------------------------------------------------------------

@app.route("/api/ddragon")
def api_ddragon():
    """Liste des champions avec icônes (depuis Riot Data Dragon)."""
    data = fetch_ddragon_champions()
    return jsonify(data)


# ---------------------------------------------------------------------------
# API : Stats champions
# ---------------------------------------------------------------------------

@app.route("/api/champion-stats")
def api_champion_stats():
    """Stats des champions (win rate, pick rate, etc.) depuis op.gg."""
    region = request.args.get("region", "euw")
    tier = request.args.get("tier", "emerald_plus")
    role = request.args.get("role", "all")

    stats = fetch_champion_stats(region, tier, role)
    with _lock:
        _cache["champion_stats"] = stats
    return jsonify(stats)


# ---------------------------------------------------------------------------
# API : Matchups
# ---------------------------------------------------------------------------

@app.route("/api/matchups/<champion_name>")
def api_matchups(champion_name: str):
    """Matchups pour un champion donné."""
    region = request.args.get("region", "euw")
    role = request.args.get("role", "")
    data = fetch_champion_matchups(champion_name, role, region)
    with _lock:
        _cache["matchup_data"][champion_name] = data
    return jsonify(data)


# ---------------------------------------------------------------------------
# API : Profil joueur
# ---------------------------------------------------------------------------

@app.route("/api/player")
def api_player():
    """Profil d'un joueur (rang, champions les plus joués)."""
    summoner = request.args.get("summoner", "")
    region = request.args.get("region", "euw")
    if not summoner:
        return jsonify({"error": "Paramètre 'summoner' manquant"}), 400

    profile = fetch_player_profile(summoner, region)
    with _lock:
        _cache["player_pool"] = profile.get("most_played", [])
    return jsonify(profile)


# ---------------------------------------------------------------------------
# API : Recommandations
# ---------------------------------------------------------------------------

@app.route("/api/recommend", methods=["POST"])
def api_recommend():
    """
    Génère des recommandations de champions.
    Body JSON attendu :
    {
        "player_pool": [{"champion": "Jinx", "win_rate": 55, "games": 50}, ...],
        "enemy_picks": ["Aatrox", "LeeSin"],
        "banned": ["Zed", "Yasuo"],
        "already_picked": ["Jinx"],
        "role": "bottom",
        "region": "euw",
        "top_n": 10
    }
    """
    body = request.get_json(silent=True) or {}

    player_pool = body.get("player_pool", [])
    enemy_picks = body.get("enemy_picks", [])
    banned = body.get("banned", [])
    already_picked = body.get("already_picked", [])
    role = body.get("role", "all")
    region = body.get("region", "euw")
    priority = body.get("priority", 50)  # 0=pool, 100=meta
    top_n = body.get("top_n", 10)

    # Charger les stats si pas en cache
    with _lock:
        stats = _cache.get("champion_stats", [])
    if not stats:
        stats = fetch_champion_stats(region, "emerald_plus", role)
        with _lock:
            _cache["champion_stats"] = stats

    # Charger les matchups pour chaque champion recommandable si ennemi a pick
    matchup_data = {}
    if enemy_picks:
        with _lock:
            matchup_data = dict(_cache.get("matchup_data", {}))

    recs = recommend_champions(
        all_champion_stats=stats,
        player_pool=player_pool,
        enemy_picks=enemy_picks,
        matchup_data=matchup_data,
        role=role,
        banned_champions=banned,
        already_picked=already_picked,
        priority=priority,
        top_n=top_n,
    )
    return jsonify(recs)


# ---------------------------------------------------------------------------
# API : set player pool manuellement
# ---------------------------------------------------------------------------

@app.route("/api/player-pool", methods=["POST"])
def api_set_player_pool():
    """Définir / modifier manuellement le champion pool du joueur."""
    body = request.get_json(silent=True) or {}
    pool = body.get("pool", [])
    with _lock:
        _cache["player_pool"] = pool
    return jsonify({"status": "ok", "pool_size": len(pool)})


@app.route("/api/player-pool", methods=["GET"])
def api_get_player_pool():
    with _lock:
        pool = list(_cache.get("player_pool", []))
    return jsonify(pool)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("=" * 50)
    print("  DraftForMe - http://localhost:5000")
    print("=" * 50)
    try:
        app.run(debug=True, port=5000, use_reloader=False)
    finally:
        close_driver()
