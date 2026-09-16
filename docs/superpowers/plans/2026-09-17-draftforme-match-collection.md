# DraftForMe Match Collection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect ranked EUW matches from the Riot API, across all ranks in equal shares and for the current patch only, into a resumable local SQLite dataset.

**Architecture:** A package `ml/collect/` of small modules, each testable without the network: `extract.py` and `sampling.py` are pure; `store.py` owns SQLite and all resume state; `riot_client.py` owns HTTP, routing, rate limiting and error mapping; `collect.py` orchestrates the three phases against a `MatchSource` protocol so it can be tested with a fake; `run.py` is only the command line.

**Tech Stack:** Python 3.11, `httpx` 0.28 (with `httpx.MockTransport` in tests), `sqlite3` and `gzip` from the standard library, pytest 9.

**Spec:** `docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md`

**One deviation from the spec:** the spec puts orchestration in `run.py`. This plan splits it into `collect.py` (orchestration) and `run.py` (command line only), so the collection logic can be tested with a fake source rather than through argument parsing and console output. Task 10 updates the spec to match.

---

## Conventions for every task

- Run all commands from the repository root: `C:\Users\cleme\OneDrive\Bureau\Projet perso\DraftForMe`.
- Run tests with `python -m pytest test/ml -q`. A single file: `python -m pytest test/ml/test_collect_extract.py -q`.
- Tests live flat in `test/ml/`, named `test_collect_*.py`, matching the existing `test_dataset.py`, `test_features.py`, `test_predict.py`.
- `test/ml/` has no `__init__.py`, so pytest puts it on `sys.path`: the shared helper `test/ml/collect_fixtures.py` is imported as `from collect_fixtures import ...`.
- Code, comments and identifiers are in English, like the rest of `ml/`. Messages printed to the person running the command are in French.
- **Never print a non-cp1252 character** (no arrows, no typographic quotes) in command output: the Windows console can raise `UnicodeEncodeError` on them. French accents are fine.
- The whole suite must pass at every commit.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `ml/collect/__init__.py` | Package marker |
| `ml/collect/extract.py` | Raw match to compact row; match validity; patch parsing |
| `ml/collect/sampling.py` | Tiers, divisions, per-tier quotas, batch drawing |
| `ml/collect/store.py` | SQLite schema, persistence, resume state |
| `ml/collect/riot_client.py` | Rate limiter, HTTP client, Riot error mapping, endpoints |
| `ml/collect/collect.py` | The three-phase collection loop |
| `ml/collect/run.py` | Command line, patch detection, key check, final summary |
| `test/ml/collect_fixtures.py` | Match builder and fake Riot source shared by tests |
| `test/ml/test_collect_extract.py` | |
| `test/ml/test_collect_sampling.py` | |
| `test/ml/test_collect_store.py` | |
| `test/ml/test_collect_rate_limiter.py` | |
| `test/ml/test_collect_riot_client.py` | |
| `test/ml/test_collect_collect.py` | |
| `test/ml/test_collect_run.py` | |

**Modified**

| File | Change |
| --- | --- |
| `ml/paths.py` | Add `MATCHES_DB_PATH` |
| `ml/requirements.txt` | Add `httpx` |
| `.gitignore` | Ignore the match databases and their journals |
| `docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md` | Record the `collect.py` split (Task 10) |

---

## Task 1: Scaffolding

**Files:**
- Create: `ml/collect/__init__.py`
- Modify: `ml/paths.py`, `ml/requirements.txt`, `.gitignore`

- [ ] **Step 1: Create the package**

Create `ml/collect/__init__.py`:

```python
"""Collection of ranked matches from the Riot API into a local dataset."""
```

- [ ] **Step 2: Add the database path**

In `ml/paths.py`, after the `METADATA_PATH` line, add:

```python
MATCHES_DB_PATH = ARTIFACT_DIR / "matches.sqlite"
```

- [ ] **Step 3: Declare the HTTP dependency**

In `ml/requirements.txt`, add this line after `gradio>=4.44.0`:

```
httpx>=0.28.1
```

- [ ] **Step 4: Ignore the databases**

Append to `.gitignore`:

```
ml/artifacts/matches*.sqlite
ml/artifacts/matches*.sqlite-journal
ml/artifacts/matches*.sqlite-wal
ml/artifacts/matches*.sqlite-shm
```

- [ ] **Step 5: Verify**

Run: `python -c "import ml.collect; from ml.paths import MATCHES_DB_PATH; print(MATCHES_DB_PATH.name)"`
Expected: `matches.sqlite`

Run: `git check-ignore ml/artifacts/matches.sqlite ml/artifacts/matches-smoke.sqlite-wal`
Expected: both paths printed.

Run: `python -m pytest test/ml -q`
Expected: `7 passed`

- [ ] **Step 6: Commit**

```bash
git add ml/collect/__init__.py ml/paths.py ml/requirements.txt .gitignore
git commit -m "chore: scaffold the match collection package"
```

---

## Task 2: Match extraction

**Files:**
- Create: `ml/collect/extract.py`, `test/ml/collect_fixtures.py`, `test/ml/test_collect_extract.py`

- [ ] **Step 1: Write the match builder shared by tests**

Create `test/ml/collect_fixtures.py`:

```python
"""Test helpers for ml.collect: a Riot match builder and, later, a fake source."""

from __future__ import annotations

from typing import Any

PATCH = "16.18"
POSITIONS = ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")


def make_match(
    match_id: str = "EUW1_1",
    game_version: str = "16.18.712.1234",
    queue_id: int = 420,
    blue_win: bool = True,
    remake: bool = False,
    blue_champions: tuple[int, ...] = (266, 64, 103, 222, 412),
    red_champions: tuple[int, ...] = (24, 76, 238, 51, 117),
) -> dict[str, Any]:
    """Builds a minimal Riot match-v5 response with only the fields the collector reads.

    Participants are ordered blue TOP, JUNGLE, MIDDLE, BOTTOM, UTILITY, then red in the
    same order, so index 1 is blue JUNGLE and index 3 is blue BOTTOM.
    """
    participants = []
    for team_id, champions, win in ((100, blue_champions, blue_win), (200, red_champions, not blue_win)):
        for position, champion_id in zip(POSITIONS, champions):
            participants.append(
                {
                    "puuid": f"player-{team_id}-{position}",
                    "teamId": team_id,
                    "teamPosition": position,
                    "championId": champion_id,
                    "win": win,
                    "gameEndedInEarlySurrender": remake,
                }
            )

    return {
        "metadata": {"matchId": match_id, "participants": [p["puuid"] for p in participants]},
        "info": {
            "queueId": queue_id,
            "gameVersion": game_version,
            "gameCreation": 1_789_000_000_000,
            "gameDuration": 1800,
            "participants": participants,
            "teams": [
                {
                    "teamId": 100,
                    "win": blue_win,
                    "bans": [{"championId": 157, "pickTurn": 1}, {"championId": -1, "pickTurn": 3}],
                },
                {"teamId": 200, "win": not blue_win, "bans": [{"championId": 350, "pickTurn": 2}]},
            ],
        },
    }
```

- [ ] **Step 2: Write the failing tests**

Create `test/ml/test_collect_extract.py`:

```python
import json

import pytest

from collect_fixtures import make_match
from ml.collect.extract import InvalidMatch, extract_match, patch_key, patch_of

POSITIONS = ("top", "jungle", "mid", "adc", "support")


def test_extracts_the_draft_by_team_and_position():
    row = extract_match(make_match(match_id="EUW1_42", blue_win=False), seed_tier="GOLD")

    assert row["match_id"] == "EUW1_42"
    assert row["patch"] == "16.18"
    assert row["game_version"] == "16.18.712.1234"
    assert row["seed_tier"] == "GOLD"
    assert [row[f"blue_{position}"] for position in POSITIONS] == [266, 64, 103, 222, 412]
    assert [row[f"red_{position}"] for position in POSITIONS] == [24, 76, 238, 51, 117]
    assert row["blue_win"] == 0


def test_keeps_real_bans_and_drops_empty_ban_slots():
    row = extract_match(make_match(), seed_tier="GOLD")

    assert json.loads(row["blue_bans"]) == [157]
    assert json.loads(row["red_bans"]) == [350]


def test_rejects_a_queue_other_than_ranked_solo():
    with pytest.raises(InvalidMatch, match="ranked solo"):
        extract_match(make_match(queue_id=440), seed_tier="GOLD")


def test_rejects_a_remake():
    with pytest.raises(InvalidMatch, match="remake"):
        extract_match(make_match(remake=True), seed_tier="GOLD")


def test_rejects_a_participant_without_a_position():
    raw = make_match()
    raw["info"]["participants"][3]["teamPosition"] = ""

    with pytest.raises(InvalidMatch, match="missing position"):
        extract_match(raw, seed_tier="GOLD")


def test_rejects_a_position_played_twice_in_one_team():
    raw = make_match()
    raw["info"]["participants"][1]["teamPosition"] = "TOP"

    with pytest.raises(InvalidMatch, match="duplicated position"):
        extract_match(raw, seed_tier="GOLD")


def test_patch_of_keeps_major_and_minor():
    assert patch_of("16.18.712.1234") == "16.18"
    assert patch_of("16.3.1") == "16.3"

    with pytest.raises(ValueError):
        patch_of("not-a-version")


def test_patch_key_orders_patches_numerically_not_alphabetically():
    assert patch_key("16.9") < patch_key("16.10")
```

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_extract.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.extract'`

- [ ] **Step 4: Implement**

Create `ml/collect/extract.py`:

```python
"""Turns a raw Riot match into the compact row stored for training."""

from __future__ import annotations

import json
from typing import Any

RANKED_SOLO_QUEUE = 420
BLUE_TEAM = 100
RED_TEAM = 200
POSITION_ORDER = ("top", "jungle", "mid", "adc", "support")
RIOT_POSITIONS = {
    "TOP": "top",
    "JUNGLE": "jungle",
    "MIDDLE": "mid",
    "BOTTOM": "adc",
    "UTILITY": "support",
}


class InvalidMatch(ValueError):
    """The match must not enter the dataset. The message names the reason."""


def patch_of(game_version: str) -> str:
    """"16.18.712.1234" -> "16.18"."""
    parts = game_version.split(".")
    if len(parts) < 2 or not parts[0].isdigit() or not parts[1].isdigit():
        raise ValueError(f"unrecognised game version: {game_version!r}")
    return f"{int(parts[0])}.{int(parts[1])}"


def patch_key(patch: str) -> tuple[int, int]:
    """Numeric ordering key: "16.9" sorts before "16.10"."""
    major, minor = patch.split(".")
    return int(major), int(minor)


def extract_match(raw: dict[str, Any], seed_tier: str) -> dict[str, Any]:
    """Returns the row for the `matches` table, or raises InvalidMatch."""
    info = raw.get("info") or {}

    if info.get("queueId") != RANKED_SOLO_QUEUE:
        raise InvalidMatch("not ranked solo/duo")

    participants = info.get("participants") or []
    if any(participant.get("gameEndedInEarlySurrender") for participant in participants):
        raise InvalidMatch("remake")
    if len(participants) != 10:
        raise InvalidMatch("expected 10 participants")

    lineup: dict[int, dict[str, int]] = {BLUE_TEAM: {}, RED_TEAM: {}}
    for participant in participants:
        team_id = participant.get("teamId")
        if team_id not in lineup:
            raise InvalidMatch("unknown team")
        position = RIOT_POSITIONS.get(participant.get("teamPosition") or "")
        if position is None:
            raise InvalidMatch("missing position")
        if position in lineup[team_id]:
            raise InvalidMatch("duplicated position")
        lineup[team_id][position] = int(participant["championId"])

    if any(len(team) != len(POSITION_ORDER) for team in lineup.values()):
        raise InvalidMatch("incomplete team")

    teams = {team.get("teamId"): team for team in info.get("teams") or []}
    if set(teams) != {BLUE_TEAM, RED_TEAM}:
        raise InvalidMatch("expected two teams")

    row: dict[str, Any] = {
        "match_id": raw["metadata"]["matchId"],
        "patch": patch_of(info["gameVersion"]),
        "game_version": info["gameVersion"],
        "game_creation": int(info["gameCreation"]),
        "game_duration": int(info["gameDuration"]),
        "seed_tier": seed_tier,
    }
    for side, team_id in (("blue", BLUE_TEAM), ("red", RED_TEAM)):
        for position in POSITION_ORDER:
            row[f"{side}_{position}"] = lineup[team_id][position]
        # Riot fills an unused ban slot with -1.
        bans = [int(ban["championId"]) for ban in teams[team_id].get("bans") or [] if int(ban["championId"]) > 0]
        row[f"{side}_bans"] = json.dumps(bans)
    row["blue_win"] = 1 if teams[BLUE_TEAM].get("win") else 0
    return row
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest test/ml/test_collect_extract.py -q`
Expected: `8 passed`

Run: `python -m pytest test/ml -q`
Expected: `15 passed`

- [ ] **Step 6: Commit**

```bash
git add ml/collect/extract.py test/ml/collect_fixtures.py test/ml/test_collect_extract.py
git commit -m "feat: extract a compact draft row from a Riot match"
```

---

## Task 3: Sampling plan

**Files:**
- Create: `ml/collect/sampling.py`, `test/ml/test_collect_sampling.py`

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_collect_sampling.py`:

```python
import random

import pytest

from ml.collect.sampling import APEX_TIERS, BATCH_SIZE, DIVISIONS, TIERS, divisions_for, draw_batch, tier_quotas


def test_thirty_thousand_matches_split_evenly_across_ten_tiers():
    quotas = tier_quotas(30000)

    assert list(quotas) == list(TIERS)
    assert set(quotas.values()) == {3000}


def test_a_remainder_goes_to_the_lowest_tiers_first():
    quotas = tier_quotas(25)

    assert [quotas[tier] for tier in TIERS] == [3, 3, 3, 3, 3, 2, 2, 2, 2, 2]
    assert sum(quotas.values()) == 25


def test_a_target_smaller_than_the_tier_count_is_refused():
    with pytest.raises(ValueError):
        tier_quotas(9)


def test_apex_tiers_have_one_listing_and_the_others_four_divisions():
    assert APEX_TIERS == {"MASTER", "GRANDMASTER", "CHALLENGER"}
    assert divisions_for("CHALLENGER") == ("I",)
    assert divisions_for("GOLD") == DIVISIONS


def test_draw_batch_skips_known_players_and_caps_the_size():
    candidates = [f"p{n}" for n in range(120)]

    batch = draw_batch(candidates, known={"p0", "p1"}, rng=random.Random(7))

    assert len(batch) == BATCH_SIZE
    assert len(set(batch)) == BATCH_SIZE
    assert not {"p0", "p1"} & set(batch)


def test_draw_batch_is_reproducible_whatever_the_candidate_order():
    candidates = [f"p{n}" for n in range(120)]

    first = draw_batch(candidates, known=set(), rng=random.Random(7))
    second = draw_batch(list(reversed(candidates)), known=set(), rng=random.Random(7))

    assert first == second
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_sampling.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.sampling'`

- [ ] **Step 3: Implement**

Create `ml/collect/sampling.py`:

```python
"""Which players to draw, and how many matches each rank should contribute."""

from __future__ import annotations

import random
from collections.abc import Iterable

TIERS = (
    "IRON",
    "BRONZE",
    "SILVER",
    "GOLD",
    "PLATINUM",
    "EMERALD",
    "DIAMOND",
    "MASTER",
    "GRANDMASTER",
    "CHALLENGER",
)
APEX_TIERS = frozenset({"MASTER", "GRANDMASTER", "CHALLENGER"})
DIVISIONS = ("I", "II", "III", "IV")
BATCH_SIZE = 50


def tier_quotas(target: int) -> dict[str, int]:
    """Equal share of `target` matches per tier; any remainder goes to the lowest tiers."""
    if target < len(TIERS):
        raise ValueError(f"target must be at least {len(TIERS)} so every tier gets a match")
    base, remainder = divmod(target, len(TIERS))
    return {tier: base + (1 if index < remainder else 0) for index, tier in enumerate(TIERS)}


def divisions_for(tier: str) -> tuple[str, ...]:
    """Apex tiers are a single league listing, represented as division "I"."""
    return ("I",) if tier in APEX_TIERS else DIVISIONS


def draw_batch(
    candidates: Iterable[str],
    known: set[str],
    rng: random.Random,
    size: int = BATCH_SIZE,
) -> list[str]:
    """Up to `size` candidates not already known, drawn at random.

    Sorted before shuffling so that a given seed draws the same players whatever
    order the API returned them in.
    """
    fresh = sorted(set(candidates) - known)
    rng.shuffle(fresh)
    return fresh[:size]
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_collect_sampling.py -q`
Expected: `6 passed`

Run: `python -m pytest test/ml -q`
Expected: `21 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/collect/sampling.py test/ml/test_collect_sampling.py
git commit -m "feat: plan equal per-rank quotas and seeded player draws"
```

---

## Task 4: SQLite store

**Files:**
- Create: `ml/collect/store.py`, `test/ml/test_collect_store.py`

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_collect_store.py`:

```python
from collect_fixtures import make_match
from ml.collect.extract import extract_match
from ml.collect.store import Store


def test_players_are_added_once_and_known_by_puuid_and_summoner_id():
    store = Store(":memory:")

    assert store.add_player("puuid-1", "GOLD", "II", summoner_id="sum-1") is True
    assert store.add_player("puuid-1", "GOLD", "II", summoner_id="sum-1") is False
    assert store.known_player_keys() == {"puuid-1", "sum-1"}
    assert store.pending_players("GOLD") == ["puuid-1"]

    store.mark_player("puuid-1", "done")

    assert store.pending_players("GOLD") == []


def test_match_ids_are_deduplicated_across_players():
    store = Store(":memory:")

    assert store.add_match_ids(["M1", "M2"], seed_tier="GOLD", seed_puuid="a") == 2
    assert store.add_match_ids(["M2", "M3"], seed_tier="SILVER", seed_puuid="b") == 1

    first = store.next_pending_match("GOLD")
    assert (first["match_id"], first["seed_puuid"], first["position"]) == ("M1", "a", 0)
    assert store.match_status("M2") == "pending"


def test_saving_a_match_counts_it_and_keeps_the_raw_response():
    store = Store(":memory:")
    raw = make_match(match_id="M1")
    store.add_match_ids(["M1"], seed_tier="GOLD", seed_puuid="a")

    store.save_match(extract_match(raw, seed_tier="GOLD"), raw)

    assert store.matches_per_tier() == {"GOLD": 1}
    assert store.match_status("M1") == "done"
    assert store.load_raw("M1") == raw
    assert store.next_pending_match("GOLD") is None


def test_skipping_older_matches_only_touches_that_players_later_positions():
    store = Store(":memory:")
    store.add_match_ids(["A0", "A1", "A2"], seed_tier="GOLD", seed_puuid="a")
    store.add_match_ids(["B0", "B1"], seed_tier="GOLD", seed_puuid="b")

    assert store.skip_older_matches("a", after_position=0) == 2

    assert store.match_status("A0") == "pending"
    assert store.match_status("A1") == "skipped_patch"
    assert store.match_status("A2") == "skipped_patch"
    assert store.match_status("B1") == "pending"


def test_league_cursor_advances_then_exhausts():
    store = Store(":memory:")

    assert store.cursor("GOLD", "II") == (1, False)
    store.advance_cursor("GOLD", "II", exhausted=False)
    assert store.cursor("GOLD", "II") == (2, False)
    store.advance_cursor("GOLD", "II", exhausted=True)
    assert store.cursor("GOLD", "II") == (2, True)


def test_state_survives_closing_and_reopening_the_database(tmp_path):
    path = tmp_path / "matches.sqlite"
    raw = make_match(match_id="M1")

    store = Store(path)
    store.add_player("a", "GOLD", "I")
    store.add_match_ids(["M1", "M2"], seed_tier="GOLD", seed_puuid="a")
    store.save_match(extract_match(raw, seed_tier="GOLD"), raw)
    store.close()

    reopened = Store(path)
    assert reopened.matches_per_tier() == {"GOLD": 1}
    assert reopened.next_pending_match("GOLD")["match_id"] == "M2"
    assert reopened.pending_players("GOLD") == ["a"]
    reopened.close()
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_store.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.store'`

- [ ] **Step 3: Implement**

Create `ml/collect/store.py`:

```python
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
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_collect_store.py -q`
Expected: `6 passed`

Run: `python -m pytest test/ml -q`
Expected: `27 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/collect/store.py test/ml/test_collect_store.py
git commit -m "feat: persist collection state in a resumable SQLite store"
```

---

## Task 5: Rate limiter

**Files:**
- Create: `ml/collect/riot_client.py`, `test/ml/test_collect_rate_limiter.py`

The limiter takes an injected clock and sleep so tests run instantly and deterministically.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_collect_rate_limiter.py`:

```python
import pytest

from ml.collect.riot_client import RateLimiter

PLATFORM = "euw1.api.riotgames.com"
REGION = "europe.api.riotgames.com"


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0
        self.sleeps: list[float] = []

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def test_waits_when_the_per_second_window_is_full():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(20):
        limiter.acquire(PLATFORM)
    assert clock.sleeps == []

    limiter.acquire(PLATFORM)

    assert clock.sleeps == [pytest.approx(1.0)]


def test_waits_when_the_two_minute_window_is_full():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(100):
        limiter.acquire(REGION)
        clock.now += 0.1
    assert clock.sleeps == []

    limiter.acquire(REGION)

    assert clock.sleeps == [pytest.approx(110.0)]


def test_tracks_each_host_separately():
    clock = FakeClock()
    limiter = RateLimiter(clock=clock, sleep=clock.sleep)

    for _ in range(20):
        limiter.acquire(PLATFORM)
    limiter.acquire(REGION)

    assert clock.sleeps == []
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_rate_limiter.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.riot_client'`

- [ ] **Step 3: Implement**

Create `ml/collect/riot_client.py`:

```python
"""Riot API access: routing, rate limiting, and mapping HTTP failures to explicit errors."""

from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable

# Development and personal keys: 20 requests every second and 100 every two
# minutes, enforced per region.
DEFAULT_WINDOWS: tuple[tuple[int, float], ...] = ((20, 1.0), (100, 120.0))


class RateLimiter:
    """Sliding-window limiter, one set of windows per host.

    `acquire` blocks until sending one more request would stay inside every window.
    """

    def __init__(
        self,
        windows: tuple[tuple[int, float], ...] = DEFAULT_WINDOWS,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._windows = windows
        self._clock = clock
        self._sleep = sleep
        self._longest = max(seconds for _, seconds in windows)
        self._sent: dict[str, deque[float]] = {}

    def acquire(self, host: str) -> None:
        sent = self._sent.setdefault(host, deque())
        while True:
            now = self._clock()
            while sent and now - sent[0] >= self._longest:
                sent.popleft()

            wait = 0.0
            for limit, seconds in self._windows:
                in_window = [stamp for stamp in sent if now - stamp < seconds]
                if len(in_window) >= limit:
                    # The request may go once the oldest of the last `limit` leaves the window.
                    wait = max(wait, seconds - (now - in_window[-limit]))

            if wait <= 0:
                sent.append(now)
                return
            self._sleep(wait)
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_collect_rate_limiter.py -q`
Expected: `3 passed`

Run: `python -m pytest test/ml -q`
Expected: `30 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/collect/riot_client.py test/ml/test_collect_rate_limiter.py
git commit -m "feat: rate-limit Riot requests per host with sliding windows"
```

---

## Task 6: Riot client

**Files:**
- Modify: `ml/collect/riot_client.py`
- Create: `test/ml/test_collect_riot_client.py`

The exact league paths and whether league entries carry `puuid` are unverified (see the spec's "Unverified API Details"). They are confined to this module so Task 9's real run can correct them in one place.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_collect_riot_client.py`:

```python
import httpx
import pytest

from ml.collect.riot_client import (
    KeyExpiredError,
    NotFoundError,
    RateLimiter,
    RiotClient,
    RiotServerError,
)


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.now += seconds


def make_client(handler, sleeps):
    clock = FakeClock()
    return RiotClient(
        "RGAPI-test",
        transport=httpx.MockTransport(handler),
        limiter=RateLimiter(clock=clock, sleep=clock.sleep),
        sleep=sleeps.append,
    )


def test_an_expired_key_raises():
    client = make_client(lambda request: httpx.Response(401), [])

    with pytest.raises(KeyExpiredError):
        client.match("EUW1_1")


def test_a_forbidden_key_raises_the_same_error():
    client = make_client(lambda request: httpx.Response(403), [])

    with pytest.raises(KeyExpiredError):
        client.match("EUW1_1")


def test_a_missing_match_raises_not_found():
    client = make_client(lambda request: httpx.Response(404), [])

    with pytest.raises(NotFoundError):
        client.match("EUW1_1")


def test_a_rate_limited_request_waits_for_retry_after_then_succeeds():
    responses = iter([httpx.Response(429, headers={"Retry-After": "7"}), httpx.Response(200, json={"ok": True})])
    sleeps: list[float] = []
    client = make_client(lambda request: next(responses), sleeps)

    assert client.match("EUW1_1") == {"ok": True}
    assert sleeps == [7.0]


def test_server_errors_retry_with_backoff_then_give_up():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(503)

    sleeps: list[float] = []
    client = make_client(handler, sleeps)

    with pytest.raises(RiotServerError):
        client.match("EUW1_1")

    assert sleeps == [2.0, 4.0, 8.0]
    assert len(calls) == 4


def test_routes_league_calls_to_the_platform_and_match_calls_to_the_region():
    seen = []

    def handler(request):
        seen.append((request.url.host, request.url.path, dict(request.url.params), request.headers["X-Riot-Token"]))
        if request.url.path.startswith("/lol/league"):
            return httpx.Response(200, json=[{"puuid": "abc"}])
        return httpx.Response(200, json=["EUW1_1"])

    client = make_client(handler, [])

    assert client.league_page("GOLD", "II", 3) == [{"puuid": "abc"}]
    assert client.match_ids("abc") == ["EUW1_1"]

    assert seen[0] == (
        "euw1.api.riotgames.com",
        "/lol/league/v4/entries/RANKED_SOLO_5x5/GOLD/II",
        {"page": "3"},
        "RGAPI-test",
    )
    assert seen[1] == (
        "europe.api.riotgames.com",
        "/lol/match/v5/matches/by-puuid/abc/ids",
        {"queue": "420", "start": "0", "count": "100"},
        "RGAPI-test",
    )


def test_an_apex_tier_reads_its_single_league_listing_on_page_one_only():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json={"entries": [{"puuid": "x"}]})

    client = make_client(handler, [])

    assert client.league_page("CHALLENGER", "I", 1) == [{"puuid": "x"}]
    assert client.league_page("CHALLENGER", "I", 2) == []
    assert paths == ["/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"]


def test_resolve_puuid_uses_the_entry_puuid_without_a_request():
    calls = []

    def handler(request):
        calls.append(request)
        return httpx.Response(200, json={})

    client = make_client(handler, [])

    assert client.resolve_puuid({"puuid": "abc", "summonerId": "s-1"}) == "abc"
    assert calls == []


def test_resolve_puuid_converts_a_summoner_id_when_puuid_is_absent():
    paths = []

    def handler(request):
        paths.append(request.url.path)
        return httpx.Response(200, json={"puuid": "converted"})

    client = make_client(handler, [])

    assert client.resolve_puuid({"summonerId": "s-1"}) == "converted"
    assert paths == ["/lol/summoner/v4/summoners/s-1"]
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_riot_client.py -q`
Expected: FAIL — `ImportError: cannot import name 'KeyExpiredError' from 'ml.collect.riot_client'`

- [ ] **Step 3: Implement**

In `ml/collect/riot_client.py`, add `import httpx` and `from typing import Any` to the imports so the import block reads:

```python
from __future__ import annotations

import time
from collections import deque
from collections.abc import Callable
from typing import Any

import httpx
```

Then add, below the `DEFAULT_WINDOWS` line:

```python
PLATFORM_HOST = "euw1.api.riotgames.com"
REGIONAL_HOST = "europe.api.riotgames.com"
RANKED_SOLO = "RANKED_SOLO_5x5"
RANKED_SOLO_QUEUE_ID = 420
SERVER_ERROR_BACKOFF = (2.0, 4.0, 8.0)
APEX_LEAGUE_PATHS = {
    "MASTER": "masterleagues",
    "GRANDMASTER": "grandmasterleagues",
    "CHALLENGER": "challengerleagues",
}


class KeyExpiredError(RuntimeError):
    """401 or 403: the key expired or is invalid. Collection must stop, not retry."""


class NotFoundError(RuntimeError):
    """404: the resource does not exist. Never retried."""


class RiotServerError(RuntimeError):
    """5xx that persisted through every retry."""
```

And append at the end of the file:

```python
class RiotClient:
    def __init__(
        self,
        api_key: str,
        *,
        transport: httpx.BaseTransport | None = None,
        limiter: RateLimiter | None = None,
        sleep: Callable[[float], None] = time.sleep,
    ) -> None:
        self._http = httpx.Client(headers={"X-Riot-Token": api_key}, transport=transport, timeout=30.0)
        self._limiter = limiter or RateLimiter()
        self._sleep = sleep

    def close(self) -> None:
        self._http.close()

    def get(self, host: str, path: str, params: dict[str, Any] | None = None) -> Any:
        server_errors = 0
        while True:
            self._limiter.acquire(host)
            response = self._http.get(f"https://{host}{path}", params=params)
            status = response.status_code

            if status in (401, 403):
                raise KeyExpiredError(f"{status} on {path}")
            if status == 404:
                raise NotFoundError(path)
            if status == 429:
                self._sleep(float(response.headers.get("Retry-After", "10")))
                continue
            if status >= 500:
                if server_errors >= len(SERVER_ERROR_BACKOFF):
                    raise RiotServerError(f"{status} on {path}")
                self._sleep(SERVER_ERROR_BACKOFF[server_errors])
                server_errors += 1
                continue

            response.raise_for_status()
            return response.json()

    def league_page(self, tier: str, division: str, page: int) -> list[dict[str, Any]]:
        """One page of ranked players. Apex tiers are one listing, served as page 1."""
        if tier in APEX_LEAGUE_PATHS:
            if page != 1:
                return []
            league = self.get(PLATFORM_HOST, f"/lol/league/v4/{APEX_LEAGUE_PATHS[tier]}/by-queue/{RANKED_SOLO}")
            return list(league.get("entries") or [])
        return list(
            self.get(PLATFORM_HOST, f"/lol/league/v4/entries/{RANKED_SOLO}/{tier}/{division}", {"page": page})
        )

    def resolve_puuid(self, entry: dict[str, Any]) -> str:
        """League entries may or may not carry `puuid`; convert a summoner id when they do not."""
        puuid = entry.get("puuid")
        if puuid:
            return str(puuid)
        summoner = self.get(PLATFORM_HOST, f"/lol/summoner/v4/summoners/{entry['summonerId']}")
        return str(summoner["puuid"])

    def match_ids(self, puuid: str, count: int = 100) -> list[str]:
        """Ranked solo match ids, newest first."""
        return list(
            self.get(
                REGIONAL_HOST,
                f"/lol/match/v5/matches/by-puuid/{puuid}/ids",
                {"queue": RANKED_SOLO_QUEUE_ID, "start": 0, "count": count},
            )
        )

    def match(self, match_id: str) -> dict[str, Any]:
        return dict(self.get(REGIONAL_HOST, f"/lol/match/v5/matches/{match_id}"))
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_collect_riot_client.py -q`
Expected: `9 passed`

Run: `python -m pytest test/ml -q`
Expected: `39 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/collect/riot_client.py test/ml/test_collect_riot_client.py
git commit -m "feat: add a Riot API client with routing and explicit error mapping"
```

---

## Task 7: Collection loop

**Files:**
- Create: `ml/collect/collect.py`, `test/ml/test_collect_collect.py`
- Modify: `test/ml/collect_fixtures.py`

- [ ] **Step 1: Add the fake source to the fixtures**

Append to `test/ml/collect_fixtures.py`:

```python
import copy

from ml.collect.riot_client import NotFoundError
from ml.collect.sampling import TIERS


class FakeSource:
    """Stands in for RiotClient. Only division "I", page 1 has players; every call is recorded."""

    def __init__(
        self,
        leagues: dict[str, list[dict[str, Any]]],
        player_matches: dict[str, list[str]],
        matches: dict[str, dict[str, Any]],
    ) -> None:
        self.leagues = leagues
        self.player_matches = player_matches
        self.matches = matches
        self.calls: list[tuple[str, ...]] = []

    def league_page(self, tier: str, division: str, page: int) -> list[dict[str, Any]]:
        self.calls.append(("league", tier, division, str(page)))
        if division != "I" or page != 1:
            return []
        return [dict(entry) for entry in self.leagues.get(tier, [])]

    def resolve_puuid(self, entry: dict[str, Any]) -> str:
        return str(entry["puuid"])

    def match_ids(self, puuid: str, count: int = 100) -> list[str]:
        self.calls.append(("ids", puuid))
        return list(self.player_matches.get(puuid, []))[:count]

    def match(self, match_id: str) -> dict[str, Any]:
        self.calls.append(("match", match_id))
        if match_id not in self.matches:
            raise NotFoundError(match_id)
        return copy.deepcopy(self.matches[match_id])

    def close(self) -> None:
        pass


def world(tiers: tuple[str, ...] | list[str] = TIERS, matches_per_player: int = 3) -> FakeSource:
    """One player per tier, each with `matches_per_player` current-patch matches named TIER_1, TIER_2, ..."""
    leagues: dict[str, list[dict[str, Any]]] = {}
    player_matches: dict[str, list[str]] = {}
    matches: dict[str, dict[str, Any]] = {}
    for tier in tiers:
        puuid = f"{tier.lower()}-1"
        leagues[tier] = [{"puuid": puuid, "summonerId": f"s-{puuid}"}]
        match_ids = [f"{tier}_{n}" for n in range(1, matches_per_player + 1)]
        player_matches[puuid] = match_ids
        for match_id in match_ids:
            matches[match_id] = make_match(match_id=match_id)
    return FakeSource(leagues, player_matches, matches)
```

- [ ] **Step 2: Write the failing tests**

Create `test/ml/test_collect_collect.py`:

```python
import random

from collect_fixtures import PATCH, make_match, world
from ml.collect.collect import collect
from ml.collect.sampling import TIERS
from ml.collect.store import Store


def run(source, store, target=20):
    return collect(source, store, target=target, patch=PATCH, rng=random.Random(1), log=lambda message: None)


def test_fills_every_tier_quota():
    summary = run(world(), Store(":memory:"))

    assert summary.collected == {tier: 2 for tier in TIERS}
    assert summary.short_tiers() == []
    assert summary.exhausted == []


def test_an_older_patch_ends_collection_for_that_player():
    source = world()
    source.matches["GOLD_2"] = make_match(match_id="GOLD_2", game_version="16.17.500.1")
    source.matches["GOLD_3"] = make_match(match_id="GOLD_3", game_version="16.17.400.1")
    store = Store(":memory:")

    summary = run(source, store)

    assert summary.collected["GOLD"] == 1
    assert ("match", "GOLD_3") not in source.calls
    assert store.match_status("GOLD_2") == "skipped_patch"
    assert store.match_status("GOLD_3") == "skipped_patch"
    assert "GOLD" in summary.short_tiers()
    assert "GOLD" in summary.exhausted


def test_a_remake_is_skipped_and_not_counted():
    source = world()
    source.matches["IRON_1"] = make_match(match_id="IRON_1", remake=True)
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("IRON_1") == "skipped_invalid"
    assert summary.collected["IRON"] == 2


def test_a_missing_match_is_recorded_and_collection_continues():
    source = world()
    del source.matches["SILVER_1"]
    store = Store(":memory:")

    summary = run(source, store)

    assert store.match_status("SILVER_1") == "not_found"
    assert summary.collected["SILVER"] == 2


def test_a_tier_without_players_does_not_stop_the_others():
    source = world(tiers=[tier for tier in TIERS if tier != "CHALLENGER"])

    summary = run(source, Store(":memory:"))

    assert "CHALLENGER" not in summary.collected
    assert summary.exhausted == ["CHALLENGER"]
    assert all(summary.collected[tier] == 2 for tier in TIERS if tier != "CHALLENGER")


def test_a_second_run_resumes_without_downloading_again(tmp_path):
    path = tmp_path / "matches.sqlite"
    first = Store(path)
    run(world(), first)
    first.close()

    source = world()
    second = Store(path)
    summary = run(source, second)
    second.close()

    assert source.calls == []
    assert summary.collected == {tier: 2 for tier in TIERS}
```

- [ ] **Step 3: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_collect.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.collect'`

- [ ] **Step 4: Implement**

Create `ml/collect/collect.py`:

```python
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
    return str(entry.get("puuid") or entry["summonerId"])


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
        except ValueError:
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

        store.save_match(row, raw)
    return processed


def _list_matches(source: MatchSource, store: Store, puuid: str, tier: str) -> None:
    try:
        match_ids = source.match_ids(puuid)
    except (NotFoundError, RiotServerError):
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

        by_key = {entry_key(entry): entry for entry in entries}
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
            except (NotFoundError, RiotServerError):
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
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest test/ml/test_collect_collect.py -q`
Expected: `6 passed`

Run: `python -m pytest test/ml -q`
Expected: `45 passed`

- [ ] **Step 6: Commit**

```bash
git add ml/collect/collect.py test/ml/collect_fixtures.py test/ml/test_collect_collect.py
git commit -m "feat: run the resumable three-phase collection loop"
```

---

## Task 8: Command line

**Files:**
- Create: `ml/collect/run.py`, `test/ml/test_collect_run.py`

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_collect_run.py`:

```python
from collect_fixtures import world
from ml.collect.riot_client import KeyExpiredError, RiotServerError
from ml.collect.run import detect_patch, main
from ml.collect.sampling import TIERS


def test_a_missing_key_exits_before_any_request(tmp_path):
    outputs: list[str] = []
    created: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={},
        client_factory=created.append,
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 2
    assert created == []
    assert "RIOT_API_KEY" in outputs[0]


def test_the_patch_is_detected_from_the_newest_data_dragon_version():
    assert detect_patch(lambda url: ["16.18.1", "16.17.1"]) == "16.18"


def test_a_forced_patch_skips_detection(tmp_path):
    def must_not_detect():
        raise AssertionError("patch detection must not run when --patch is given")

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--patch", "16.18", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(),
        patch_detector=must_not_detect,
        out=outputs.append,
    )

    assert code == 0
    assert "Patch visé : 16.18" in outputs


def test_an_expired_key_stops_cleanly_with_instructions(tmp_path):
    class ExpiredSource:
        def league_page(self, tier, division, page):
            raise KeyExpiredError("expired")

        def close(self):
            pass

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: ExpiredSource(),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 3
    assert any("expirée" in line for line in outputs)


def test_a_persistent_riot_server_error_stops_cleanly_and_stays_resumable(tmp_path):
    class DownSource:
        def league_page(self, tier, division, page):
            raise RiotServerError("503 on league")

        def close(self):
            pass

    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: DownSource(),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 4
    assert any("relance" in line for line in outputs)


def test_the_summary_reports_each_tier_and_names_the_short_ones(tmp_path):
    outputs: list[str] = []

    code = main(
        ["--target", "20", "--db", str(tmp_path / "m.sqlite")],
        env={"RIOT_API_KEY": "RGAPI-test"},
        client_factory=lambda key: world(tiers=[tier for tier in TIERS if tier != "CHALLENGER"]),
        patch_detector=lambda: "16.18",
        out=outputs.append,
    )

    assert code == 0
    assert any(line.startswith("  CHALLENGER") and line.endswith("0 / 2") for line in outputs)
    assert any(line.startswith("  GOLD") and line.endswith("2 / 2") for line in outputs)
    assert any(line.startswith("Déséquilibre") and "CHALLENGER" in line for line in outputs)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest test/ml/test_collect_run.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'ml.collect.run'`

- [ ] **Step 3: Implement**

Create `ml/collect/run.py`:

```python
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
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_collect_run.py -q`
Expected: `6 passed`

Run: `python -m pytest test/ml -q`
Expected: `51 passed`

- [ ] **Step 5: Check the command starts and refuses to run without a key**

Run in PowerShell: `Remove-Item Env:RIOT_API_KEY -ErrorAction SilentlyContinue; python -m ml.collect.run --target 20`
Expected: the `RIOT_API_KEY n'est pas défini.` message, exit code 2, no traceback, no database created.

- [ ] **Step 6: Commit**

```bash
git add ml/collect/run.py test/ml/test_collect_run.py
git commit -m "feat: add the collection command line with key and patch handling"
```

---

## Task 9: Real short run (performed by the owner of the Riot key)

This task cannot be delegated: it needs the owner's development key, which must never be written to disk or pasted into a conversation. Its purpose is to confirm the API details the spec marks as unverified.

- [ ] **Step 1: Run a 20-match collection into a separate database**

In PowerShell, from the repository root:

```powershell
$env:RIOT_API_KEY = "RGAPI-..."   # the key from developer.riotgames.com
python -m ml.collect.run --target 20 --db ml/artifacts/matches-smoke.sqlite
```

Expected: `Patch visé : ...`, progress lines per tier, then a `Bilan :` block with ten tiers at `2 / 2`, exit code 0. A few minutes at most.

- [ ] **Step 2: Inspect what was collected**

```powershell
python -c "import sqlite3; db = sqlite3.connect('ml/artifacts/matches-smoke.sqlite'); print('matches par rang :', db.execute('select seed_tier, count(*) from matches group by 1').fetchall()); print('statuts :', db.execute('select status, count(*) from match_ids group by 1').fetchall()); print('joueurs / sans puuid direct :', db.execute('select count(*), sum(summoner_id is not null) from players').fetchone()); print('une ligne :', tuple(db.execute('select * from matches limit 1').fetchone())[:19])"
```

- [ ] **Step 3: Read the result against the unverified points**

| Observation | Meaning | Action |
| --- | --- | --- |
| Ten tiers at 2 matches, a sensible row | League paths, match fields and routing are right | None |
| A tier with 0 matches and the command reporting it exhausted | Its league path or the entries shape is wrong | Correct `league_page` in `ml/collect/riot_client.py`, add a test with the real response shape |
| Most `match_ids` statuses are `skipped_invalid` | A match field name differs from `extract.py` | Load one raw match with `Store(...).load_raw(id)`, correct `extract_match`, update `make_match` to the real shape |
| A `404` or `KeyExpiredError` on the league call despite a fresh key | An endpoint path is wrong | Correct the path in `riot_client.py` |
| `summoner_id` present but no conversion requests were needed | Entries carry `puuid` | None: `resolve_puuid` already uses it directly |

- [ ] **Step 4: Record the outcome**

Add a short section `## Real-run findings` at the end of `docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md` stating whether league entries carry `puuid`, whether any path or field needed correcting, and the patch detected. If code was corrected, commit the fix together with its test.

```bash
git add docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md
git commit -m "docs: record the real Riot API run findings"
```

Then delete `ml/artifacts/matches-smoke.sqlite` and its `-wal`/`-shm` files: the full collection uses `ml/artifacts/matches.sqlite`.

---

## Task 10: Align the spec with the plan

**Files:**
- Modify: `docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md`

- [ ] **Step 1: Update the architecture table**

In the spec's Architecture section, replace the row

```
| `run.py` | Command-line entry point | the four above |
```

with

```
| `collect.py` | The three-phase collection loop, written against a `MatchSource` protocol so it can be tested with a fake | `extract`, `sampling`, `store`, `riot_client` errors |
| `run.py` | Command-line entry point: arguments, key check, patch detection, final summary | `collect`, `riot_client`, `store` |
```

- [ ] **Step 2: Document the schema additions**

In the spec's Storage section, replace the `players` and `match_ids` lines with:

```
**`players`** — `puuid` (primary key), `summoner_id` (kept when league entries identify players by summoner id, so an already-drawn player is recognised before conversion), `tier`, `division`, `sampled_at`, `ids_status` (`pending`, `done`, `failed`).

**`match_ids`** — `match_id` (primary key), `seed_tier`, `seed_puuid`, `position` (0 is the seed player's newest match; it is what lets an older-patch match end collection for that player), `status` (`pending`, `done`, `skipped_patch`, `skipped_invalid`, `not_found`, `failed`), `attempts`.
```

And add after the `matches` table:

```
**`league_cursors`** — `tier`, `division` (primary key together), `next_page`, `exhausted`. Records how far each division's listing has been read, so a resumed run does not re-read pages it has already drawn from.
```

- [ ] **Step 3: Document the server-error stop**

In the spec's Error Handling table, replace the Riot server error row with:

```
| **Riot server error** (5xx) | Retries up to 3 times with exponential backoff (2 s, 4 s, 8 s). A match that still fails is marked `failed` and skipped. A league listing that still fails has no single item to skip, so the command stops cleanly with exit code 4 and a message; the run resumes from where it stopped |
```

- [ ] **Step 4: Verify and commit**

Run: `python -m pytest test/ml -q`
Expected: `51 passed`

```bash
git add docs/superpowers/specs/2026-09-17-draftforme-match-collection-design.md
git commit -m "docs: record the collect.py split in the collection spec"
```
