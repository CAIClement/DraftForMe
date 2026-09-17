"""The collection loop: draw players, list their matches, download and store them."""

from __future__ import annotations

import random
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from ml.collect.extract import InvalidMatch, extract_match, patch_key, patch_of
from ml.collect.riot_client import NotFoundError, RiotServerError
from ml.collect.sampling import TIERS, divisions_for, draw_batch, tier_quotas
from ml.collect.store import Store


class PatchMismatchError(RuntimeError):
    """The store already holds matches from a patch other than the one being collected."""


class MatchSource(Protocol):
    def league_page(self, tier: str, division: str, page: int) -> list[dict[str, Any]]: ...

    def resolve_puuid(self, entry: dict[str, Any]) -> str: ...

    def match_ids(self, puuid: str, count: int = 100) -> list[str]: ...

    def match(self, match_id: str) -> dict[str, Any]: ...


@dataclass
class Summary:
    quotas: dict[str, int]
    collected: dict[str, int]
    exhausted: list[str] = field(default_factory=list)

    def short_tiers(self) -> list[str]:
        return [tier for tier, quota in self.quotas.items() if self.collected.get(tier, 0) < quota]


def entry_key(entry: dict[str, Any]) -> str:
    """How a league entry is recognised before its puuid is known."""
    return str(entry.get("puuid") or entry.get("summonerId") or "")


def collect(
    source: MatchSource,
    store: Store,
    *,
    target: int,
    patch: str,
    rng: random.Random,
    log: Callable[[str], None] = print,
) -> Summary:
    """Runs until every tier reaches its quota or runs out of players.

    Every step is committed to `store` as it happens, so stopping at any point and
    calling this again resumes where it left off.
    """
    other = store.patches() - {patch}
    if other:
        raise PatchMismatchError(", ".join(sorted(other)))
    store.retry_failed_matches()

    quotas = tier_quotas(target)
    exhausted: set[str] = set()

    while True:
        collected = store.matches_per_tier()
        open_tiers = [tier for tier in TIERS if tier not in exhausted and collected.get(tier, 0) < quotas[tier]]
        if not open_tiers:
            break
        for tier in open_tiers:
            if not _advance_tier(source, store, tier, quotas[tier], patch, rng, log):
                exhausted.add(tier)
                count = store.matches_per_tier().get(tier, 0)
                log(f"{tier} : plus aucun joueur à tirer ({count} / {quotas[tier]})")

    return Summary(
        quotas=quotas,
        collected=store.matches_per_tier(),
        exhausted=[tier for tier in TIERS if tier in exhausted],
    )


def _advance_tier(
    source: MatchSource,
    store: Store,
    tier: str,
    quota: int,
    patch: str,
    rng: random.Random,
    log: Callable[[str], None],
) -> bool:
    """Makes one unit of progress on a tier. Returns False when the tier can make none."""
    if _download_pending(source, store, tier, quota, patch):
        log(f"{tier} : {store.matches_per_tier().get(tier, 0)} / {quota}")
        return True

    pending_players = store.pending_players(tier)
    if pending_players:
        _list_matches(source, store, pending_players[0], tier)
        return True

    return _draw_players(source, store, tier, rng, log)


def _download_pending(source: MatchSource, store: Store, tier: str, quota: int, patch: str) -> bool:
    processed = False
    while store.matches_per_tier().get(tier, 0) < quota:
        pending = store.next_pending_match(tier)
        if pending is None:
            return processed
        processed = True
        match_id = pending["match_id"]

        try:
            raw = source.match(match_id)
        except NotFoundError:
            store.mark_match(match_id, "not_found")
            continue
        except RiotServerError:
            store.mark_match(match_id, "failed")
            continue

        try:
            match_patch = patch_of((raw.get("info") or {}).get("gameVersion", ""))
        except (ValueError, AttributeError, TypeError):
            store.mark_match(match_id, "skipped_invalid")
            continue

        if match_patch != patch:
            store.mark_match(match_id, "skipped_patch")
            if patch_key(match_patch) < patch_key(patch):
                # Ids are newest first: everything after an older-patch match is older still.
                store.skip_older_matches(pending["seed_puuid"], pending["position"])
            continue

        try:
            row = extract_match(raw, seed_tier=tier)
        except InvalidMatch:
            store.mark_match(match_id, "skipped_invalid")
            continue

        if row["match_id"] != match_id:
            # The payload's own id disagrees with the id it was requested under: saving it
            # would leave the requested id pending forever (an endless download loop) or
            # insert a row under the wrong id, so the requested id is skipped instead.
            store.mark_match(match_id, "skipped_invalid")
            continue

        store.save_match(row, raw)
    return processed


def _list_matches(source: MatchSource, store: Store, puuid: str, tier: str) -> None:
    try:
        match_ids = source.match_ids(puuid)
    except NotFoundError:
        store.mark_player(puuid, "failed")
        return
    store.add_match_ids(match_ids, seed_tier=tier, seed_puuid=puuid)
    store.mark_player(puuid, "done")


def _draw_players(
    source: MatchSource,
    store: Store,
    tier: str,
    rng: random.Random,
    log: Callable[[str], None],
) -> bool:
    for division in _divisions_in_rotation(store, tier, rng):
        page, _ = store.cursor(tier, division)
        entries = source.league_page(tier, division, page)
        if not entries:
            store.advance_cursor(tier, division, exhausted=True)
            continue

        by_key = {key: entry for entry in entries if (key := entry_key(entry))}
        chosen = draw_batch(by_key.keys(), store.known_player_keys(), rng)
        if not chosen:
            # Every player on this page is already known: move on to the next page.
            store.advance_cursor(tier, division, exhausted=False)
            return True

        added = 0
        for key in chosen:
            entry = by_key[key]
            try:
                puuid = source.resolve_puuid(entry)
            except NotFoundError:
                # Recorded as failed so the same unresolvable player is never drawn again.
                store.add_player(f"unresolved:{key}", tier, division, summoner_id=key, ids_status="failed")
                continue
            if store.add_player(puuid, tier, division, summoner_id=entry.get("summonerId")):
                added += 1
        log(f"{tier} {division} : {added} joueurs tirés (page {page})")
        return True

    return False


def _divisions_in_rotation(store: Store, tier: str, rng: random.Random) -> list[str]:
    """Divisions still open, least-consumed first, ties broken at random."""
    open_divisions = []
    for division in divisions_for(tier):
        page, exhausted = store.cursor(tier, division)
        if not exhausted:
            open_divisions.append((page, rng.random(), division))
    return [division for _, _, division in sorted(open_divisions)]
