"""Command line: python -m ml.collect.run --target 30000 [--patch 16.18] [--seed 42]"""

from __future__ import annotations

import argparse
import os
import random
import sys
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

import httpx

from ml.collect.collect import collect
from ml.collect.extract import patch_of
from ml.collect.riot_client import KeyExpiredError, RiotClient, RiotServerError
from ml.collect.store import Store
from ml.paths import MATCHES_DB_PATH

DDRAGON_VERSIONS_URL = "https://ddragon.leagueoflegends.com/api/versions.json"

MISSING_KEY_MESSAGE = (
    "RIOT_API_KEY n'est pas défini.\n"
    "Récupère ta clé sur https://developer.riotgames.com puis, dans PowerShell :\n"
    '  $env:RIOT_API_KEY = "RGAPI-..."\n'
    "et relance la commande. La clé n'est jamais écrite sur le disque."
)

EXPIRED_KEY_MESSAGE = (
    "Clé Riot expirée ou invalide.\n"
    "Régénère-la sur https://developer.riotgames.com, redéfinis RIOT_API_KEY et relance :\n"
    "la collecte reprendra là où elle s'est arrêtée."
)

INTERRUPTED_MESSAGE = "Interrompu. Rien n'est perdu : relance la même commande pour reprendre."

# A match that keeps failing is marked and skipped inside the loop. A league listing
# that keeps failing has no single item to skip, so the run stops here instead of
# with a traceback; everything done so far is already committed.
SERVER_ERROR_MESSAGE = (
    "L'API Riot renvoie une erreur serveur persistante.\n"
    "Rien n'est perdu : relance la même commande plus tard pour reprendre."
)


def detect_patch(fetch_json: Callable[[str], Any] | None = None) -> str:
    """Current patch from the newest Data Dragon version, which needs no key."""
    fetch = fetch_json or (lambda url: httpx.get(url, timeout=30.0).json())
    versions = fetch(DDRAGON_VERSIONS_URL)
    return patch_of(str(versions[0]))


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collecte des parties classées EUW via l'API Riot.")
    parser.add_argument("--target", type=int, default=30000, help="nombre total de parties visé")
    parser.add_argument("--patch", default=None, help="patch visé, major.minor (détecté si absent)")
    parser.add_argument("--seed", type=int, default=42, help="graine du tirage des joueurs")
    parser.add_argument("--db", default=str(MATCHES_DB_PATH), help="chemin de la base SQLite")
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    env: Mapping[str, str] = os.environ,
    client_factory: Callable[[str], Any] = RiotClient,
    patch_detector: Callable[[], str] = detect_patch,
    out: Callable[[str], None] = print,
) -> int:
    args = parse_args(argv)

    api_key = env.get("RIOT_API_KEY")
    if not api_key:
        out(MISSING_KEY_MESSAGE)
        return 2

    patch = args.patch or patch_detector()
    out(f"Patch visé : {patch}")

    Path(args.db).parent.mkdir(parents=True, exist_ok=True)
    client = client_factory(api_key)
    store = Store(args.db)
    try:
        summary = collect(client, store, target=args.target, patch=patch, rng=random.Random(args.seed), log=out)
    except KeyExpiredError:
        out(EXPIRED_KEY_MESSAGE)
        return 3
    except RiotServerError:
        out(SERVER_ERROR_MESSAGE)
        return 4
    except KeyboardInterrupt:
        out(INTERRUPTED_MESSAGE)
        return 130
    finally:
        store.close()
        client.close()

    out("Bilan :")
    for tier, quota in summary.quotas.items():
        out(f"  {tier:<12} {summary.collected.get(tier, 0):>6} / {quota}")
    short = summary.short_tiers()
    if short:
        out("Déséquilibre : ces rangs n'ont pas atteint leur quota : " + ", ".join(short))
    return 0


if __name__ == "__main__":
    sys.exit(main())
