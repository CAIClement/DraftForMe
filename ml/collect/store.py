"""SQLite persistence. Every piece of resume state lives here, so a killed run loses nothing."""

from __future__ import annotations

import gzip
import json
import sqlite3
from pathlib import Path
from typing import Any

MATCH_COLUMNS = (
    "match_id",
    "patch",
    "game_version",
    "game_creation",
    "game_duration",
    "seed_tier",
    "blue_top",
    "blue_jungle",
    "blue_mid",
    "blue_adc",
    "blue_support",
    "red_top",
    "red_jungle",
    "red_mid",
    "red_adc",
    "red_support",
    "blue_bans",
    "red_bans",
    "blue_win",
)

SCHEMA = """
create table if not exists players (
    puuid text primary key,
    summoner_id text,
    tier text not null,
    division text not null,
    sampled_at text not null default (datetime('now')),
    ids_status text not null default 'pending'
);

create table if not exists match_ids (
    match_id text primary key,
    seed_tier text not null,
    seed_puuid text not null,
    position integer not null,
    status text not null default 'pending',
    attempts integer not null default 0
);

create table if not exists matches (
    match_id text primary key,
    patch text not null,
    game_version text not null,
    game_creation integer not null,
    game_duration integer not null,
    seed_tier text not null,
    blue_top integer not null,
    blue_jungle integer not null,
    blue_mid integer not null,
    blue_adc integer not null,
    blue_support integer not null,
    red_top integer not null,
    red_jungle integer not null,
    red_mid integer not null,
    red_adc integer not null,
    red_support integer not null,
    blue_bans text not null,
    red_bans text not null,
    blue_win integer not null,
    raw_gzip blob not null
);

create table if not exists league_cursors (
    tier text not null,
    division text not null,
    next_page integer not null default 1,
    exhausted integer not null default 0,
    primary key (tier, division)
);

create index if not exists match_ids_pending_idx on match_ids (seed_tier, status, seed_puuid, position);
create index if not exists matches_tier_idx on matches (seed_tier);
"""


class Store:
    def __init__(self, path: Path | str) -> None:
        self._db = sqlite3.connect(str(path))
        self._db.row_factory = sqlite3.Row
        if str(path) != ":memory:":
            self._db.execute("pragma journal_mode = wal")
        self._db.executescript(SCHEMA)

    def close(self) -> None:
        self._db.close()

    # --- players -------------------------------------------------------------

    def add_player(
        self,
        puuid: str,
        tier: str,
        division: str,
        summoner_id: str | None = None,
        ids_status: str = "pending",
    ) -> bool:
        with self._db:
            cursor = self._db.execute(
                "insert or ignore into players (puuid, summoner_id, tier, division, ids_status) values (?, ?, ?, ?, ?)",
                (puuid, summoner_id, tier, division, ids_status),
            )
        return cursor.rowcount == 1

    def known_player_keys(self) -> set[str]:
        rows = self._db.execute("select puuid, summoner_id from players").fetchall()
        return {key for row in rows for key in (row["puuid"], row["summoner_id"]) if key}

    def pending_players(self, tier: str) -> list[str]:
        rows = self._db.execute(
            "select puuid from players where tier = ? and ids_status = 'pending' order by sampled_at, puuid",
            (tier,),
        ).fetchall()
        return [row["puuid"] for row in rows]

    def mark_player(self, puuid: str, status: str) -> None:
        with self._db:
            self._db.execute("update players set ids_status = ? where puuid = ?", (status, puuid))

    # --- match ids -----------------------------------------------------------

    def add_match_ids(self, match_ids: list[str], seed_tier: str, seed_puuid: str) -> int:
        with self._db:
            before = self._db.total_changes
            self._db.executemany(
                "insert or ignore into match_ids (match_id, seed_tier, seed_puuid, position) values (?, ?, ?, ?)",
                [(match_id, seed_tier, seed_puuid, position) for position, match_id in enumerate(match_ids)],
            )
            return self._db.total_changes - before

    def next_pending_match(self, tier: str) -> sqlite3.Row | None:
        # Per player, position 0 is the newest match: newest first is what lets an
        # older patch end collection for that player.
        return self._db.execute(
            "select match_id, seed_puuid, position from match_ids "
            "where seed_tier = ? and status = 'pending' order by seed_puuid, position limit 1",
            (tier,),
        ).fetchone()

    def mark_match(self, match_id: str, status: str) -> None:
        with self._db:
            self._db.execute(
                "update match_ids set status = ?, attempts = attempts + 1 where match_id = ?",
                (status, match_id),
            )

    def skip_older_matches(self, seed_puuid: str, after_position: int) -> int:
        with self._db:
            cursor = self._db.execute(
                "update match_ids set status = 'skipped_patch' "
                "where seed_puuid = ? and position > ? and status = 'pending'",
                (seed_puuid, after_position),
            )
        return cursor.rowcount

    def match_status(self, match_id: str) -> str | None:
        row = self._db.execute("select status from match_ids where match_id = ?", (match_id,)).fetchone()
        return None if row is None else row["status"]

    # --- matches -------------------------------------------------------------

    def save_match(self, row: dict[str, Any], raw: dict[str, Any]) -> None:
        columns = ", ".join((*MATCH_COLUMNS, "raw_gzip"))
        placeholders = ", ".join("?" for _ in range(len(MATCH_COLUMNS) + 1))
        values = [row[column] for column in MATCH_COLUMNS]
        values.append(gzip.compress(json.dumps(raw).encode("utf-8")))
        with self._db:
            self._db.execute(f"insert or ignore into matches ({columns}) values ({placeholders})", values)
            self._db.execute(
                "update match_ids set status = 'done', attempts = attempts + 1 where match_id = ?",
                (row["match_id"],),
            )

    def load_raw(self, match_id: str) -> dict[str, Any] | None:
        row = self._db.execute("select raw_gzip from matches where match_id = ?", (match_id,)).fetchone()
        return None if row is None else json.loads(gzip.decompress(row["raw_gzip"]).decode("utf-8"))

    def matches_per_tier(self) -> dict[str, int]:
        rows = self._db.execute("select seed_tier, count(*) as n from matches group by seed_tier").fetchall()
        return {row["seed_tier"]: row["n"] for row in rows}

    # --- league cursors ------------------------------------------------------

    def cursor(self, tier: str, division: str) -> tuple[int, bool]:
        with self._db:
            self._db.execute(
                "insert or ignore into league_cursors (tier, division) values (?, ?)",
                (tier, division),
            )
        row = self._db.execute(
            "select next_page, exhausted from league_cursors where tier = ? and division = ?",
            (tier, division),
        ).fetchone()
        return int(row["next_page"]), bool(row["exhausted"])

    def advance_cursor(self, tier: str, division: str, *, exhausted: bool) -> None:
        self.cursor(tier, division)
        with self._db:
            if exhausted:
                self._db.execute(
                    "update league_cursors set exhausted = 1 where tier = ? and division = ?",
                    (tier, division),
                )
            else:
                self._db.execute(
                    "update league_cursors set next_page = next_page + 1 where tier = ? and division = ?",
                    (tier, division),
                )
