import requests
import time
from typing import Dict, List, Optional, Tuple
from config import Config
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class RiotAPIError(Exception):
    """Custom exception for Riot API errors"""
    pass

class RateLimiter:
    """Simple rate limiter for API calls"""
    def __init__(self, calls_per_second: int, calls_per_minute: int):
        self.calls_per_second = calls_per_second
        self.calls_per_minute = calls_per_minute
        self.second_calls = []
        self.minute_calls = []
    
    def wait_if_needed(self):
        """Wait if rate limit would be exceeded"""
        current_time = time.time()
        
        # Clean old calls
        self.second_calls = [t for t in self.second_calls if current_time - t < 1]
        self.minute_calls = [t for t in self.minute_calls if current_time - t < 60]
        
        # Check if we need to wait
        if len(self.second_calls) >= self.calls_per_second:
            sleep_time = 1 - (current_time - self.second_calls[0])
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        if len(self.minute_calls) >= self.calls_per_minute:
            sleep_time = 60 - (current_time - self.minute_calls[0])
            if sleep_time > 0:
                time.sleep(sleep_time)
        
        # Record this call
        current_time = time.time()
        self.second_calls.append(current_time)
        self.minute_calls.append(current_time)

class RiotAPI:
    """Riot Games API client"""
    
    def __init__(self):
        self.api_key = Config.RIOT_API_KEY
        self.base_url = Config.RIOT_API_BASE_URL
        self.regional_urls = Config.RIOT_API_REGIONAL_URLS
        self.rate_limiter = RateLimiter(
            Config.RIOT_API_RATE_LIMIT_PER_SECOND,
            Config.RIOT_API_RATE_LIMIT_PER_MINUTE
        )
        
        if not self.api_key:
            logger.warning("No Riot API key provided. API calls will fail.")
    
    def _make_request(self, url: str, params: Dict = None) -> Dict:
        """Make a rate-limited request to the Riot API"""
        if not self.api_key:
            raise RiotAPIError("No API key configured")
        
        self.rate_limiter.wait_if_needed()
        
        headers = {
            'X-Riot-Token': self.api_key,
            'Accept': 'application/json'
        }
        
        try:
            response = requests.get(url, headers=headers, params=params, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                raise RiotAPIError(f"Resource not found: {url}")
            elif response.status_code == 403:
                raise RiotAPIError("API key invalid or expired")
            elif response.status_code == 429:
                # Rate limited - wait and retry once
                retry_after = int(response.headers.get('Retry-After', 1))
                logger.warning(f"Rate limited. Waiting {retry_after} seconds...")
                time.sleep(retry_after)
                return self._make_request(url, params)
            else:
                raise RiotAPIError(f"API request failed with status {response.status_code}: {response.text}")
                
        except requests.RequestException as e:
            raise RiotAPIError(f"Request failed: {str(e)}")
    
    def get_summoner_by_name(self, summoner_name: str, region: str = 'na1') -> Dict:
        """Get summoner information by name"""
        if region not in self.regional_urls:
            raise RiotAPIError(f"Invalid region: {region}")
        
        url = f"{self.regional_urls[region]}/lol/summoner/v4/summoners/by-name/{summoner_name}"
        return self._make_request(url)
    
    def get_summoner_by_puuid(self, puuid: str, region: str = 'na1') -> Dict:
        """Get summoner information by PUUID"""
        if region not in self.regional_urls:
            raise RiotAPIError(f"Invalid region: {region}")
        
        url = f"{self.regional_urls[region]}/lol/summoner/v4/summoners/by-puuid/{puuid}"
        return self._make_request(url)
    
    def get_match_history(self, puuid: str, count: int = 20, queue: int = None) -> List[str]:
        """Get match history for a player"""
        url = f"{self.base_url}/lol/match/v5/matches/by-puuid/{puuid}/ids"
        params = {'count': count}
        if queue:
            params['queue'] = queue
        
        return self._make_request(url, params)
    
    def get_match_details(self, match_id: str) -> Dict:
        """Get detailed match information"""
        url = f"{self.base_url}/lol/match/v5/matches/{match_id}"
        return self._make_request(url)
    
    def get_champion_masteries(self, summoner_id: str, region: str = 'na1', count: int = 10) -> List[Dict]:
        """Get champion mastery information for a summoner"""
        if region not in self.regional_urls:
            raise RiotAPIError(f"Invalid region: {region}")
        
        url = f"{self.regional_urls[region]}/lol/champion-mastery/v4/champion-masteries/by-summoner/{summoner_id}"
        params = {'count': count}
        return self._make_request(url, params)
    
    def get_current_game(self, summoner_id: str, region: str = 'na1') -> Optional[Dict]:
        """Get current game information for a summoner"""
        if region not in self.regional_urls:
            raise RiotAPIError(f"Invalid region: {region}")
        
        url = f"{self.regional_urls[region]}/lol/spectator/v4/active-games/by-summoner/{summoner_id}"
        try:
            return self._make_request(url)
        except RiotAPIError as e:
            if "not found" in str(e).lower():
                return None  # Player not in game
            raise
    
    def get_champion_data(self) -> Dict:
        """Get static champion data from Data Dragon"""
        # Use Data Dragon for champion data (doesn't require API key)
        url = "https://ddragon.leagueoflegends.com/cdn/13.24.1/data/en_US/champion.json"
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                raise RiotAPIError(f"Failed to fetch champion data: {response.status_code}")
        except requests.RequestException as e:
            raise RiotAPIError(f"Failed to fetch champion data: {str(e)}")

class UserHistoryAnalyzer:
    """Analyze user's game history to extract champion preferences"""
    
    def __init__(self, riot_api: RiotAPI):
        self.riot_api = riot_api
    
    def analyze_user_history(self, summoner_name: str, region: str = 'na1') -> Dict:
        """Analyze user's game history and return champion preferences"""
        try:
            # Get summoner info
            summoner = self.riot_api.get_summoner_by_name(summoner_name, region)
            puuid = summoner['puuid']
            summoner_id = summoner['id']
            
            # Get recent matches (ranked games only)
            match_ids = self.riot_api.get_match_history(
                puuid, 
                count=Config.RECENT_GAMES_COUNT,
                queue=420  # Ranked Solo/Duo
            )
            
            # Get champion masteries
            masteries = self.riot_api.get_champion_masteries(
                summoner_id, 
                region, 
                count=Config.CHAMPION_MASTERY_COUNT
            )
            
            # Analyze match data
            champion_stats = {}
            total_games = 0
            
            for match_id in match_ids:
                try:
                    match_data = self.riot_api.get_match_details(match_id)
                    participant = self._find_participant(match_data, puuid)
                    
                    if participant:
                        champion_id = participant['championId']
                        champion_name = participant['championName']
                        role = self._determine_role(participant)
                        won = participant['win']
                        
                        if champion_id not in champion_stats:
                            champion_stats[champion_id] = {
                                'name': champion_name,
                                'games': 0,
                                'wins': 0,
                                'roles': {},
                                'kda': [],
                                'recent_performance': []
                            }
                        
                        stats = champion_stats[champion_id]
                        stats['games'] += 1
                        if won:
                            stats['wins'] += 1
                        
                        # Track role
                        if role not in stats['roles']:
                            stats['roles'][role] = 0
                        stats['roles'][role] += 1
                        
                        # Track KDA
                        kda = (participant['kills'] + participant['assists']) / max(1, participant['deaths'])
                        stats['kda'].append(kda)
                        
                        # Recent performance score (0-100)
                        performance_score = self._calculate_performance_score(participant)
                        stats['recent_performance'].append(performance_score)
                        
                        total_games += 1
                        
                except Exception as e:
                    logger.warning(f"Failed to process match {match_id}: {str(e)}")
                    continue
            
            # Calculate champion preferences
            preferences = self._calculate_preferences(champion_stats, masteries)
            
            return {
                'summoner': {
                    'name': summoner['name'],
                    'level': summoner['summonerLevel'],
                    'puuid': puuid
                },
                'total_games_analyzed': total_games,
                'champion_preferences': preferences,
                'top_champions': self._get_top_champions(champion_stats, 10),
                'role_preferences': self._calculate_role_preferences(champion_stats),
                'mastery_champions': [
                    {
                        'championId': m['championId'],
                        'championLevel': m['championLevel'],
                        'championPoints': m['championPoints']
                    }
                    for m in masteries[:5]
                ]
            }
            
        except RiotAPIError as e:
            logger.error(f"Failed to analyze user history: {str(e)}")
            raise
    
    def _find_participant(self, match_data: Dict, puuid: str) -> Optional[Dict]:
        """Find the participant data for the given PUUID"""
        for participant in match_data['info']['participants']:
            if participant['puuid'] == puuid:
                return participant
        return None
    
    def _determine_role(self, participant: Dict) -> str:
        """Determine the role based on participant data"""
        team_position = participant.get('teamPosition', '').lower()
        individual_position = participant.get('individualPosition', '').lower()
        
        # Map Riot's position names to our role names
        position_map = {
            'top': 'top',
            'jungle': 'jungle',
            'middle': 'mid',
            'bottom': 'adc',
            'utility': 'support'
        }
        
        role = position_map.get(team_position) or position_map.get(individual_position)
        return role or 'unknown'
    
    def _calculate_performance_score(self, participant: Dict) -> float:
        """Calculate a performance score (0-100) based on game stats"""
        # Basic performance metrics
        kda = (participant['kills'] + participant['assists']) / max(1, participant['deaths'])
        cs_per_min = participant['totalMinionsKilled'] / max(1, participant['timePlayed'] / 60)
        vision_score = participant.get('visionScore', 0)
        damage_ratio = participant.get('teamDamagePercentage', 0) * 100
        
        # Normalize and weight the metrics
        kda_score = min(100, (kda / 3.0) * 100)  # 3.0 KDA = 100 points
        cs_score = min(100, (cs_per_min / 8.0) * 100)  # 8 CS/min = 100 points
        vision_score_norm = min(100, (vision_score / 50.0) * 100)  # 50 vision = 100 points
        damage_score = min(100, damage_ratio)
        
        # Weight the scores
        performance_score = (
            kda_score * 0.3 +
            cs_score * 0.2 +
            vision_score_norm * 0.2 +
            damage_score * 0.2 +
            (100 if participant['win'] else 0) * 0.1
        )
        
        return performance_score
    
    def _calculate_preferences(self, champion_stats: Dict, masteries: List[Dict]) -> List[Dict]:
        """Calculate champion preferences based on games and mastery"""
        preferences = []
        
        # Create mastery lookup
        mastery_lookup = {m['championId']: m for m in masteries}
        
        for champion_id, stats in champion_stats.items():
            win_rate = stats['wins'] / max(1, stats['games'])
            avg_kda = sum(stats['kda']) / len(stats['kda']) if stats['kda'] else 0
            avg_performance = sum(stats['recent_performance']) / len(stats['recent_performance']) if stats['recent_performance'] else 0
            
            # Get mastery info
            mastery = mastery_lookup.get(champion_id, {})
            mastery_level = mastery.get('championLevel', 0)
            mastery_points = mastery.get('championPoints', 0)
            
            # Calculate preference score
            preference_score = (
                stats['games'] * 2 +  # Games played
                win_rate * 50 +  # Win rate bonus
                avg_kda * 10 +  # KDA bonus
                avg_performance * 0.5 +  # Performance bonus
                mastery_level * 5 +  # Mastery level bonus
                (mastery_points / 1000) * 2  # Mastery points bonus
            )
            
            preferences.append({
                'championId': champion_id,
                'championName': stats['name'],
                'preferenceScore': preference_score,
                'games': stats['games'],
                'winRate': win_rate,
                'avgKDA': avg_kda,
                'avgPerformance': avg_performance,
                'masteryLevel': mastery_level,
                'masteryPoints': mastery_points,
                'primaryRole': max(stats['roles'], key=stats['roles'].get) if stats['roles'] else 'unknown'
            })
        
        # Sort by preference score
        preferences.sort(key=lambda x: x['preferenceScore'], reverse=True)
        return preferences
    
    def _get_top_champions(self, champion_stats: Dict, count: int) -> List[Dict]:
        """Get top champions by games played"""
        champions = []
        for champion_id, stats in champion_stats.items():
            champions.append({
                'championId': champion_id,
                'championName': stats['name'],
                'games': stats['games'],
                'wins': stats['wins'],
                'winRate': stats['wins'] / max(1, stats['games'])
            })
        
        champions.sort(key=lambda x: x['games'], reverse=True)
        return champions[:count]
    
    def _calculate_role_preferences(self, champion_stats: Dict) -> Dict[str, int]:
        """Calculate role preferences based on games played"""
        role_counts = {}
        
        for stats in champion_stats.values():
            for role, count in stats['roles'].items():
                if role not in role_counts:
                    role_counts[role] = 0
                role_counts[role] += count
        
        return role_counts

# Global instance
riot_api = RiotAPI()
user_analyzer = UserHistoryAnalyzer(riot_api) 