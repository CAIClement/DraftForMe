"""Test helpers for ml.win: synthetic match databases and a small seed.sql."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

import numpy as np

from ml.collect.store import MATCH_COLUMNS, SCHEMA
from ml.win.baselines import ChampionPrior, EngineData
from ml.win.data import PICK_COLUMNS

TIERS = ("IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER")


def neutral_prior() -> ChampionPrior:
    """A prior with no data at all: every champion is unknown, so its six features are always 0."""
    return ChampionPrior(EngineData({}, {}, {}, {}))


def random_drafts(count: int, rng: np.random.Generator, champions_per_role: int = 6) -> np.ndarray:
    """Drafts with no champion twice in a match: role r draws from ids (r+1)*100+1 .. (r+1)*100+champions_per_role."""
    drafts = np.zeros((count, 10), dtype=np.int64)
    for role in range(5):
        pool = np.arange(1, champions_per_role + 1) + (role + 1) * 100
        for row in range(count):
            blue, red = rng.choice(pool, size=2, replace=False)
            drafts[row, role] = blue
            drafts[row, 5 + role] = red
    return drafts


def write_database(
    path: Path,
    drafts: np.ndarray,
    labels: np.ndarray,
    *,
    patch: str = "16.18",
    matches_per_player: int = 5,
    pending_ids: int = 0,
) -> list[str]:
    """Writes a collection database with the real schema. Seed players cycle through the ten tiers.

    `pending_ids` adds that many extra rows to `match_ids` only, with no matching `matches` row,
    ids that cannot collide with the downloaded ones (`EUW1_pending_{i}`), status `pending`, and
    the seed puuid of an existing player: simulating match ids that were listed but never downloaded.
    """
    match_ids = [f"EUW1_{index}" for index in range(len(drafts))]
    match_rows = []
    id_rows = []
    for index, (match_id, draft, label) in enumerate(zip(match_ids, drafts, labels)):
        player = index // matches_per_player
        tier = TIERS[player % len(TIERS)]
        values = {
            "match_id": match_id,
            "patch": patch,
            "game_version": f"{patch}.1.1",
            "game_creation": 1_789_000_000_000 + index,
            "game_duration": 1800,
            "seed_tier": tier,
            "blue_bans": "[]",
            "red_bans": "[]",
            "blue_win": int(label),
        }
        values.update({column: int(champion) for column, champion in zip(PICK_COLUMNS, draft)})
        match_rows.append([values[column] for column in MATCH_COLUMNS] + [b""])
        id_rows.append((match_id, tier, f"player-{player}", index % matches_per_player, "done", 1))

    pending_tier = TIERS[0]
    pending_puuid = "player-0"
    for i in range(pending_ids):
        id_rows.append((f"EUW1_pending_{i}", pending_tier, pending_puuid, matches_per_player + i, "pending", 0))

    columns = ", ".join((*MATCH_COLUMNS, "raw_gzip"))
    placeholders = ", ".join("?" for _ in range(len(MATCH_COLUMNS) + 1))
    with closing(sqlite3.connect(str(path))) as db:
        db.executescript(SCHEMA)
        db.executemany(f"insert into matches ({columns}) values ({placeholders})", match_rows)
        db.executemany(
            "insert into match_ids (match_id, seed_tier, seed_puuid, position, status, attempts) "
            "values (?, ?, ?, ?, ?, ?)",
            id_rows,
        )
        db.commit()
    return match_ids


def write_seed_sql(
    path: Path,
    champions: dict[str, int],
    stats: list[tuple[str, str, float]],
    relations: list[tuple[str, str, str]] = (),
) -> Path:
    """Writes a seed.sql in the exact statement format of supabase/seed.sql.

    `stats` rows are (slug, role, win_rate); `relations` rows are (champion, countered_by, role).
    """
    lines = [
        f"insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) "
        f"values ('{slug}', '{key}', '{slug}', '{slug.title()}', 'https://example.test/{slug}.png', '{{\"Mage\"}}', '16.3.1') "
        f"on conflict (id) do update set name = excluded.name;"
        for slug, key in champions.items()
    ]
    lines += [
        f"insert into public.champion_stats (champion_id, role, region, tier, win_rate, pick_rate, ban_rate, games, source) "
        f"values ('{slug}', '{role}', 'euw', 'emerald_plus', {win_rate}, 5.0, 1.0, 1000, 'opgg_cache') "
        f"on conflict (champion_id, role, region, tier, source) do update set win_rate = excluded.win_rate;"
        for slug, role, win_rate in stats
    ]
    lines += [
        f"insert into public.counter_relations (champion_id, countered_by_champion_id, role, source) "
        f"values ('{slug}', '{countered_by}', '{role}', 'opgg_cache') "
        f"on conflict (champion_id, countered_by_champion_id, role, source) do update set fetched_at = now();"
        for slug, countered_by, role in relations
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path
