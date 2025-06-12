import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Riot Games API Configuration
    RIOT_API_KEY = os.getenv('RIOT_API_KEY', '')
    RIOT_API_BASE_URL = 'https://americas.api.riotgames.com'
    RIOT_API_REGIONAL_URLS = {
        'na1': 'https://na1.api.riotgames.com',
        'euw1': 'https://euw1.api.riotgames.com',
        'eun1': 'https://eun1.api.riotgames.com',
        'kr': 'https://kr.api.riotgames.com',
        'br1': 'https://br1.api.riotgames.com',
        'la1': 'https://la1.api.riotgames.com',
        'la2': 'https://la2.api.riotgames.com',
        'oc1': 'https://oc1.api.riotgames.com',
        'tr1': 'https://tr1.api.riotgames.com',
        'ru': 'https://ru.api.riotgames.com',
        'jp1': 'https://jp1.api.riotgames.com',
    }
    
    # Rate Limiting
    RIOT_API_RATE_LIMIT_PER_SECOND = int(os.getenv('RIOT_API_RATE_LIMIT_PER_SECOND', 20))
    RIOT_API_RATE_LIMIT_PER_MINUTE = int(os.getenv('RIOT_API_RATE_LIMIT_PER_MINUTE', 100))
    
    # Cache Configuration
    CACHE_TYPE = os.getenv('CACHE_TYPE', 'simple')
    CACHE_DEFAULT_TIMEOUT = int(os.getenv('CACHE_DEFAULT_TIMEOUT', 300))
    
    # Flask Configuration
    DEBUG = os.getenv('FLASK_DEBUG', 'True').lower() == 'true'
    
    # Game Configuration
    RECENT_GAMES_COUNT = 20  # Number of recent games to analyze
    CHAMPION_MASTERY_COUNT = 10  # Number of top mastery champions to consider 