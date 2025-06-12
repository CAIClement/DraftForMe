from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_caching import Cache
import pandas as pd
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
import json
import os
from config import Config
from riot_api import riot_api, user_analyzer, RiotAPIError
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configure caching
cache = Cache(app, config={
    'CACHE_TYPE': Config.CACHE_TYPE,
    'CACHE_DEFAULT_TIMEOUT': Config.CACHE_DEFAULT_TIMEOUT
})

# Mock champion data - in a real app, this would come from Riot API or database
CHAMPIONS = [
    {"id": 1, "name": "Aatrox", "role": "top", "tags": ["fighter", "tank"]},
    {"id": 2, "name": "Ahri", "role": "mid", "tags": ["mage", "assassin"]},
    {"id": 3, "name": "Akali", "role": "mid", "tags": ["assassin", "mage"]},
    {"id": 4, "name": "Alistar", "role": "support", "tags": ["tank", "support"]},
    {"id": 5, "name": "Amumu", "role": "jungle", "tags": ["tank", "mage"]},
    {"id": 6, "name": "Anivia", "role": "mid", "tags": ["mage", "support"]},
    {"id": 7, "name": "Annie", "role": "mid", "tags": ["mage"]},
    {"id": 8, "name": "Ashe", "role": "adc", "tags": ["marksman", "support"]},
    {"id": 9, "name": "Azir", "role": "mid", "tags": ["mage", "marksman"]},
    {"id": 10, "name": "Bard", "role": "support", "tags": ["support", "mage"]},
    {"id": 11, "name": "Blitzcrank", "role": "support", "tags": ["tank", "fighter"]},
    {"id": 12, "name": "Brand", "role": "support", "tags": ["mage"]},
    {"id": 13, "name": "Braum", "role": "support", "tags": ["support", "tank"]},
    {"id": 14, "name": "Caitlyn", "role": "adc", "tags": ["marksman"]},
    {"id": 15, "name": "Camille", "role": "top", "tags": ["fighter", "tank"]},
    {"id": 16, "name": "Cassiopeia", "role": "mid", "tags": ["mage"]},
    {"id": 17, "name": "Cho'Gath", "role": "top", "tags": ["tank", "mage"]},
    {"id": 18, "name": "Corki", "role": "mid", "tags": ["marksman", "mage"]},
    {"id": 19, "name": "Darius", "role": "top", "tags": ["fighter", "tank"]},
    {"id": 20, "name": "Diana", "role": "jungle", "tags": ["fighter", "mage"]},
]

# Mock synergy and counter data
SYNERGIES = {
    "tank": ["marksman", "mage"],
    "fighter": ["support", "mage"],
    "mage": ["tank", "support"],
    "marksman": ["tank", "support"],
    "assassin": ["tank", "fighter"],
    "support": ["marksman", "mage"]
}

COUNTERS = {
    "tank": ["mage", "marksman"],
    "fighter": ["tank", "mage"],
    "mage": ["assassin", "fighter"],
    "marksman": ["assassin", "fighter"],
    "assassin": ["tank", "fighter"],
    "support": ["assassin"]
}

@app.route('/api/champions', methods=['GET'])
def get_champions():
    """Get all available champions"""
    return jsonify(CHAMPIONS)

@app.route('/api/champions/by-role/<role>', methods=['GET'])
def get_champions_by_role(role):
    """Get champions filtered by role"""
    filtered_champions = [champ for champ in CHAMPIONS if champ['role'] == role.lower()]
    return jsonify(filtered_champions)

@app.route('/api/summoner/search', methods=['POST'])
def search_summoner():
    """Search for a summoner and get their basic info"""
    data = request.get_json()
    summoner_name = data.get('summonerName', '').strip()
    region = data.get('region', 'na1').lower()

    
    if not summoner_name:
        return jsonify({'error': 'Summoner name is required'}), 400
    
    if not Config.RIOT_API_KEY:
        return jsonify({
            'error': 'Riot API key not configured. Using mock data.',
            'mock_data': True,
            'summoner': {
                'name': summoner_name,
                'level': 100,
                'puuid': 'mock_puuid',
                'id': 'mock_id'
            },
            'region': region
        }), 200
    
    try:
        summoner = riot_api.get_summoner_by_name(summoner_name, region)
        return jsonify({
            'summoner': {
                'name': summoner['name'],
                'level': summoner['summonerLevel'],
                'puuid': summoner['puuid'],
                'id': summoner['id']
            },
            'region': region
        })
    except RiotAPIError as e:
        logger.error(f"Failed to search summoner: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/summoner/history', methods=['POST'])
@cache.cached(timeout=300)  # Cache for 5 minutes
def get_summoner_history():
    """Get detailed summoner history and champion preferences"""
    data = request.get_json()
    summoner_name = data.get('summonerName', '').strip()
    region = data.get('region', 'na1').lower()
    
    if not summoner_name:
        return jsonify({'error': 'Summoner name is required'}), 400
    
    if not Config.RIOT_API_KEY:
        return jsonify({
            'error': 'Riot API key not configured. Using mock data.',
            'mock_data': True,
            'champion_preferences': [1, 2, 8, 14],  # Mock preferences
            'summoner': {
                'name': summoner_name,
                'level': 100,
                'region': region
            }
        }), 200
    
    try:
        history_data = user_analyzer.analyze_user_history(summoner_name, region)
        
        # Extract champion IDs for the recommendation system
        preferred_champion_ids = [
            pref['championId'] for pref in history_data['champion_preferences'][:10]
        ]
        
        return jsonify({
            'success': True,
            'summoner': history_data['summoner'],
            'champion_preferences': preferred_champion_ids,
            'detailed_preferences': history_data['champion_preferences'][:10],
            'top_champions': history_data['top_champions'],
            'role_preferences': history_data['role_preferences'],
            'mastery_champions': history_data['mastery_champions'],
            'total_games_analyzed': history_data['total_games_analyzed'],
            'region': region
        })
        
    except RiotAPIError as e:
        logger.error(f"Failed to get summoner history: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/summoner/current-game', methods=['POST'])
def get_current_game():
    """Get current game information for a summoner"""
    data = request.get_json()
    summoner_name = data.get('summonerName', '').strip()
    region = data.get('region', 'na1').lower()
    
    if not summoner_name:
        return jsonify({'error': 'Summoner name is required'}), 400
    
    if not Config.RIOT_API_KEY:
        return jsonify({'error': 'Riot API key not configured'}), 400
    
    try:
        # Get summoner info first
        summoner = riot_api.get_summoner_by_name(summoner_name, region)
        current_game = riot_api.get_current_game(summoner['id'], region)
        
        if not current_game:
            return jsonify({'in_game': False, 'message': 'Summoner is not currently in a game'})
        
        # Extract team information
        ally_team = []
        enemy_team = []
        user_team_id = None
        
        # Find user's team
        for participant in current_game['participants']:
            if participant['summonerId'] == summoner['id']:
                user_team_id = participant['teamId']
                break
        
        # Categorize participants
        for participant in current_game['participants']:
            champion_info = {
                'championId': participant['championId'],
                'summonerName': participant['summonerName'],
                'teamId': participant['teamId']
            }
            
            if participant['teamId'] == user_team_id:
                if participant['summonerId'] != summoner['id']:  # Don't include the user
                    ally_team.append(champion_info)
            else:
                enemy_team.append(champion_info)
        
        return jsonify({
            'in_game': True,
            'game_mode': current_game.get('gameMode', 'Unknown'),
            'game_type': current_game.get('gameType', 'Unknown'),
            'ally_team': ally_team,
            'enemy_team': enemy_team,
            'user_champion_id': None  # Will be filled when user picks
        })
        
    except RiotAPIError as e:
        logger.error(f"Failed to get current game: {str(e)}")
        return jsonify({'error': str(e)}), 400

@app.route('/api/recommend', methods=['POST'])
def recommend_champion():
    """
    Recommend champions based on:
    - User's game history (preferred champions)
    - Ally team composition
    - Enemy team composition
    - Target role
    """
    data = request.get_json()
    
    user_history = data.get('userHistory', [])  # List of champion IDs user plays
    ally_team = data.get('allyTeam', [])        # List of champion IDs in ally team
    enemy_team = data.get('enemyTeam', [])      # List of champion IDs in enemy team
    target_role = data.get('targetRole', '')    # Role to fill
    
    # Enhanced user history from Riot API if available
    summoner_data = data.get('summonerData', {})
    if summoner_data and summoner_data.get('champion_preferences'):
        user_history = summoner_data['champion_preferences']
    
    # Get available champions for the target role
    available_champions = [champ for champ in CHAMPIONS if champ['role'] == target_role.lower()]
    
    recommendations = []
    
    for champion in available_champions:
        score = calculate_champion_score(champion, user_history, ally_team, enemy_team, summoner_data)
        recommendations.append({
            'champion': champion,
            'score': score,
            'reasoning': generate_reasoning(champion, ally_team, enemy_team, summoner_data)
        })
    
    # Sort by score (highest first)
    recommendations.sort(key=lambda x: x['score'], reverse=True)
    
    return jsonify({
        'recommendations': recommendations[:5],  # Top 5 recommendations
        'targetRole': target_role,
        'using_real_data': bool(summoner_data and summoner_data.get('champion_preferences'))
    })

def calculate_champion_score(champion, user_history, ally_team, enemy_team, summoner_data=None):
    """Calculate a score for how good this champion pick is"""
    score = 50  # Base score
    
    # Enhanced user preference bonus with detailed data
    if summoner_data and summoner_data.get('detailed_preferences'):
        for pref in summoner_data['detailed_preferences']:
            if pref['championId'] == champion['id']:
                # More sophisticated scoring based on actual performance
                score += min(30, pref['preferenceScore'] / 10)  # Scale preference score
                score += pref['winRate'] * 20  # Win rate bonus
                score += min(10, pref['avgKDA'] * 2)  # KDA bonus
                break
    elif champion['id'] in user_history:
        score += 20  # Fallback bonus
    
    # Role preference bonus
    if summoner_data and summoner_data.get('role_preferences'):
        role_prefs = summoner_data['role_preferences']
        total_games = sum(role_prefs.values())
        if total_games > 0:
            role_ratio = role_prefs.get(champion['role'], 0) / total_games
            score += role_ratio * 15  # Bonus for preferred roles
    
    # Synergy with ally team
    ally_champions = [get_champion_by_id(champ_id) for champ_id in ally_team if get_champion_by_id(champ_id)]
    for ally in ally_champions:
        if ally:
            synergy_score = calculate_synergy(champion, ally)
            score += synergy_score
    
    # Counter potential against enemy team
    enemy_champions = [get_champion_by_id(champ_id) for champ_id in enemy_team if get_champion_by_id(champ_id)]
    for enemy in enemy_champions:
        if enemy:
            counter_score = calculate_counter(champion, enemy)
            score += counter_score
    
    # Avoid being countered
    for enemy in enemy_champions:
        if enemy:
            being_countered_score = calculate_counter(enemy, champion)
            score -= being_countered_score
    
    return max(0, min(100, score))  # Clamp between 0-100

def calculate_synergy(champ1, champ2):
    """Calculate synergy score between two champions"""
    score = 0
    for tag1 in champ1['tags']:
        for tag2 in champ2['tags']:
            if tag2 in SYNERGIES.get(tag1, []):
                score += 5
    return score

def calculate_counter(counter_champ, target_champ):
    """Calculate how well counter_champ counters target_champ"""
    score = 0
    for counter_tag in counter_champ['tags']:
        for target_tag in target_champ['tags']:
            if target_tag in COUNTERS.get(counter_tag, []):
                score += 8
    return score

def get_champion_by_id(champ_id):
    """Get champion data by ID"""
    for champion in CHAMPIONS:
        if champion['id'] == champ_id:
            return champion
    return None

def generate_reasoning(champion, ally_team, enemy_team, summoner_data=None):
    """Generate human-readable reasoning for the recommendation"""
    reasons = []
    
    # Personal performance reasons
    if summoner_data and summoner_data.get('detailed_preferences'):
        for pref in summoner_data['detailed_preferences']:
            if pref['championId'] == champion['id']:
                if pref['winRate'] > 0.6:
                    reasons.append(f"High win rate ({pref['winRate']:.1%}) with this champion")
                if pref['games'] >= 5:
                    reasons.append(f"Experienced with this champion ({pref['games']} games)")
                if pref['avgKDA'] > 2.0:
                    reasons.append(f"Strong KDA performance ({pref['avgKDA']:.1f})")
                break
    
    # Check synergies
    ally_champions = [get_champion_by_id(champ_id) for champ_id in ally_team if get_champion_by_id(champ_id)]
    for ally in ally_champions:
        if ally and calculate_synergy(champion, ally) > 0:
            reasons.append(f"Good synergy with {ally['name']}")
    
    # Check counters
    enemy_champions = [get_champion_by_id(champ_id) for champ_id in enemy_team if get_champion_by_id(champ_id)]
    for enemy in enemy_champions:
        if enemy and calculate_counter(champion, enemy) > 0:
            reasons.append(f"Counters {enemy['name']}")
    
    # Role preference
    if summoner_data and summoner_data.get('role_preferences'):
        role_prefs = summoner_data['role_preferences']
        total_games = sum(role_prefs.values())
        if total_games > 0:
            role_ratio = role_prefs.get(champion['role'], 0) / total_games
            if role_ratio > 0.3:
                reasons.append(f"Matches your preferred role ({champion['role']})")
    
    if not reasons:
        reasons.append("Solid pick for this role")
    
    return reasons[:3]  # Limit to 3 reasons

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    api_status = "configured" if Config.RIOT_API_KEY else "not configured"
    return jsonify({
        "status": "healthy", 
        "message": "DraftForMe API is running",
        "riot_api": api_status
    })

@app.route('/api/regions', methods=['GET'])
def get_regions():
    """Get available regions"""
    regions = [
        {'code': 'na1', 'name': 'North America'},
        {'code': 'euw1', 'name': 'Europe West'},
        {'code': 'eun1', 'name': 'Europe Nordic & East'},
        {'code': 'kr', 'name': 'Korea'},
        {'code': 'br1', 'name': 'Brazil'},
        {'code': 'la1', 'name': 'Latin America North'},
        {'code': 'la2', 'name': 'Latin America South'},
        {'code': 'oc1', 'name': 'Oceania'},
        {'code': 'tr1', 'name': 'Turkey'},
        {'code': 'ru', 'name': 'Russia'},
        {'code': 'jp1', 'name': 'Japan'},
    ]
    return jsonify(regions)

if __name__ == '__main__':
    app.run(debug=Config.DEBUG, host='0.0.0.0', port=5000) 