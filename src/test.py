from riotwatcher import LolWatcher

from dotenv import load_dotenv, find_dotenv
import os
import requests
import json

dotenv_path = find_dotenv('API.env')
load_dotenv(dotenv_path)

API_KEY = os.getenv("RIOT_API_KEY")

def get_api_key():
    return API_KEY

def get_player_id(summoner_name, tag):
    get_account_id_url = "https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/" + summoner_name + "/" + tag + "?api_key=" + API_KEY

    response = requests.get(get_account_id_url)

    return json.loads(response.text)["puuid"]

def get_champion_mastery(summoner_id):
    get_champ_mastery_url = "https://euw1.api.riotgames.com/lol/champion-mastery/v4/champion-masteries/by-puuid/" + summoner_id + "?api_key=" + API_KEY

    response = requests.get(get_champ_mastery_url)
    return json.loads(response.text)

print(get_player_id("theslim194","EUW"))




