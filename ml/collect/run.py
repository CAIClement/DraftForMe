"""Command line: python -m ml.collect.run --target 30000 [--patch 16.18] [--seed 42]

Exit codes:
  0   finished
  2   missing key or invalid arguments
  3   key expired or access refused
  4   persistent Riot server error
  5   patch mismatch or patch detection failed
  6   SQLite error
  130 interrupted
"""

from __future__ import annotations

import argparse
import os
import random
import sqlite3
import sys
from collections.abc import Callable, Mapping, Sequence
from pathlib import Path
from typing import Any

import httpx

from ml.collect.collect import PatchMismatchError, collect
from ml.collect.extract import patch_of
from ml.collect.riot_client import KeyExpiredError, RiotClient, RiotServerError
from ml.collect.sampling import TIERS
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
    "Clé Riot expirée ou invalide, ou accès refusé à cet appel.\n"
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

PATCH_MISMATCH_MESSAGE = (
    "La base contient déjà des parties du patch {stored} (patch visé : {patch}).\n"
    "Pour terminer cette collecte, relance avec --patch {stored}.\n"
    "Pour collecter le patch {patch}, utilise une autre base, par exemple --db ml/artifacts/matches-{patch}.sqlite"
)

DETECTION_FAILED_MESSAGE = (
    "Impossible de détecter le patch via Data Dragon.\n"
    "Vérifie ta connexion et relance, ou précise le patch avec --patch 16.18."
)

DB_ERROR_MESSAGE = (
    "Erreur de la base SQLite : {error}\n"
    "Rien n'est perdu : relance la même commande. Si la base est dans un dossier synchronisé (OneDrive), "
    "utilise --db vers un dossier hors OneDrive."
)


def detect_patch(fetch_json: Callable[[str], Any] | None = None) -> str:
    """Current patch from the newest Data Dragon version, which needs no key."""

    def _default_fetch(url: str) -> Any:
        response = httpx.get(url, timeout=30.0)
        response.raise_for_status()
        return response.json()

    fetch = fetch_json or _default_fetch
    versions = fetch(DDRAGON_VERSIONS_URL)
    return patch_of(str(versions[0]))


def _patch_type(value: str) -> str:
    try:
        return patch_of(value)
    except ValueError:
        raise argparse.ArgumentTypeError(
            f"patch invalide : {value!r} (attendu major.minor, par exemple 16.18)"
        )


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Collecte des parties classées EUW via l'API Riot.")
    parser.add_argument("--target", type=int, default=30000, help="nombre total de parties visé")
    parser.add_argument("--patch", type=_patch_type, default=None, help="patch visé, major.minor (détecté si absent)")
    parser.add_argument("--seed", type=int, default=42, help="graine du tirage des joueurs")
    parser.add_argument("--db", default=str(MATCHES_DB_PATH), help="chemin de la base SQLite")
    args = parser.parse_args(argv)
    if args.target < len(TIERS):
        parser.error(f"--target doit valoir au moins {len(TIERS)} (une partie par rang)")
    return args


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

    try:
        return _run(args, api_key, client_factory, patch_detector, out)
    except KeyboardInterrupt:
        out(INTERRUPTED_MESSAGE)
        return 130


def _run(
    args: argparse.Namespace,
    api_key: str,
    client_factory: Callable[[str], Any],
    patch_detector: Callable[[], str],
    out: Callable[[str], None],
) -> int:
    try:
        patch = args.patch or patch_detector()
    except (httpx.HTTPError, ValueError, LookupError):
        out(DETECTION_FAILED_MESSAGE)
        return 5

    out(f"Patch visé : {patch}")

    Path(args.db).parent.mkdir(parents=True, exist_ok=True)

    try:
        store = Store(args.db)
    except sqlite3.OperationalError as error:
        out(DB_ERROR_MESSAGE.format(error=error))
        return 6

    try:
        client = client_factory(api_key)
        try:
            summary = collect(
                client, store, target=args.target, patch=patch, rng=random.Random(args.seed), log=out
            )
        finally:
            client.close()
    except KeyExpiredError as error:
        out(EXPIRED_KEY_MESSAGE)
        out(f"Détail : {error}")
        return 3
    except RiotServerError as error:
        out(SERVER_ERROR_MESSAGE)
        out(f"Détail : {error}")
        return 4
    except PatchMismatchError as error:
        out(PATCH_MISMATCH_MESSAGE.format(stored=str(error), patch=patch))
        return 5
    except sqlite3.OperationalError as error:
        out(DB_ERROR_MESSAGE.format(error=error))
        return 6
    finally:
        store.close()

    out("Bilan :")
    for tier, quota in summary.quotas.items():
        out(f"  {tier:<12} {summary.collected.get(tier, 0):>6} / {quota}")
    short = summary.short_tiers()
    if short:
        out("Déséquilibre : ces rangs n'ont pas atteint leur quota : " + ", ".join(short))
    return 0


if __name__ == "__main__":
    sys.exit(main())
