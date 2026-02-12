"""
Module de scraping OP.GG pour DraftForMe.
- Stats des champions (win rate, pick rate, ban rate, etc.)
- Matchups / counterpicks par champion
- Profil joueur (champions les plus joués)
"""

import json
import os
import re
import time
from pathlib import Path
from urllib.parse import quote, urlencode

import requests
from bs4 import BeautifulSoup
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait
from webdriver_manager.chrome import ChromeDriverManager

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

REGIONS = ["euw", "na", "kr", "eune", "oce", "jp", "br", "las", "lan", "ru", "tr"]

ROLES = ["top", "jungle", "middle", "bottom", "support"]

# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

_driver_instance = None


def get_driver(headless: bool = True) -> webdriver.Chrome:
    """Crée ou réutilise un driver Chrome."""
    global _driver_instance
    if _driver_instance is not None:
        try:
            _ = _driver_instance.title  # test si encore vivant
            return _driver_instance
        except Exception:
            _driver_instance = None

    options = Options()
    if headless:
        options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-gpu")
    options.add_argument("--window-size=1920,1080")
    options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
    service = Service(ChromeDriverManager().install())
    _driver_instance = webdriver.Chrome(service=service, options=options)
    return _driver_instance


def close_driver():
    global _driver_instance
    if _driver_instance:
        _driver_instance.quit()
        _driver_instance = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _clean_rate(s: str | None) -> float | None:
    """'49.72%49.72%' -> 49.72"""
    if not s:
        return None
    m = re.search(r"([\d.]+)%", s)
    return float(m.group(1)) if m else None


def _clean_num(s: str | None) -> str | None:
    if not s:
        return None
    return re.sub(r"[\u202f\u00a0]", "", s).strip() or None


def _champion_key(name: str) -> str:
    """Convertit un nom d'affichage en clé Data Dragon. Ex: 'Dr. Mundo' -> 'DrMundo'."""
    mapping = {
        "Aurelion Sol": "AurelionSol",
        "Bel'Veth": "Belveth",
        "Cho'Gath": "Chogath",
        "Dr. Mundo": "DrMundo",
        "Jarvan IV": "JarvanIV",
        "K'Sante": "KSante",
        "Kai'Sa": "Kaisa",
        "Kha'Zix": "Khazix",
        "Kog'Maw": "KogMaw",
        "LeBlanc": "Leblanc",
        "Lee Sin": "LeeSin",
        "Master Yi": "MasterYi",
        "Miss Fortune": "MissFortune",
        "Nunu & Willump": "Nunu",
        "Rek'Sai": "RekSai",
        "Renata Glasc": "Renata",
        "Tahm Kench": "TahmKench",
        "Twisted Fate": "TwistedFate",
        "Vel'Koz": "VelKoz",
        "Wukong": "MonkeyKing",
        "Xin Zhao": "XinZhao",
    }
    if name in mapping:
        return mapping[name]
    # Fallback : supprimer espaces, apostrophes, points
    return re.sub(r"['\s.]", "", name)


# ---------------------------------------------------------------------------
# Data Dragon : liste des champions + icônes
# ---------------------------------------------------------------------------

def fetch_ddragon_champions() -> dict:
    """Récupère la liste des champions depuis Data Dragon (avec images).
    Retourne {champion_name: {id, key, image_url, ...}}
    """
    cache = DATA_DIR / "ddragon_champions.json"
    if cache.exists():
        age_h = (time.time() - cache.stat().st_mtime) / 3600
        if age_h < 24:
            return json.loads(cache.read_text(encoding="utf-8"))

    versions = requests.get("https://ddragon.leagueoflegends.com/api/versions.json", timeout=10).json()
    latest = versions[0]

    url = f"https://ddragon.leagueoflegends.com/cdn/{latest}/data/en_US/champion.json"
    data = requests.get(url, timeout=15).json()["data"]

    result = {}
    for key, info in data.items():
        name = info["name"]
        result[name] = {
            "id": info["id"],
            "key": info["key"],
            "image": f"https://ddragon.leagueoflegends.com/cdn/{latest}/img/champion/{info['image']['full']}",
            "tags": info.get("tags", []),
        }

    cache.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


# ---------------------------------------------------------------------------
# Mapping role : interne -> op.gg URL
# ---------------------------------------------------------------------------

ROLE_TO_POSITION = {
    "top": "top",
    "jungle": "jungle",
    "middle": "mid",
    "mid": "mid",
    "bottom": "adc",
    "adc": "adc",
    "support": "support",
}


# ---------------------------------------------------------------------------
# Stats des champions (op.gg/lol/champions - tier list par role)
# ---------------------------------------------------------------------------

def fetch_champion_stats(region: str = "euw", tier: str = "emerald_plus", role: str = "mid") -> list[dict]:
    """Récupère la tier list des champions depuis op.gg/lol/champions.
    Filtre par role (mid, top, jungle, adc, support).
    La page contient une <table> avec des <tr> par champion.
    Chaque <tr> a : rang | (delta) | nom | WR% | PR% | BR% | counters
    """
    position = ROLE_TO_POSITION.get(role, role)
    cache_key = f"tierlist_{region}_{tier}_{position}"
    cache_file = DATA_DIR / f"{cache_key}.json"
    if cache_file.exists():
        age_h = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_h < 6:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    driver = get_driver()
    params = {"position": position, "tier": tier, "region": region}
    url = f"https://op.gg/lol/champions?{urlencode(params)}"
    driver.get(url)

    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table tr a[href*='/build/']"))
        )
    except Exception:
        pass
    time.sleep(2)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    champions = []

    # La tier list est dans une <table>, chaque champion est un <tr>
    for tr in soup.select("table tr"):
        # Chercher le lien build dans cette row
        build_link = tr.select_one("a[href*='/champions/'][href*='/build/']")
        if not build_link:
            continue

        href = build_link.get("href", "")
        name = build_link.get_text(strip=True)
        if not name or len(name) > 30:
            continue

        # Extraire le slug depuis le href
        parts = href.split("/")
        slug = ""
        for j, p in enumerate(parts):
            if p == "champions" and j + 1 < len(parts):
                slug = parts[j + 1]
                break

        # Texte de la row : "1 | 3 | Ahri | 52.6% | 12.51% | 3.59%"
        row_text = tr.get_text(separator=" | ", strip=True)
        rates = re.findall(r"([\d.]+)%", row_text)

        win_rate = float(rates[0]) if len(rates) > 0 else None
        pick_rate = float(rates[1]) if len(rates) > 1 else None
        ban_rate = float(rates[2]) if len(rates) > 2 else None

        # Extraire le rang (premier nombre dans le texte)
        rank_m = re.match(r"(\d+)", row_text.strip())
        rank = int(rank_m.group(1)) if rank_m else len(champions) + 1

        # Counters : liens vers /counters/ avec target_champion=xxx
        counter_links = tr.select("a[href*='/counters/']")
        counters = []
        for cl in counter_links:
            counter_href = cl.get("href", "")
            target_m = re.search(r"target_champion=(\w+)", counter_href)
            if target_m:
                counters.append(target_m.group(1))
        # Si pas de target_champion dans l'URL, chercher le alt des images counter
        if not counters:
            counter_imgs = tr.select("a[href*='/counters/'] img[alt]")
            for ci in counter_imgs:
                alt = ci.get("alt", "").strip()
                if alt and len(alt) < 25:
                    counters.append(alt)

        champions.append({
            "rank": rank,
            "name": name,
            "slug": slug,
            "role": position,
            "win_rate": win_rate,
            "pick_rate": pick_rate,
            "ban_rate": ban_rate,
            "counters": counters[:3],
        })

    # Dédupliquer
    seen = set()
    unique = []
    for c in champions:
        if c["name"].lower() not in seen:
            seen.add(c["name"].lower())
            unique.append(c)
    champions = unique

    if champions:
        cache_file.write_text(json.dumps(champions, ensure_ascii=False, indent=2), encoding="utf-8")
    return champions


# ---------------------------------------------------------------------------
# Matchups / Counterpicks (op.gg/lol/champions/{name}/counters)
# ---------------------------------------------------------------------------

# ---------------------------------------------------------------------------
# Build / Items recommandés (op.gg/lol/champions/{name}/build/{role})
# ---------------------------------------------------------------------------

def fetch_champion_build(champion_slug: str, role: str = "mid", region: str = "euw") -> dict:
    """Récupère les items recommandés pour un champion depuis la page build op.gg.
    Retourne {"items": [...], "boots": ..., "starter": [...], "skills": ...}
    """
    slug = champion_slug.lower().replace(" ", "").replace("'", "").replace(".", "")
    position = ROLE_TO_POSITION.get(role, role)
    cache_key = f"build_{slug}_{position}_{region}"
    cache_file = DATA_DIR / f"{cache_key}.json"
    if cache_file.exists():
        age_h = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_h < 12:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    driver = get_driver()
    url = f"https://op.gg/lol/champions/{slug}/build/{position}?region={region}"
    driver.get(url)

    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "img[src*='item']"))
        )
    except Exception:
        pass
    time.sleep(2)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    build = {"champion": champion_slug, "role": position, "core_items": [], "starter_items": [], "boots": None, "skill_order": None}

    # Items sont des images avec src contenant "item/" et un ID
    # ex: https://opgg-static.akamaized.net/meta/images/lol/.../item/3089.png
    all_item_imgs = soup.select("img[src*='/item/']")

    # Extraire les IDs d'items uniques
    item_ids_seen = []
    item_names_seen = []
    for img in all_item_imgs:
        src = img.get("src", "")
        alt = img.get("alt", "").strip()
        # Extraire l'ID : .../item/3089.png
        id_m = re.search(r"/item/(\d+)\.", src)
        if id_m:
            item_id = id_m.group(1)
            if item_id not in item_ids_seen:
                item_ids_seen.append(item_id)
                item_names_seen.append({"id": item_id, "name": alt or item_id, "image": src.split("?")[0]})

    # Les premiers items sont generalement starter, puis core
    # On prend les 6 premiers items comme core build
    if item_names_seen:
        build["core_items"] = item_names_seen[:6]
        if len(item_names_seen) > 6:
            build["starter_items"] = item_names_seen[6:9]

    # Skill order : chercher des patterns Q/W/E/R
    skill_text = ""
    for el in soup.select("[class*='skill'], [class*='Skill']"):
        text = el.get_text(strip=True)
        if any(c in text for c in ["Q", "W", "E", "R"]) and len(text) < 20:
            skill_text = text
            break
    if not skill_text:
        # Chercher dans le texte general
        page_text = soup.get_text()
        skill_m = re.search(r"([QWER])\s*>\s*([QWER])\s*>\s*([QWER])", page_text)
        if skill_m:
            skill_text = f"{skill_m.group(1)} > {skill_m.group(2)} > {skill_m.group(3)}"
    build["skill_order"] = skill_text or None

    if build["core_items"]:
        cache_file.write_text(json.dumps(build, ensure_ascii=False, indent=2), encoding="utf-8")
    return build


def fetch_champion_matchups(champion_name: str, role: str = "", region: str = "euw") -> dict:
    """Récupère les matchups pour un champion donné.
    Retourne {"strong_against": [...], "weak_against": [...], "all_matchups": [...]}
    """
    slug = champion_name.lower().replace(" ", "").replace("'", "").replace(".", "")
    cache_key = f"matchups_{slug}_{role}_{region}"
    cache_file = DATA_DIR / f"{cache_key}.json"
    if cache_file.exists():
        age_h = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_h < 12:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    driver = get_driver()
    url = f"https://op.gg/lol/champions/{slug}/counters"
    if role:
        url += f"/{role}"
    url += f"?region={region}"
    driver.get(url)
    time.sleep(3)

    soup = BeautifulSoup(driver.page_source, "html.parser")
    result = {"champion": champion_name, "role": role, "strong_against": [], "weak_against": [], "all_matchups": []}

    # Chercher les sections de matchup dans la page
    # OP.GG affiche des tables/listes avec les matchups
    tables = soup.select("table")
    for table in tables:
        rows = table.select("tbody tr")
        for row in rows:
            cells = row.select("td")
            if len(cells) < 2:
                continue
            link = row.select_one("a[href*='champions']")
            enemy_name = ""
            if link:
                enemy_name = link.get_text(strip=True)
            if not enemy_name:
                texts = [c.get_text(strip=True) for c in cells]
                enemy_name = texts[0] if texts else ""
            if not enemy_name:
                continue

            wr_text = row.get_text()
            wr_match = re.search(r"([\d.]+)%", wr_text)
            win_rate = float(wr_match.group(1)) if wr_match else None
            games_match = re.findall(r"[\d,]+", wr_text.replace("%", ""))
            games = games_match[-1] if games_match else None

            matchup = {"enemy": enemy_name, "win_rate": win_rate, "games": games}
            result["all_matchups"].append(matchup)

    # Si pas de table, chercher des blocs div / sections
    if not result["all_matchups"]:
        for section in soup.select("[class*='counter'], [class*='matchup'], [class*='Matchup']"):
            items = section.select("[class*='item'], [class*='row'], [class*='Row'], li, tr")
            for item in items:
                link = item.select_one("a[href*='champions']")
                name_el = item.select_one("[class*='name']")
                name = ""
                if link:
                    name = link.get_text(strip=True)
                elif name_el:
                    name = name_el.get_text(strip=True)
                if not name:
                    continue

                text = item.get_text()
                wr_m = re.search(r"([\d.]+)%", text)
                win_rate = float(wr_m.group(1)) if wr_m else None

                matchup = {"enemy": name, "win_rate": win_rate}
                result["all_matchups"].append(matchup)

    # Classer en strong/weak basé sur win_rate > 50 ou < 50
    for m in result["all_matchups"]:
        if m.get("win_rate") is not None:
            if m["win_rate"] >= 50:
                result["strong_against"].append(m)
            else:
                result["weak_against"].append(m)

    result["strong_against"].sort(key=lambda x: x.get("win_rate", 0), reverse=True)
    result["weak_against"].sort(key=lambda x: x.get("win_rate", 0))

    if result["all_matchups"]:
        cache_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


# ---------------------------------------------------------------------------
# Profil joueur (op.gg/lol/summoners/{region}/{name})
# ---------------------------------------------------------------------------

def fetch_player_profile(summoner_name: str, region: str = "euw") -> dict:
    """Récupère le profil d'un joueur : rang, champions les plus joués, etc.
    Utilise la page /champions du profil pour les stats détaillées.
    """
    name_slug = summoner_name.replace("#", "-")
    cache_key = f"player_{region}_{re.sub(r'[^a-zA-Z0-9]', '_', name_slug)}"
    cache_file = DATA_DIR / f"{cache_key}.json"
    if cache_file.exists():
        age_h = (time.time() - cache_file.stat().st_mtime) / 3600
        if age_h < 1:
            return json.loads(cache_file.read_text(encoding="utf-8"))

    driver = get_driver()
    profile = {
        "summoner_name": summoner_name,
        "region": region,
        "tier": None,
        "lp": None,
        "most_played": [],
    }

    # --- Étape 1 : Page summary pour le rang ---
    summary_url = f"https://op.gg/lol/summoners/{region}/{quote(name_slug)}"
    driver.get(summary_url)
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "img[src*='champion']"))
        )
    except Exception:
        pass
    time.sleep(2)

    soup = BeautifulSoup(driver.page_source, "html.parser")

    # Rang : chercher l'image du badge de rang (ex: Gold, Emerald, etc.)
    rank_img = soup.select_one("img[src*='medals'], img[src*='tier'], img[alt*='Ranked']")
    if rank_img:
        # Le texte du rang est souvent dans un voisin
        parent = rank_img.parent
        if parent:
            rank_text = parent.get_text(strip=True)
            # Extraire "Gold II", "Emerald IV", etc.
            tier_m = re.search(
                r"(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)"
                r"[\s]*(I{1,4}|IV|V)?",
                rank_text, re.IGNORECASE
            )
            if tier_m:
                profile["tier"] = tier_m.group(0).strip()
    # Fallback tier : texte dans la page
    if not profile["tier"]:
        page_text = soup.get_text()
        tier_m = re.search(
            r"(Iron|Bronze|Silver|Gold|Platinum|Emerald|Diamond|Master|Grandmaster|Challenger)"
            r"\s*(I{1,4}|IV|V)?\s*(\d+)\s*LP",
            page_text, re.IGNORECASE,
        )
        if tier_m:
            profile["tier"] = tier_m.group(0).strip()

    lp_m = re.search(r"(\d+)\s*LP", soup.get_text())
    if lp_m:
        profile["lp"] = int(lp_m.group(1))

    # --- Étape 2 : Résumé rapide (recent 20 games played champions) ---
    # Ces données sont dans des <li> contenant <img alt="ChampName" src="...champion/...">
    _extract_recent_champions(soup, profile)

    # --- Étape 3 : Page /champions pour les stats détaillées ---
    champs_url = f"https://op.gg/lol/summoners/{region}/{quote(name_slug)}/champions"
    driver.get(champs_url)
    try:
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "table tbody tr, img[src*='champion']"))
        )
    except Exception:
        pass
    time.sleep(2)

    soup2 = BeautifulSoup(driver.page_source, "html.parser")
    _extract_champion_table(soup2, profile)

    # Dédupliquer (garder la version avec le plus de données)
    seen = {}
    for c in profile["most_played"]:
        name = c.get("champion", "")
        if not name:
            continue
        existing = seen.get(name)
        if existing is None or (c.get("games") and not existing.get("games")):
            seen[name] = c
    profile["most_played"] = list(seen.values())

    if profile["most_played"] or profile["tier"]:
        cache_file.write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")
    return profile


def _extract_recent_champions(soup: BeautifulSoup, profile: dict):
    """Extrait les champions récents depuis la page summary (Recent 20 games played champions)."""
    # Chercher les <li> qui contiennent une image de champion
    for li in soup.select("li"):
        img = li.select_one("img[src*='champion'][alt]")
        if not img:
            continue
        champ_name = img.get("alt", "").strip()
        if not champ_name or len(champ_name) > 25 or champ_name.startswith("mastery"):
            continue

        text = li.get_text(separator=" ", strip=True)
        wr_m = re.search(r"([\d.]+)\s*%", text)
        games_m = re.search(r"(\d+)\s*(?:Games?|games?|G\b)", text)
        kda_m = re.search(r"([\d.]+)\s*:\s*1\s*KDA", text)

        profile["most_played"].append({
            "champion": champ_name,
            "win_rate": float(wr_m.group(1)) if wr_m else None,
            "games": int(games_m.group(1)) if games_m else None,
            "kda": kda_m.group(1) + ":1" if kda_m else None,
        })


def _extract_champion_table(soup: BeautifulSoup, profile: dict):
    """Extrait les stats champions depuis la page /champions.
    Structure table: # | Champion | Played (NW NL WR%) | KDA | ...
    Le format Played est ex: '1W1L50%' (1 win, 1 loss, 50% WR).
    Les sous-lignes (vs ChampName) ont cell[0] vide -> on les ignore.
    """
    tables = soup.select("table")
    if not tables:
        return

    # Prendre la plus grande table (la première en général)
    main_table = max(tables, key=lambda t: len(t.select("tbody tr")))
    rows = main_table.select("tbody tr")

    for tr in rows:
        cells = tr.select("td")
        if len(cells) < 4:
            continue

        # cell[0] = rang (#), les sous-lignes matchup ont cell[0] vide ou "vs"
        rank_text = cells[0].get_text(strip=True)
        if not rank_text or not rank_text.isdigit():
            continue  # sous-ligne matchup ou ligne résumé ("All Champions" a '-')

        # cell[1] = nom du champion (ou image alt)
        champ_name = cells[1].get_text(strip=True)
        img = tr.select_one("img[src*='champion'][alt]")
        if img:
            champ_name = img.get("alt", champ_name).strip()
        if not champ_name or champ_name == "All Champions":
            continue

        # cell[2] = "Played" ex: "1W1L50%" ou "6W11L35%"
        played_text = cells[2].get_text(strip=True)
        wins_m = re.search(r"(\d+)W", played_text)
        losses_m = re.search(r"(\d+)L", played_text)
        wr_m = re.search(r"([\d.]+)%", played_text)

        wins = int(wins_m.group(1)) if wins_m else 0
        losses = int(losses_m.group(1)) if losses_m else 0
        total_games = wins + losses
        win_rate = float(wr_m.group(1)) if wr_m else (
            round(wins / total_games * 100, 1) if total_games > 0 else None
        )

        # cell[3] = KDA ex: "2.62:1  1.5 / 6.5 / 15.5 (65%)"
        # Utiliser separator=' ' pour ne pas fusionner ratio "X:1" avec kills
        kda_text = cells[3].get_text(separator=" ", strip=True)
        kda_ratio_m = re.search(r"([\d.]+)\s*:\s*1", kda_text)
        # Après le ratio ":1", extraire K / D / A
        kda_detail_m = None
        if kda_ratio_m:
            after_ratio = kda_text[kda_ratio_m.end():]
            kda_detail_m = re.search(r"([\d.]+)\s*/\s*([\d.]+)\s*/\s*([\d.]+)", after_ratio)
        if not kda_detail_m:
            kda_detail_m = re.search(r"([\d.]+)\s*/\s*([\d.]+)\s*/\s*([\d.]+)", kda_text)

        profile["most_played"].append({
            "champion": champ_name,
            "win_rate": win_rate,
            "games": total_games if total_games > 0 else None,
            "wins": wins,
            "losses": losses,
            "kda": (
                f"{kda_detail_m.group(1)}/{kda_detail_m.group(2)}/{kda_detail_m.group(3)}"
                if kda_detail_m
                else (kda_ratio_m.group(1) + ":1" if kda_ratio_m else None)
            ),
        })


# ---------------------------------------------------------------------------
# CLI (standalone)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Scraper OP.GG pour DraftForMe")
    parser.add_argument("--region", default="euw", choices=REGIONS)
    parser.add_argument("--champions", action="store_true", help="Stats des champions")
    parser.add_argument("--matchups", type=str, help="Matchups pour un champion (ex: 'Aatrox')")
    parser.add_argument("--player", type=str, help="Profil joueur (ex: 'Faker-KR1')")
    parser.add_argument("--role", default="", help="Rôle : top, jungle, middle, bottom, support")
    parser.add_argument("--tier", default="emerald_plus")
    parser.add_argument("-o", "--output", type=str, help="Fichier JSON de sortie")
    args = parser.parse_args()

    result = {}
    try:
        if args.champions:
            print(f"[*] Stats champions ({args.region}, tier={args.tier})...")
            result["champions"] = fetch_champion_stats(args.region, args.tier, args.role or "all")
            print(f"    -> {len(result['champions'])} champions")

        if args.matchups:
            print(f"[*] Matchups pour {args.matchups}...")
            result["matchups"] = fetch_champion_matchups(args.matchups, args.role, args.region)
            print(f"    -> {len(result['matchups'].get('all_matchups', []))} matchups")

        if args.player:
            print(f"[*] Profil de {args.player} ({args.region})...")
            result["player"] = fetch_player_profile(args.player, args.region)
            print(f"    -> {len(result['player'].get('most_played', []))} champions joués")

        if args.output and result:
            with open(args.output, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"\n[+] Données enregistrées dans {args.output}")
        elif result:
            print(json.dumps(result, indent=2, ensure_ascii=True))
    finally:
        close_driver()
