# DraftForMe Win Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Train a win-probability model on the collected ranked EUW matches and decide, once, on held-out matches, whether it predicts the winner of a draft better than the site's rule engine and plain champion win rates.

**Architecture:** A package `ml/win/` of small modules, each testable on synthetic data: `data.py` loads the collection database read-only and splits it by seed player; `encoding.py` turns drafts into signed sparse features with masking for partial drafts; `metrics.py` scores probabilities and runs the paired bootstrap; `baselines.py` ports the site engine and builds the win-rate reference; `models.py` holds the logistic stages, gradient boosting and selection; `select.py` and `test.py` are the two commands.

**Tech Stack:** Python 3.11, scikit-learn 1.8, numpy, pandas, scipy (sparse matrices, installed with scikit-learn), joblib, pytest 9. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md`

**Deviations from the spec, recorded in Task 9:**
- The logistic grid is `C` in (0.003, 0.01, 0.03, 0.1, 0.3, 1.0). A full-scale synthetic run showed stages 2 to 4 preferring the strongest regularisation of a grid starting at 0.01, so the grid extends one step below.
- `ml.win.select` refuses to run once the test set has been evaluated (exit code 5): choosing a model after seeing the test would bias it.
- Both commands take `--artifacts` and `--seed-sql`, so tests can run them in a temporary directory; `split.json` also records the database path, which `ml.win.test` reads back.

**Verification already done:** every code block below was assembled into an isolated copy of the repository and the suite passed (125 tests: the 76 existing and 49 new). A full-scale run on 30,000 synthetic matches with the real `supabase/seed.sql` took about 3 minutes for `ml.win.select` and 4 seconds for `ml.win.test`, with output encodable in cp1252. If a step's stated count or output differs from what you observe, report what you observed; do not adjust the expectation.

---

## Conventions for every task

- Run all commands from the repository root.
- Run tests with `python -m pytest test/ml -q`. A single file: `python -m pytest test/ml/test_win_data.py -q`.
- Tests live flat in `test/ml/`, named `test_win_*.py`. `test/ml/` has no `__init__.py`, so pytest puts it on `sys.path`: helpers are imported as `from win_fixtures import ...` and `from win_command_fixtures import ...`.
- Code, comments and identifiers are in English, like the rest of `ml/`. Messages printed to the person running a command are in French.
- **Never print a non-cp1252 character** (no arrows, no typographic quotes) in command output. French accents are fine.
- The whole suite must pass at every commit.
- Never open the real collection database for writing; `ml.win` only reads it.
- End every commit message with: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`

## File Structure

**Created**

| File | Responsibility |
| --- | --- |
| `ml/win/__init__.py` | Package marker |
| `ml/win/data.py` | Read-only loading, refusals, grouped and stratified split, split file |
| `ml/win/encoding.py` | Signed features, logistic stages, masking for partial drafts |
| `ml/win/metrics.py` | Log loss, AUC, accuracy, paired bootstrap, calibration table |
| `ml/win/baselines.py` | Engine port reading `seed.sql`, smoothed win-rate tables, calibration, both references |
| `ml/win/models.py` | Logistic and boosting models, candidate grid, selection on validation |
| `ml/win/select.py` | Command: split, train, choose, save |
| `ml/win/test.py` | Command: evaluate once on the test set |
| `test/ml/win_fixtures.py` | Synthetic drafts, collection databases and seed files |
| `test/ml/win_command_fixtures.py` | A small world and a wrapper for the select command |
| `test/ml/test_win_data.py` | |
| `test/ml/test_win_encoding.py` | |
| `test/ml/test_win_metrics.py` | |
| `test/ml/test_win_baselines.py` | |
| `test/ml/test_win_models.py` | |
| `test/ml/test_win_select.py` | |
| `test/ml/test_win_test_command.py` | |

**Modified**

| File | Change |
| --- | --- |
| `ml/paths.py` | Add `WIN_ARTIFACT_DIR` and `SEED_SQL_PATH` |
| `.gitignore` | Ignore `ml/artifacts/win/` |
| `ml/README.md` | Document the two commands (Task 9) |
| `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md` | Record the deviations (Task 9) |

---

## Task 1: Scaffolding

**Files:**
- Create: `ml/win/__init__.py`
- Modify: `ml/paths.py`, `.gitignore`

- [ ] **Step 1: Create the package marker**

Create `ml/win/__init__.py` as an empty file.

- [ ] **Step 2: Add the paths**

In `ml/paths.py`, directly below the line `MATCHES_DB_PATH = ARTIFACT_DIR / "matches.sqlite"`, add:

```python
WIN_ARTIFACT_DIR = ARTIFACT_DIR / "win"
SEED_SQL_PATH = PROJECT_ROOT / "supabase" / "seed.sql"
```

- [ ] **Step 3: Ignore the artifacts**

At the end of `.gitignore`, directly below `ml/artifacts/matches*.sqlite-shm`, add:

```text
ml/artifacts/win/
```

- [ ] **Step 4: Verify**

Run: `python -m pytest test/ml -q`
Expected: `76 passed`

Run: `python -c "from ml.paths import WIN_ARTIFACT_DIR, SEED_SQL_PATH; print(WIN_ARTIFACT_DIR.name, SEED_SQL_PATH.is_file())"`
Expected: `win True`

- [ ] **Step 5: Commit**

```bash
git add ml/win/__init__.py ml/paths.py .gitignore
git commit -m "chore: scaffold the win model package" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Loading and splitting the matches

**Files:**
- Create: `ml/win/data.py`, `test/ml/win_fixtures.py`, `test/ml/test_win_data.py`

The split deals whole seed players, tier by tier, to whichever set is furthest below its share. That keeps every match found through one player in a single set, which is what prevents near-duplicates across training and test.

- [ ] **Step 1: Write the synthetic data helpers**

Create `test/ml/win_fixtures.py`. It writes databases with the real collection schema (`ml.collect.store.SCHEMA`), in one transaction, so tests stay fast. Task 5 appends a seed file writer to it.

```python
"""Test helpers for ml.win: synthetic match databases and a small seed.sql."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

import numpy as np

from ml.collect.store import MATCH_COLUMNS, SCHEMA
from ml.win.data import PICK_COLUMNS

TIERS = ("IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER")


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
) -> list[str]:
    """Writes a collection database with the real schema. Seed players cycle through the ten tiers."""
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
```

- [ ] **Step 2: Write the failing tests**

Create `test/ml/test_win_data.py`:

```python
import sqlite3
from contextlib import closing

import numpy as np
import pytest

from ml.win.data import (
    DatasetRejected,
    MissingDatabaseError,
    load_matches,
    read_split,
    split_matches,
    subset,
    to_dataset,
    write_split,
)
from win_fixtures import random_drafts, write_database


def make_database(tmp_path, count=2000):
    rng = np.random.default_rng(0)
    drafts = random_drafts(count, rng)
    labels = rng.integers(0, 2, size=count)
    db = tmp_path / "matches.sqlite"
    write_database(db, drafts, labels)
    return db, drafts, labels


def test_loads_every_match_with_its_draft_outcome_and_seed_player(tmp_path):
    db, drafts, labels = make_database(tmp_path)

    frame = load_matches(db)
    dataset = to_dataset(frame)

    assert len(dataset) == 2000
    order = np.argsort([int(match_id.split("_")[1]) for match_id in dataset.match_ids])
    assert (dataset.drafts[order] == drafts).all()
    assert (dataset.labels[order] == labels).all()
    assert set(frame["seed_puuid"]) == {f"player-{index}" for index in range(400)}


def test_refuses_a_missing_database(tmp_path):
    with pytest.raises(MissingDatabaseError):
        load_matches(tmp_path / "absent.sqlite")


def test_refuses_a_database_with_too_few_matches(tmp_path):
    db = tmp_path / "small.sqlite"
    write_database(db, random_drafts(50, np.random.default_rng(0)), np.ones(50, dtype=int))

    with pytest.raises(DatasetRejected, match="au moins 1000"):
        load_matches(db)


def test_refuses_a_database_holding_two_patches(tmp_path):
    db, _, _ = make_database(tmp_path)
    with closing(sqlite3.connect(str(db))) as connection:
        connection.execute("update matches set patch = '16.17' where match_id = 'EUW1_0'")
        connection.commit()

    with pytest.raises(DatasetRejected, match="16.17, 16.18"):
        load_matches(db)


def test_split_never_shares_a_seed_player_between_sets(tmp_path):
    db, _, _ = make_database(tmp_path)
    frame = load_matches(db)

    split = split_matches(frame, seed=42)

    player_of = dict(zip(frame["match_id"], frame["seed_puuid"]))
    train, validation, test = ({player_of[match_id] for match_id in ids} for ids in (split.train, split.validation, split.test))
    assert not train & validation
    assert not train & test
    assert not validation & test
    assert len(split.train) + len(split.validation) + len(split.test) == len(frame)


def test_split_keeps_every_tier_close_to_70_15_15(tmp_path):
    db, _, _ = make_database(tmp_path)
    frame = load_matches(db)

    split = split_matches(frame, seed=42)

    tier_of = dict(zip(frame["match_id"], frame["seed_tier"]))
    for tier in frame["seed_tier"].unique():
        total = int((frame["seed_tier"] == tier).sum())
        for ids, share in ((split.train, 0.70), (split.validation, 0.15), (split.test, 0.15)):
            in_set = sum(1 for match_id in ids if tier_of[match_id] == tier)
            assert abs(in_set / total - share) < 0.03


def test_split_is_reproducible_and_round_trips_through_its_file(tmp_path):
    db, _, _ = make_database(tmp_path)
    frame = load_matches(db)

    split = split_matches(frame, seed=7)
    assert split == split_matches(frame, seed=7)
    assert split != split_matches(frame, seed=8)

    path = tmp_path / "win" / "split.json"
    write_split(path, split, seed=7, patch="16.18", db_path=db)
    restored, meta = read_split(path)

    assert restored == split
    assert meta == {"seed": 7, "patch": "16.18", "db": str(db)}


def test_subset_keeps_the_requested_order_and_refuses_unknown_ids(tmp_path):
    db, _, _ = make_database(tmp_path)
    frame = load_matches(db)

    rows = subset(frame, ["EUW1_5", "EUW1_2"])
    assert list(rows["match_id"]) == ["EUW1_5", "EUW1_2"]

    with pytest.raises(DatasetRejected, match="absentes"):
        subset(frame, ["EUW1_5", "EUW1_99999"])
```

- [ ] **Step 3: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_data.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.data'`

- [ ] **Step 4: Implement**

Create `ml/win/data.py`:

```python
"""Loads the collected matches read-only and splits them into training, validation and test sets."""

from __future__ import annotations

import json
import random
import sqlite3
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

ROLES = ("top", "jungle", "mid", "adc", "support")
PICK_COLUMNS = tuple(f"{side}_{role}" for side in ("blue", "red") for role in ROLES)
MIN_MATCHES = 1000
SPLIT_FRACTIONS = (0.70, 0.15, 0.15)
SET_NAMES = ("train", "validation", "test")


class MissingDatabaseError(RuntimeError):
    """The match database does not exist."""


class DatasetRejected(RuntimeError):
    """The database cannot be used as it is. The message names the reason, in French."""


@dataclass(frozen=True)
class Dataset:
    """Drafts as champion ids in `PICK_COLUMNS` order (0 means hidden), with outcome and seed tier."""

    match_ids: np.ndarray
    drafts: np.ndarray
    labels: np.ndarray
    tiers: np.ndarray

    def __len__(self) -> int:
        return len(self.labels)


@dataclass(frozen=True)
class Split:
    train: list[str]
    validation: list[str]
    test: list[str]


def load_matches(db_path: Path | str, min_matches: int = MIN_MATCHES) -> pd.DataFrame:
    """One row per collected match, with its seed player. Read-only, so a running collection is untouched."""
    path = Path(db_path)
    if not path.is_file():
        raise MissingDatabaseError(str(path))

    query = (
        "select m.match_id, m.patch, m.seed_tier, i.seed_puuid, "
        + ", ".join(f"m.{column}" for column in PICK_COLUMNS)
        + ", m.blue_win from matches m join match_ids i on i.match_id = m.match_id order by m.match_id"
    )
    with closing(sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)) as db:
        frame = pd.read_sql_query(query, db)

    patches = sorted(frame["patch"].unique())
    if len(patches) > 1:
        raise DatasetRejected(f"la base contient plusieurs patchs : {', '.join(patches)}")
    if len(frame) < min_matches:
        raise DatasetRejected(f"la base contient {len(frame)} parties, il en faut au moins {min_matches}")
    return frame


def to_dataset(frame: pd.DataFrame) -> Dataset:
    return Dataset(
        match_ids=frame["match_id"].to_numpy(),
        drafts=frame[list(PICK_COLUMNS)].to_numpy(dtype=np.int64),
        labels=frame["blue_win"].to_numpy(dtype=np.int64),
        tiers=frame["seed_tier"].to_numpy(),
    )


def split_matches(frame: pd.DataFrame, seed: int) -> Split:
    """Deals whole seed players into the three sets, tier by tier.

    Every match found through one seed player lands in the same set, so the test set never
    holds near-duplicates of training matches. Within each tier, shuffled seed players go to
    whichever set is furthest below its share of that tier's matches.
    """
    rng = random.Random(seed)
    sets: dict[str, list[str]] = {name: [] for name in SET_NAMES}

    for tier in sorted(frame["seed_tier"].unique()):
        in_tier = frame[frame["seed_tier"] == tier]
        groups = {puuid: sorted(ids) for puuid, ids in in_tier.groupby("seed_puuid")["match_id"]}
        players = sorted(groups)
        rng.shuffle(players)

        targets = [fraction * len(in_tier) for fraction in SPLIT_FRACTIONS]
        counts = [0, 0, 0]
        for puuid in players:
            index = max(range(3), key=lambda i: targets[i] - counts[i])
            sets[SET_NAMES[index]].extend(groups[puuid])
            counts[index] += len(groups[puuid])

    return Split(*(sorted(sets[name]) for name in SET_NAMES))


def subset(frame: pd.DataFrame, match_ids: list[str]) -> pd.DataFrame:
    """The rows of `match_ids`, in that order. Raises if the database no longer holds all of them."""
    indexed = frame.set_index("match_id", drop=False)
    missing = [match_id for match_id in match_ids if match_id not in indexed.index]
    if missing:
        raise DatasetRejected(f"{len(missing)} parties du découpage sont absentes de la base")
    return indexed.loc[match_ids].reset_index(drop=True)


def write_split(path: Path, split: Split, *, seed: int, patch: str, db_path: Path | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {"seed": seed, "patch": patch, "db": str(db_path)}
    payload.update({name: getattr(split, name) for name in SET_NAMES})
    path.write_text(json.dumps(payload, indent=1), encoding="utf-8")


def read_split(path: Path) -> tuple[Split, dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    split = Split(*(payload[name] for name in SET_NAMES))
    return split, {key: payload[key] for key in ("seed", "patch", "db")}
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest test/ml/test_win_data.py -q`
Expected: `8 passed`

Run: `python -m pytest test/ml -q`
Expected: `84 passed`

- [ ] **Step 6: Commit**

```bash
git add ml/win/data.py test/ml/win_fixtures.py test/ml/test_win_data.py
git commit -m "feat: load collected matches read-only and split them by seed player" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Draft encoding

**Files:**
- Create: `ml/win/encoding.py`, `test/ml/test_win_encoding.py`

Each feature is +1 for the blue side and -1 for the red side, so swapping teams negates every feature. A hidden pick is 0, and so is any pair feature that needs it. Stage 1 is champions by role; each later stage adds lane matchups, then synergies, then champion-by-tier-group features. Pair features need 5 training sightings to get a column.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_win_encoding.py`:

```python
import numpy as np
import pytest

from ml.win.encoding import DraftEncoder, hide_picks, swap_sides, with_masked_copies
from win_fixtures import random_drafts

DRAFT = np.array([[101, 201, 301, 401, 501, 102, 202, 302, 402, 502]])


def encoded(stage, drafts, tiers, min_pair_count=1):
    encoder = DraftEncoder(stage, min_pair_count=min_pair_count).fit(drafts, tiers)
    return encoder, encoder.transform(drafts, tiers).toarray()


def column(encoder, key):
    return encoder.columns[key]


def test_stage_1_signs_each_champion_by_side_and_role():
    encoder, matrix = encoded(1, DRAFT, ["GOLD"])

    assert len(encoder.columns) == 10
    assert matrix[0, column(encoder, ("champion", "top", 101))] == 1
    assert matrix[0, column(encoder, ("champion", "top", 102))] == -1
    assert matrix[0, column(encoder, ("champion", "support", 502))] == -1


def test_each_stage_adds_its_features_to_the_previous_ones():
    sizes = [len(encoded(stage, DRAFT, ["GOLD"])[0].columns) for stage in (1, 2, 3, 4)]

    # 10 champions, then 5 lane pairs, then 2 synergies per team, then 10 champion-by-elo features.
    assert sizes == [10, 15, 19, 29]


def test_lane_and_synergy_features_carry_the_expected_signs():
    encoder, matrix = encoded(3, DRAFT, ["GOLD"])

    assert matrix[0, column(encoder, ("lane", "mid", 301, 302))] == 1
    assert matrix[0, column(encoder, ("synergy", "adc+support", 401, 501))] == 1
    assert matrix[0, column(encoder, ("synergy", "adc+support", 402, 502))] == -1


def test_swapping_the_teams_negates_every_feature():
    rng = np.random.default_rng(3)
    drafts = random_drafts(200, rng)
    tiers = np.array(["GOLD", "IRON", "MASTER", "EMERALD"] * 50)
    encoder = DraftEncoder(4, min_pair_count=1).fit(drafts, tiers)

    original = encoder.transform(drafts, tiers).toarray()
    swapped = encoder.transform(swap_sides(drafts), tiers).toarray()

    assert np.array_equal(swapped, -original)


def test_a_hidden_pick_zeroes_its_champion_lane_and_synergy_features():
    encoder = DraftEncoder(3, min_pair_count=1).fit(DRAFT, ["GOLD"])
    draft = DRAFT.copy()
    draft[0, 3] = 0  # blue adc hidden

    matrix = encoder.transform(draft, ["GOLD"]).toarray()

    assert matrix[0, column(encoder, ("champion", "adc", 401))] == 0
    assert matrix[0, column(encoder, ("lane", "adc", 401, 402))] == 0
    assert matrix[0, column(encoder, ("synergy", "adc+support", 401, 501))] == 0
    assert matrix[0, column(encoder, ("synergy", "adc+support", 402, 502))] == -1


def test_rare_pairs_get_no_column_and_unknown_features_are_ignored():
    drafts = np.repeat(DRAFT, 4, axis=0)
    encoder = DraftEncoder(2).fit(drafts, ["GOLD"] * 4)

    assert not any(key[0] == "lane" for key in encoder.columns)

    unseen = np.array([[199, 299, 399, 499, 599, 198, 298, 398, 498, 598]])
    assert encoder.transform(unseen, ["GOLD"]).nnz == 0


def test_rejects_an_unknown_stage():
    with pytest.raises(ValueError):
        DraftEncoder(5)


def test_hide_picks_hides_exactly_the_requested_number():
    rng = np.random.default_rng(0)
    drafts = np.repeat(DRAFT, 9, axis=0)

    hidden = hide_picks(drafts, list(range(1, 10)), rng)

    assert [int((row == 0).sum()) for row in hidden] == list(range(1, 10))
    assert (drafts != 0).all()


def test_masked_copies_keep_labels_tiers_and_origin_aligned():
    rng = np.random.default_rng(0)
    drafts = random_drafts(50, rng)
    labels = np.arange(50) % 2
    tiers = np.array(["GOLD"] * 25 + ["IRON"] * 25)

    all_drafts, all_labels, all_tiers, origin = with_masked_copies(drafts, labels, tiers, 2, rng)

    assert len(all_drafts) == 150
    assert np.array_equal(all_drafts[:50], drafts)
    assert np.array_equal(all_labels, labels[origin])
    assert np.array_equal(all_tiers, tiers[origin])
    hidden = (all_drafts[50:] == 0).sum(axis=1)
    assert hidden.min() >= 1 and hidden.max() <= 9
    kept = all_drafts[50:] != 0
    assert np.array_equal(all_drafts[50:][kept], drafts[origin[50:]][kept])
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_encoding.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.encoding'`

- [ ] **Step 3: Implement**

Create `ml/win/encoding.py`:

```python
"""Turns drafts into model features.

A draft is ten champion ids in `PICK_COLUMNS` order, with 0 for a pick that is not known.
Every feature is signed: +1 when it describes the blue side and -1 for the red side, so
swapping the teams negates the whole feature vector and the side advantage stays in the
model's intercept.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterator, Sequence

import numpy as np
from scipy import sparse

from ml.win.data import ROLES

PICKS = 10
MIN_PAIR_COUNT = 5
STAGES = (1, 2, 3, 4)
SYNERGY_ROLES = (("adc", "support"), ("jungle", "mid"))
TIER_GROUPS = {
    "IRON": "iron-silver",
    "BRONZE": "iron-silver",
    "SILVER": "iron-silver",
    "GOLD": "gold-emerald",
    "PLATINUM": "gold-emerald",
    "EMERALD": "gold-emerald",
    "DIAMOND": "diamond-plus",
    "MASTER": "diamond-plus",
    "GRANDMASTER": "diamond-plus",
    "CHALLENGER": "diamond-plus",
}
# Pair features must be seen this often in training to get a column; champion features need one sighting.
PAIR_KINDS = ("lane", "synergy")


def draft_terms(draft: Sequence[int], tier: str, stage: int) -> Iterator[tuple[tuple, int]]:
    """Yields (feature key, sign) for every feature of `stage` present in the draft."""
    for team_start, sign in ((0, 1), (5, -1)):
        team = draft[team_start : team_start + 5]
        for role_index, champion in enumerate(team):
            if champion:
                yield ("champion", ROLES[role_index], int(champion)), sign
                if stage >= 4:
                    yield ("elo", TIER_GROUPS[tier], ROLES[role_index], int(champion)), sign
        if stage >= 3:
            for first, second in SYNERGY_ROLES:
                a, b = team[ROLES.index(first)], team[ROLES.index(second)]
                if a and b:
                    yield ("synergy", f"{first}+{second}", int(a), int(b)), sign

    if stage >= 2:
        for role_index, role in enumerate(ROLES):
            blue, red = draft[role_index], draft[5 + role_index]
            if blue and red:
                # One column per unordered pair: the sign says which side holds the lower id.
                if blue < red:
                    yield ("lane", role, int(blue), int(red)), 1
                else:
                    yield ("lane", role, int(red), int(blue)), -1


class DraftEncoder:
    """Learns the feature columns from training drafts, then encodes any draft as a sparse row."""

    def __init__(self, stage: int, min_pair_count: int = MIN_PAIR_COUNT) -> None:
        if stage not in STAGES:
            raise ValueError(f"unknown stage: {stage}")
        self.stage = stage
        self.min_pair_count = min_pair_count
        self.columns: dict[tuple, int] = {}

    def fit(self, drafts: np.ndarray, tiers: Sequence[str]) -> DraftEncoder:
        counts: Counter[tuple] = Counter()
        for draft, tier in zip(drafts, tiers):
            counts.update(key for key, _ in draft_terms(draft, tier, self.stage))
        kept = [
            key
            for key, count in counts.items()
            if key[0] not in PAIR_KINDS or count >= self.min_pair_count
        ]
        self.columns = {key: index for index, key in enumerate(sorted(kept))}
        return self

    def transform(self, drafts: np.ndarray, tiers: Sequence[str]) -> sparse.csr_matrix:
        rows: list[int] = []
        cols: list[int] = []
        values: list[float] = []
        for row, (draft, tier) in enumerate(zip(drafts, tiers)):
            for key, sign in draft_terms(draft, tier, self.stage):
                column = self.columns.get(key)
                if column is not None:
                    rows.append(row)
                    cols.append(column)
                    values.append(sign)
        return sparse.csr_matrix(
            (np.asarray(values, dtype=np.float32), (rows, cols)),
            shape=(len(drafts), len(self.columns)),
        )


def swap_sides(drafts: np.ndarray) -> np.ndarray:
    return np.concatenate([drafts[:, 5:], drafts[:, :5]], axis=1)


def hide_picks(drafts: np.ndarray, hidden_counts: Sequence[int], rng: np.random.Generator) -> np.ndarray:
    """A copy of `drafts` where row i has `hidden_counts[i]` picks, chosen at random, set to 0."""
    result = drafts.copy()
    for row, hidden in zip(result, hidden_counts):
        row[rng.choice(PICKS, size=int(hidden), replace=False)] = 0
    return result


def with_masked_copies(
    drafts: np.ndarray,
    labels: np.ndarray,
    tiers: np.ndarray,
    copies: int,
    rng: np.random.Generator,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Every draft once in full, then `copies` times with 1 to 9 picks hidden.

    Also returns, for each output row, the index of the draft it came from.
    """
    origin = np.concatenate([np.arange(len(drafts)), np.repeat(np.arange(len(drafts)), copies)])
    repeated = drafts[origin[len(drafts) :]]
    masked = hide_picks(repeated, rng.integers(1, PICKS, size=len(repeated)), rng)
    return (
        np.concatenate([drafts, masked]),
        labels[origin],
        tiers[origin],
        origin,
    )
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_win_encoding.py -q`
Expected: `9 passed`

Run: `python -m pytest test/ml -q`
Expected: `93 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/win/encoding.py test/ml/test_win_encoding.py
git commit -m "feat: encode drafts as signed features with masking for partial drafts" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Metrics and the paired bootstrap

**Files:**
- Create: `ml/win/metrics.py`, `test/ml/test_win_metrics.py`

The bootstrap resamples matches, and on each resample compares reference and model on the same matches. The decision later requires the 95 % interval of (reference log loss minus model log loss) to lie above zero.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_win_metrics.py`:

```python
import math

import numpy as np
import pytest

from ml.win.metrics import calibration_table, match_losses, paired_bootstrap, summary


def test_summary_reports_log_loss_auc_and_accuracy():
    labels = np.array([1, 0, 1, 0])
    probabilities = np.array([0.8, 0.3, 0.6, 0.6])

    result = summary(labels, probabilities)

    expected_loss = -(math.log(0.8) + math.log(0.7) + math.log(0.6) + math.log(0.4)) / 4
    assert result["matches"] == 4
    assert result["log_loss"] == pytest.approx(expected_loss)
    assert result["accuracy"] == pytest.approx(0.75)
    assert result["auc"] == pytest.approx(0.875)


def test_summary_has_no_auc_when_only_one_outcome_is_present():
    assert summary(np.array([1, 1]), np.array([0.6, 0.7]))["auc"] is None


def test_losses_stay_finite_for_certain_wrong_predictions():
    losses = match_losses(np.array([1, 0]), np.array([0.0, 1.0]))

    assert np.isfinite(losses).all()


def test_identical_predictions_give_a_zero_interval():
    rng = np.random.default_rng(0)
    labels = rng.integers(0, 2, size=500)
    probabilities = rng.uniform(0.2, 0.8, size=500)

    result = paired_bootstrap(labels, probabilities, probabilities)

    assert result == {"difference": 0.0, "low": 0.0, "high": 0.0}


def test_a_model_better_by_the_same_amount_on_every_match_gets_that_exact_interval():
    labels = np.ones(300, dtype=int)
    reference = np.full(300, 0.5)
    model = np.full(300, 0.6)
    gap = math.log(0.6) - math.log(0.5)

    result = paired_bootstrap(labels, reference, model)

    assert result["difference"] == pytest.approx(gap)
    assert result["low"] == pytest.approx(gap)
    assert result["high"] == pytest.approx(gap)


def test_a_noisy_but_real_improvement_has_an_interval_above_zero_that_contains_the_mean():
    rng = np.random.default_rng(1)
    truth = rng.uniform(0.3, 0.7, size=4000)
    labels = (rng.uniform(size=4000) < truth).astype(int)

    result = paired_bootstrap(labels, np.full(4000, 0.5), truth, seed=3)

    assert 0 < result["low"] < result["difference"] < result["high"]
    assert result == paired_bootstrap(labels, np.full(4000, 0.5), truth, seed=3)


def test_calibration_table_bins_predictions_and_reports_observed_rates():
    labels = np.array([0, 1, 1, 1])
    probabilities = np.array([0.05, 0.15, 0.95, 1.0])

    table = calibration_table(labels, probabilities, bins=10)

    assert len(table) == 10
    assert table[0]["matches"] == 1 and table[0]["observed"] == 0
    assert table[1]["matches"] == 1 and table[1]["observed"] == 1
    assert table[9]["matches"] == 2 and table[9]["predicted"] == pytest.approx(0.975)
    assert table[5]["matches"] == 0 and table[5]["predicted"] is None
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_metrics.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.metrics'`

- [ ] **Step 3: Implement**

Create `ml/win/metrics.py`:

```python
"""Scores for probabilities of a blue win, and the paired bootstrap that decides between two models."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.metrics import roc_auc_score

EPSILON = 1e-15
BOOTSTRAP_RESAMPLES = 2000
BOOTSTRAP_CHUNK = 200


def match_losses(labels: np.ndarray, probabilities: np.ndarray) -> np.ndarray:
    """Log loss of each match on its own."""
    clipped = np.clip(probabilities, EPSILON, 1 - EPSILON)
    return -(labels * np.log(clipped) + (1 - labels) * np.log(1 - clipped))


def summary(labels: np.ndarray, probabilities: np.ndarray) -> dict[str, Any]:
    both_outcomes = len(np.unique(labels)) == 2
    return {
        "matches": int(len(labels)),
        "log_loss": float(match_losses(labels, probabilities).mean()),
        "auc": float(roc_auc_score(labels, probabilities)) if both_outcomes else None,
        "accuracy": float(((probabilities >= 0.5) == (labels == 1)).mean()),
    }


def paired_bootstrap(
    labels: np.ndarray,
    reference: np.ndarray,
    model: np.ndarray,
    *,
    resamples: int = BOOTSTRAP_RESAMPLES,
    seed: int = 0,
) -> dict[str, float]:
    """Log loss of `reference` minus log loss of `model`, with a 95 % interval.

    Both are resampled on the same matches, so the interval reflects how much the gap
    itself varies. A positive difference means the model is better.
    """
    differences = match_losses(labels, reference) - match_losses(labels, model)
    rng = np.random.default_rng(seed)
    means = []
    remaining = resamples
    while remaining:
        size = min(BOOTSTRAP_CHUNK, remaining)
        draws = rng.integers(0, len(differences), size=(size, len(differences)))
        means.append(differences[draws].mean(axis=1))
        remaining -= size
    samples = np.concatenate(means)
    return {
        "difference": float(differences.mean()),
        "low": float(np.percentile(samples, 2.5)),
        "high": float(np.percentile(samples, 97.5)),
    }


def calibration_table(labels: np.ndarray, probabilities: np.ndarray, bins: int = 10) -> list[dict[str, Any]]:
    """Predicted against observed blue win rate, in equal-width probability bins."""
    edges = np.linspace(0, 1, bins + 1)
    indices = np.clip(np.digitize(probabilities, edges[1:-1]), 0, bins - 1)
    table = []
    for index in range(bins):
        in_bin = indices == index
        count = int(in_bin.sum())
        table.append(
            {
                "low": float(edges[index]),
                "high": float(edges[index + 1]),
                "matches": count,
                "predicted": float(probabilities[in_bin].mean()) if count else None,
                "observed": float(labels[in_bin].mean()) if count else None,
            }
        )
    return table
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_win_metrics.py -q`
Expected: `7 passed`

Run: `python -m pytest test/ml -q`
Expected: `100 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/win/metrics.py test/ml/test_win_metrics.py
git commit -m "feat: score win probabilities and bootstrap the gap between two models" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: The references

**Files:**
- Create: `ml/win/baselines.py`, `test/ml/test_win_baselines.py`
- Modify: `test/ml/win_fixtures.py` (append)

The engine port must reproduce `src/lib/recommendation/engine.ts` and `counter.ts` for a user with no champion pool. The tests pin it with the numbers those TypeScript tests use: orianna scores 74.05 and ahri 63.15 when the enemy has picked zed. The site ranks a role's statistics by win rate, so the port does too. It also reads the real `supabase/seed.sql`: 172 champions, 725 counter relations.

- [ ] **Step 1: Append the seed file writer**

At the end of `test/ml/win_fixtures.py`, append:

```python
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
```

- [ ] **Step 2: Write the failing tests**

Create `test/ml/test_win_baselines.py`:

```python
import math

import numpy as np
import pytest

from ml.paths import SEED_SQL_PATH
from ml.win.baselines import (
    RateTables,
    References,
    ScoreCalibration,
    SeedDataError,
    champion_total,
    champions_missing_from_engine,
    engine_scores,
    engine_weights,
    load_engine_data,
    meta_score,
    score_counter,
)
from ml.win.encoding import swap_sides
from ml.win.metrics import summary
from win_fixtures import random_drafts, write_seed_sql

# The fixtures of src/lib/recommendation/counter.test.ts: zed is countered by galio; diana by zed.
COUNTER_RELATIONS = {("zed", "galio"), ("diana", "zed")}


def test_score_counter_matches_the_site_engine_cases():
    assert score_counter("galio", [], COUNTER_RELATIONS) == 50
    assert score_counter("galio", ["orianna"], COUNTER_RELATIONS) == 50
    assert score_counter("galio", ["zed"], COUNTER_RELATIONS) == 85
    assert score_counter("diana", ["zed"], COUNTER_RELATIONS) == 15
    # A known edge is diluted by an enemy with no known relation.
    assert score_counter("galio", ["zed", "orianna"], COUNTER_RELATIONS) == 67.5


def test_engine_weights_match_compute_weights_without_a_pool():
    assert engine_weights(False) == pytest.approx((0.95, 0.05, 0.0))
    assert engine_weights(True) == pytest.approx((0.57, 0.03, 0.40))


def test_meta_score_matches_the_site_formula_and_clamps():
    assert meta_score(1, 3) == 100
    assert meta_score(2, 3) == pytest.approx(70)
    assert meta_score(8, 3) == 0


def engine_fixture(tmp_path):
    # The counter fixtures of src/lib/recommendation/engine.test.ts: ahri, orianna, zed ranked 1, 2, 3 in mid;
    # zed is countered by orianna, ahri is countered by zed. Rows are out of order on purpose: rank comes
    # from win rate, as on the site.
    seed = write_seed_sql(
        tmp_path / "seed.sql",
        champions={"ahri": 103, "orianna": 61, "zed": 238, "garen": 86},
        stats=[("zed", "mid", 50.0), ("ahri", "mid", 52.0), ("orianna", "mid", 51.0), ("garen", "top", 50.0)],
        relations=[("zed", "orianna", "mid"), ("ahri", "zed", "mid")],
    )
    return load_engine_data(seed)


def test_champion_totals_reproduce_the_engine_test_scores(tmp_path):
    data = engine_fixture(tmp_path)

    # engine.test.ts: "orianna 74.05 against ahri 63.15" when the enemy has picked zed.
    assert champion_total("orianna", "mid", ["zed"], data) == pytest.approx(74.05)
    assert champion_total("ahri", "mid", ["zed"], data) == pytest.approx(63.15)


def test_ranks_come_from_win_rate_order_within_each_role(tmp_path):
    data = engine_fixture(tmp_path)

    assert data.meta_by_role["mid"] == pytest.approx({"ahri": 100, "orianna": 70, "zed": 40})
    assert data.meta_by_role["top"] == {"garen": 100}
    assert data.slug_by_key[103] == "ahri"


def test_a_champion_missing_from_the_statistics_gets_a_neutral_meta_score(tmp_path):
    data = engine_fixture(tmp_path)

    # 55 * 0.95 + 5 * 0.05, with no enemy known.
    assert champion_total("garen", "mid", [], data) == pytest.approx(52.5)
    assert champion_total(None, "mid", [], data) == pytest.approx(52.5)
    drafts = np.array([[86, 0, 103, 0, 0, 999, 0, 238, 0, 0]])
    assert champions_missing_from_engine(drafts, data) == 1


def test_engine_scores_are_team_differences_and_antisymmetric(tmp_path):
    data = engine_fixture(tmp_path)
    drafts = np.array([[0, 0, 61, 0, 0, 0, 0, 238, 0, 0], [0, 0, 103, 0, 0, 0, 0, 238, 0, 0]])

    scores = engine_scores(drafts, data)

    # Orianna into zed: 74.05 against zed's 40 * 0.57 + 0.15 + 15 * 0.4 = 28.95.
    # Ahri into zed: 63.15 against zed's 40 * 0.57 + 0.15 + 85 * 0.4 = 56.95.
    assert scores == pytest.approx([45.1, 6.2])
    assert np.allclose(engine_scores(swap_sides(drafts), data), -scores)


def test_reads_the_real_seed_file():
    data = load_engine_data(SEED_SQL_PATH)

    assert len(data.slug_by_key) == 172
    assert set(data.meta_by_role) == {"top", "jungle", "mid", "adc", "support"}
    assert sum(len(relations) for relations in data.relations_by_role.values()) == 725


def test_refuses_a_missing_or_empty_seed_file(tmp_path):
    with pytest.raises(SeedDataError):
        load_engine_data(tmp_path / "absent.sql")

    empty = tmp_path / "empty.sql"
    empty.write_text("-- nothing\n", encoding="utf-8")
    with pytest.raises(SeedDataError):
        load_engine_data(empty)


def test_rate_tables_smooth_towards_even_odds():
    drafts = np.array([[101, 0, 0, 0, 0, 102, 0, 0, 0, 0]] * 4)
    labels = np.array([1, 1, 1, 0])

    tables = RateTables(prior_games=20).fit(drafts, labels)

    assert tables.champion[(0, 101)] == pytest.approx(math.log(13 / 11))
    assert tables.champion[(0, 102)] == pytest.approx(math.log(11 / 13))
    assert tables.lane[(0, 101, 102)] == pytest.approx(math.log(13 / 11))
    sums = tables.team_sums(drafts[:1])
    assert sums[0] == pytest.approx([math.log(13 / 11), math.log(11 / 13)])
    assert tables.lane_terms(swap_sides(drafts[:1]))[0, 0] == pytest.approx(-math.log(13 / 11))


def test_score_calibration_maps_scores_to_probabilities():
    rng = np.random.default_rng(0)
    scores = rng.normal(size=3000)
    labels = (rng.uniform(size=3000) < 1 / (1 + np.exp(-2 * scores))).astype(int)

    probabilities = ScoreCalibration().fit(scores, labels).predict(np.array([-3.0, 0.0, 3.0]))

    assert probabilities[0] < 0.05 and probabilities[2] > 0.95
    assert probabilities[1] == pytest.approx(0.5, abs=0.05)


def test_the_win_rate_reference_learns_a_dominant_champion(tmp_path):
    data = engine_fixture(tmp_path)
    rng = np.random.default_rng(0)
    drafts = random_drafts(3000, rng)
    blue_has = (drafts[:, 0] == 101).astype(float) - (drafts[:, 5] == 101).astype(float)
    labels = (rng.uniform(size=3000) < 1 / (1 + np.exp(-2 * blue_has))).astype(int)

    references = References(data).fit(drafts[:2000], labels[:2000])
    predictions = references.predict(drafts[2000:])

    rates = summary(labels[2000:], predictions[References.WIN_RATES])
    engine = summary(labels[2000:], predictions[References.ENGINE])
    assert rates["log_loss"] < engine["log_loss"]
    assert set(predictions) == {References.ENGINE, References.WIN_RATES}
```

- [ ] **Step 3: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_baselines.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.baselines'`

- [ ] **Step 4: Implement**

Create `ml/win/baselines.py`:

```python
"""The two references the model must beat: the site's rule engine and plain champion win rates.

Neither produces a probability. Each gives a draft a score for the blue side, and a
two-parameter logistic calibration fitted on training turns that score into P(blue wins).
"""

from __future__ import annotations

import math
import re
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.linear_model import LogisticRegression

from ml.win.data import ROLES

# --- the site's rule engine (src/lib/recommendation/engine.ts and counter.ts) ---------

NEUTRAL_COUNTER = 50.0
COUNTER_EDGE = 35.0
COUNTER_WEIGHT = 0.4
NO_POOL_PLAYER_SCORE = 5.0
# A champion missing from the 16.3 statistics sits at the middle of the meta scale (10 to 100).
NEUTRAL_META = 55.0
STATS_REGION = "euw"
STATS_TIER = "emerald_plus"

CHAMPION_ROW = re.compile(r"insert into public\.champions \(id, riot_key,[^)]*\) values \('([^']+)', '(\d+)'")
STATS_ROW = re.compile(
    r"insert into public\.champion_stats \(champion_id, role, region, tier, win_rate,[^)]*\) "
    r"values \('([^']+)', '([^']+)', '([^']+)', '([^']+)', ([0-9.]+)"
)
COUNTER_ROW = re.compile(
    r"insert into public\.counter_relations \(champion_id, countered_by_champion_id, role,[^)]*\) "
    r"values \('([^']+)', '([^']+)', '([^']+)'"
)


class SeedDataError(RuntimeError):
    """supabase/seed.sql is missing or does not hold the engine's data."""


@dataclass(frozen=True)
class EngineData:
    slug_by_key: dict[int, str]
    # role -> champion slug -> meta score
    meta_by_role: dict[str, dict[str, float]]
    # role -> {(champion, countered_by)}
    relations_by_role: dict[str, set[tuple[str, str]]]


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def meta_score(rank: int, total: int) -> float:
    return clamp(100 - ((rank - 1) / max(total, 1)) * 90)


def score_counter(champion: str | None, enemy_picks: Sequence[str | None], relations: set[tuple[str, str]]) -> float:
    """`scoreCounter`: +35 per enemy the champion counters, -35 per enemy that counters it, averaged."""
    if not enemy_picks:
        return NEUTRAL_COUNTER
    deltas = []
    for enemy in enemy_picks:
        beats = (enemy, champion) in relations
        loses = (champion, enemy) in relations
        deltas.append(COUNTER_EDGE if beats and not loses else -COUNTER_EDGE if loses and not beats else 0.0)
    return NEUTRAL_COUNTER + sum(deltas) / len(deltas)


def engine_weights(has_enemy: bool) -> tuple[float, float, float]:
    """`computeWeights` for a user with no champion pool: (meta, player, counter)."""
    meta, player = 0.95, 0.05
    counter = COUNTER_WEIGHT if has_enemy else 0.0
    meta *= 1 - counter
    player *= 1 - counter
    total = meta + player + counter
    return meta / total, player / total, counter / total


def load_engine_data(seed_path: Path) -> EngineData:
    if not seed_path.is_file():
        raise SeedDataError(f"{seed_path} est introuvable")
    text = seed_path.read_text(encoding="utf-8")

    slug_by_key = {int(key): slug for slug, key in CHAMPION_ROW.findall(text)}
    win_rates: dict[str, list[tuple[float, str]]] = {}
    for slug, role, region, tier, win_rate in STATS_ROW.findall(text):
        if region == STATS_REGION and tier == STATS_TIER:
            win_rates.setdefault(role, []).append((float(win_rate), slug))
    relations_by_role: dict[str, set[tuple[str, str]]] = {}
    for slug, countered_by, role in COUNTER_ROW.findall(text):
        relations_by_role.setdefault(role, set()).add((slug, countered_by))

    if not slug_by_key or not win_rates:
        raise SeedDataError(f"{seed_path} ne contient ni champions ni statistiques")

    meta_by_role = {}
    for role, rows in win_rates.items():
        # The site orders a role's statistics by win rate and ranks by position.
        ordered = sorted(rows, key=lambda row: (-row[0], row[1]))
        meta_by_role[role] = {slug: meta_score(rank, len(ordered)) for rank, (_, slug) in enumerate(ordered, start=1)}
    return EngineData(slug_by_key, meta_by_role, relations_by_role)


def champion_total(champion: str | None, role: str, enemy_picks: Sequence[str | None], data: EngineData) -> float:
    meta_weight, player_weight, counter_weight = engine_weights(bool(enemy_picks))
    meta = data.meta_by_role.get(role, {}).get(champion, NEUTRAL_META) if champion else NEUTRAL_META
    counter = score_counter(champion, enemy_picks, data.relations_by_role.get(role, set()))
    return meta * meta_weight + NO_POOL_PLAYER_SCORE * player_weight + counter * counter_weight


def engine_scores(drafts: np.ndarray, data: EngineData) -> np.ndarray:
    """Blue team's mean engine score minus red's. A team with no known pick scores as a neutral champion."""
    scores = np.zeros(len(drafts))
    for row, draft in enumerate(drafts):
        team_means = []
        for team_start, enemy_start in ((0, 5), (5, 0)):
            enemies = [data.slug_by_key.get(int(key), f"unknown-{key}") for key in draft[enemy_start : enemy_start + 5] if key]
            totals = [
                champion_total(data.slug_by_key.get(int(key)), ROLES[index], enemies, data)
                for index, key in enumerate(draft[team_start : team_start + 5])
                if key
            ]
            team_means.append(np.mean(totals) if totals else champion_total(None, ROLES[0], enemies, data))
        scores[row] = team_means[0] - team_means[1]
    return scores


def champions_missing_from_engine(drafts: np.ndarray, data: EngineData) -> int:
    """Distinct (role, champion) picks the 16.3 statistics do not rank."""
    missing = set()
    for draft in drafts:
        for index, key in enumerate(draft):
            if key:
                role = ROLES[index % 5]
                if data.slug_by_key.get(int(key)) not in data.meta_by_role.get(role, {}):
                    missing.add((role, int(key)))
    return len(missing)


# --- champion win rates ------------------------------------------------------------

PRIOR_GAMES = 20


class RateTables:
    """Smoothed log-odds of winning, per champion in a role and per lane matchup, learned from drafts."""

    def __init__(self, prior_games: int = PRIOR_GAMES) -> None:
        self.prior_games = prior_games
        self.champion: dict[tuple[int, int], float] = {}
        self.lane: dict[tuple[int, int, int], float] = {}

    def _log_odds(self, wins: float, games: float) -> float:
        rate = (wins + self.prior_games * 0.5) / (games + self.prior_games)
        return math.log(rate / (1 - rate))

    def fit(self, drafts: np.ndarray, labels: np.ndarray) -> RateTables:
        champion_games: Counter = Counter()
        champion_wins: Counter = Counter()
        lane_games: Counter = Counter()
        lane_wins: Counter = Counter()
        for draft, label in zip(drafts, labels):
            for index, key in enumerate(draft):
                if key:
                    champion = (index % 5, int(key))
                    champion_games[champion] += 1
                    champion_wins[champion] += label if index < 5 else 1 - label
            for role in range(5):
                blue, red = int(draft[role]), int(draft[5 + role])
                if blue and red:
                    low, high = min(blue, red), max(blue, red)
                    lane_games[(role, low, high)] += 1
                    lane_wins[(role, low, high)] += label if blue == low else 1 - label
        self.champion = {key: self._log_odds(champion_wins[key], games) for key, games in champion_games.items()}
        self.lane = {key: self._log_odds(lane_wins[key], games) for key, games in lane_games.items()}
        return self

    def team_sums(self, drafts: np.ndarray) -> np.ndarray:
        """Per draft, the summed champion log-odds of the blue team and of the red team."""
        sums = np.zeros((len(drafts), 2))
        for row, draft in enumerate(drafts):
            for index, key in enumerate(draft):
                if key:
                    sums[row, index // 5] += self.champion.get((index % 5, int(key)), 0.0)
        return sums

    def lane_terms(self, drafts: np.ndarray) -> np.ndarray:
        """Per draft and role, the lane matchup log-odds from the blue side (0 if unknown or hidden)."""
        terms = np.zeros((len(drafts), 5))
        for row, draft in enumerate(drafts):
            for role in range(5):
                blue, red = int(draft[role]), int(draft[5 + role])
                if blue and red:
                    value = self.lane.get((role, min(blue, red), max(blue, red)), 0.0)
                    terms[row, role] = value if blue < red else -value
        return terms


class ScoreCalibration:
    """Two-parameter logistic map from a draft score to P(blue wins)."""

    def fit(self, scores: np.ndarray, labels: np.ndarray) -> ScoreCalibration:
        self.model = LogisticRegression(C=1e6, max_iter=1000).fit(scores.reshape(-1, 1), labels)
        return self

    def predict(self, scores: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(scores.reshape(-1, 1))[:, 1]


class References:
    """Both references, fitted on the training drafts."""

    ENGINE = "moteur du site"
    WIN_RATES = "winrates des champions"

    def __init__(self, engine_data: EngineData) -> None:
        self.engine_data = engine_data

    def fit(self, drafts: np.ndarray, labels: np.ndarray) -> References:
        self.rates = RateTables().fit(drafts, labels)
        self.engine_calibration = ScoreCalibration().fit(engine_scores(drafts, self.engine_data), labels)
        self.rate_calibration = ScoreCalibration().fit(self._rate_scores(drafts), labels)
        return self

    def _rate_scores(self, drafts: np.ndarray) -> np.ndarray:
        sums = self.rates.team_sums(drafts)
        return sums[:, 0] - sums[:, 1]

    def predict(self, drafts: np.ndarray) -> dict[str, np.ndarray]:
        return {
            self.ENGINE: self.engine_calibration.predict(engine_scores(drafts, self.engine_data)),
            self.WIN_RATES: self.rate_calibration.predict(self._rate_scores(drafts)),
        }
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest test/ml/test_win_baselines.py -q`
Expected: `12 passed`

Run: `python -m pytest test/ml -q`
Expected: `112 passed`

- [ ] **Step 6: Commit**

```bash
git add ml/win/baselines.py test/ml/win_fixtures.py test/ml/test_win_baselines.py
git commit -m "feat: port the site engine and build the win-rate reference" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: The models and selection

**Files:**
- Create: `ml/win/models.py`, `test/ml/test_win_models.py`

Every model trains on the training drafts plus two masked copies of each. The boosting model's win-rate aggregates are computed out of fold, so no row ever sees its own outcome. The key test plants a synergy that champion win rates cannot see: on it, stage 3 reaches a validation log loss of about 0.48, against 0.61 for stage 1 and for the win-rate reference.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_win_models.py`:

```python
import json

import numpy as np

from ml.win.baselines import References, load_engine_data
from ml.win.data import Dataset
from ml.win.encoding import hide_picks
from ml.win.metrics import summary
from ml.win.models import BoostingDraftModel, LogisticDraftModel, candidate_models, select_model
from win_fixtures import random_drafts, write_seed_sql


def dataset(drafts, labels, tier="GOLD"):
    return Dataset(
        match_ids=np.array([f"EUW1_{index}" for index in range(len(drafts))]),
        drafts=drafts,
        labels=labels,
        tiers=np.array([tier] * len(drafts)),
    )


def synergy_world(count, seed):
    """Wins depend only on whether a team's adc and support are 'matched': both the planted pair, or neither."""
    rng = np.random.default_rng(seed)
    drafts = random_drafts(count, rng, champions_per_role=3)

    def matched(adc, support):
        return np.where((adc == 401) == (support == 501), 1.0, -1.0)

    logit = 1.5 * (matched(drafts[:, 3], drafts[:, 4]) - matched(drafts[:, 8], drafts[:, 9]))
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(np.int64)
    return drafts, labels


def dominant_champion_world(count, seed):
    rng = np.random.default_rng(seed)
    drafts = random_drafts(count, rng)
    logit = 1.5 * ((drafts[:, 0] == 101).astype(float) - (drafts[:, 5] == 101).astype(float))
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(np.int64)
    return drafts, labels


def test_stage_3_recovers_a_planted_synergy_that_champion_win_rates_cannot_see(tmp_path):
    drafts, labels = synergy_world(8000, seed=1)
    train, validation = dataset(drafts[:6000], labels[:6000]), dataset(drafts[6000:], labels[6000:])
    engine = load_engine_data(write_seed_sql(tmp_path / "seed.sql", {"ahri": 103}, [("ahri", "mid", 50.0)]))

    stage_1 = LogisticDraftModel(1, 1.0, seed=0).fit(train)
    stage_3 = LogisticDraftModel(3, 1.0, seed=0).fit(train)
    references = References(engine).fit(train.drafts, train.labels)

    loss_1 = summary(validation.labels, stage_1.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_3 = summary(validation.labels, stage_3.predict(validation.drafts, validation.tiers))["log_loss"]
    loss_rates = summary(validation.labels, references.predict(validation.drafts)[References.WIN_RATES])["log_loss"]

    assert loss_3 < loss_1 - 0.02
    assert loss_3 < loss_rates - 0.02


def test_logistic_model_scores_partial_drafts_and_exports_its_weights():
    drafts, labels = dominant_champion_world(3000, seed=2)
    model = LogisticDraftModel(2, 0.3, seed=0).fit(dataset(drafts, labels))

    partial = hide_picks(drafts[:100], [7] * 100, np.random.default_rng(0))
    probabilities = model.predict(partial, np.array(["GOLD"] * 100))
    assert ((probabilities > 0) & (probabilities < 1)).all()

    weights = json.loads(json.dumps(model.weights()))
    assert weights["stage"] == 2
    assert len(weights["features"]) == len(model.encoder.columns)
    assert model.top_weights(1)[0]["key"] == ["champion", "top", 101]


def test_logistic_model_is_deterministic_for_a_seed():
    drafts, labels = dominant_champion_world(1500, seed=3)
    train = dataset(drafts, labels)

    first = LogisticDraftModel(1, 1.0, seed=5).fit(train).predict(drafts[:50], train.tiers[:50])
    second = LogisticDraftModel(1, 1.0, seed=5).fit(train).predict(drafts[:50], train.tiers[:50])

    assert np.array_equal(first, second)


def test_boosting_model_learns_a_dominant_champion():
    drafts, labels = dominant_champion_world(4000, seed=4)
    train, validation = dataset(drafts[:3000], labels[:3000]), dataset(drafts[3000:], labels[3000:])

    model = BoostingDraftModel({"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}, seed=0)
    probabilities = model.fit(train).predict(validation.drafts, validation.tiers)

    constant = summary(validation.labels, np.full(len(validation), validation.labels.mean()))
    assert summary(validation.labels, probabilities)["log_loss"] < constant["log_loss"] - 0.02


def test_select_model_keeps_the_lowest_validation_log_loss_and_reports_every_candidate():
    drafts, labels = synergy_world(5000, seed=5)
    train, validation = dataset(drafts[:4000], labels[:4000]), dataset(drafts[4000:], labels[4000:])
    candidates = [LogisticDraftModel(1, 1.0, seed=0), LogisticDraftModel(3, 1.0, seed=0)]
    lines = []

    best, rows = select_model(train, validation, candidates, log=lines.append)

    assert best is candidates[1]
    assert [row["model"] for row in rows] == [candidate.name for candidate in candidates]
    assert rows[1]["log_loss"] == min(row["log_loss"] for row in rows)
    assert len(lines) == 2


def test_the_candidate_list_covers_every_stage_and_the_boosting_grid():
    names = [model.name for model in candidate_models(seed=0)]

    assert len(names) == 27
    assert sum("palier 4" in name for name in names) == 6
    assert sum(name.startswith("gradient boosting") for name in names) == 3
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_models.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.models'`

- [ ] **Step 3: Implement**

Create `ml/win/models.py`:

```python
"""The candidate models, and choosing between them on validation log loss."""

from __future__ import annotations

from collections.abc import Callable, Sequence
from typing import Any, Protocol

import numpy as np
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression

from ml.win.baselines import RateTables
from ml.win.data import Dataset
from ml.win.encoding import STAGES, DraftEncoder, with_masked_copies
from ml.win.metrics import summary

MASKED_COPIES = 2
LOGISTIC_C_GRID = (0.003, 0.01, 0.03, 0.1, 0.3, 1.0)
BOOSTING_GRID = (
    {"learning_rate": 0.05, "max_leaf_nodes": 15, "l2_regularization": 1.0},
    {"learning_rate": 0.1, "max_leaf_nodes": 31, "l2_regularization": 1.0},
    {"learning_rate": 0.05, "max_leaf_nodes": 31, "l2_regularization": 10.0},
)
BOOSTING_ITERATIONS = 200
AGGREGATE_FOLDS = 5


class DraftModel(Protocol):
    kind: str
    name: str

    def fit(self, train: Dataset) -> DraftModel: ...

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray: ...


class LogisticDraftModel:
    kind = "logistic"

    def __init__(self, stage: int, c: float, seed: int) -> None:
        self.stage = stage
        self.c = c
        self.seed = seed
        self.name = f"régression logistique, palier {stage}, C={c}"

    def fit(self, train: Dataset) -> LogisticDraftModel:
        rng = np.random.default_rng(self.seed)
        drafts, labels, tiers, _ = with_masked_copies(train.drafts, train.labels, train.tiers, MASKED_COPIES, rng)
        # Columns come from the full drafts only: masked copies must not inflate pair counts.
        self.encoder = DraftEncoder(self.stage).fit(train.drafts, train.tiers)
        self.model = LogisticRegression(C=self.c, max_iter=5000)
        self.model.fit(self.encoder.transform(drafts, tiers), labels)
        return self

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        return self.model.predict_proba(self.encoder.transform(drafts, tiers))[:, 1]

    def weights(self) -> dict[str, Any]:
        """Everything needed to score a draft without scikit-learn: intercept plus one weight per feature key."""
        coefficients = self.model.coef_[0]
        return {
            "stage": self.stage,
            "c": self.c,
            "intercept": float(self.model.intercept_[0]),
            "features": [
                {"key": list(key), "weight": float(coefficients[index])}
                for key, index in sorted(self.encoder.columns.items(), key=lambda item: item[1])
            ],
        }

    def top_weights(self, count: int = 10) -> list[dict[str, Any]]:
        features = self.weights()["features"]
        return sorted(features, key=lambda feature: abs(feature["weight"]), reverse=True)[:count]


def aggregate_features(tables: RateTables, drafts: np.ndarray) -> np.ndarray:
    """Blue and red summed champion log-odds, then the five lane matchup log-odds."""
    return np.hstack([tables.team_sums(drafts), tables.lane_terms(drafts)])


class BoostingDraftModel:
    kind = "boosting"

    def __init__(self, params: dict[str, float], seed: int) -> None:
        self.params = params
        self.seed = seed
        described = ", ".join(f"{key}={value}" for key, value in params.items())
        self.name = f"gradient boosting, {described}"

    def fit(self, train: Dataset) -> BoostingDraftModel:
        rng = np.random.default_rng(self.seed)
        drafts, labels, tiers, origin = with_masked_copies(train.drafts, train.labels, train.tiers, MASKED_COPIES, rng)
        self.encoder = DraftEncoder(1).fit(train.drafts, train.tiers)

        # Out of fold: a row's aggregates come from tables that never saw its own match.
        folds = np.random.default_rng(self.seed).permutation(len(train)) % AGGREGATE_FOLDS
        aggregates = np.zeros((len(drafts), 7))
        for fold in range(AGGREGATE_FOLDS):
            tables = RateTables().fit(train.drafts[folds != fold], train.labels[folds != fold])
            rows = folds[origin] == fold
            aggregates[rows] = aggregate_features(tables, drafts[rows])

        self.tables = RateTables().fit(train.drafts, train.labels)
        self.model = HistGradientBoostingClassifier(
            max_iter=BOOSTING_ITERATIONS, early_stopping=False, random_state=self.seed, **self.params
        )
        self.model.fit(self._matrix(drafts, tiers, aggregates), labels)
        return self

    def _matrix(self, drafts: np.ndarray, tiers: np.ndarray, aggregates: np.ndarray) -> np.ndarray:
        return np.hstack([self.encoder.transform(drafts, tiers).toarray(), aggregates]).astype(np.float32)

    def predict(self, drafts: np.ndarray, tiers: np.ndarray) -> np.ndarray:
        matrix = self._matrix(drafts, tiers, aggregate_features(self.tables, drafts))
        return self.model.predict_proba(matrix)[:, 1]


def candidate_models(seed: int) -> list[DraftModel]:
    logistic: list[DraftModel] = [LogisticDraftModel(stage, c, seed) for stage in STAGES for c in LOGISTIC_C_GRID]
    boosting: list[DraftModel] = [BoostingDraftModel(params, seed) for params in BOOSTING_GRID]
    return logistic + boosting


def select_model(
    train: Dataset,
    validation: Dataset,
    candidates: Sequence[DraftModel],
    log: Callable[[str], None] = print,
) -> tuple[DraftModel, list[dict[str, Any]]]:
    """Fits every candidate on training and keeps the one with the lowest validation log loss."""
    rows: list[dict[str, Any]] = []
    best: DraftModel | None = None
    best_loss = float("inf")
    for model in candidates:
        model.fit(train)
        result = summary(validation.labels, model.predict(validation.drafts, validation.tiers))
        rows.append({"model": model.name, "kind": model.kind, **result})
        log(f"  {model.name} : log loss {result['log_loss']:.4f}")
        if result["log_loss"] < best_loss:
            best, best_loss = model, result["log_loss"]
    assert best is not None, "select_model needs at least one candidate"
    return best, rows
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_win_models.py -q`
Expected: `6 passed` (about 10 seconds)

Run: `python -m pytest test/ml -q`
Expected: `118 passed`

- [ ] **Step 5: Commit**

```bash
git add ml/win/models.py test/ml/test_win_models.py
git commit -m "feat: train logistic stages and gradient boosting and choose on validation" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The select command

**Files:**
- Create: `ml/win/select.py`, `test/ml/win_command_fixtures.py`, `test/ml/test_win_select.py`

`candidates_factory` is injectable so tests run two small candidates instead of the full grid of 27.

- [ ] **Step 1: Write the command helpers**

Create `test/ml/win_command_fixtures.py`:

```python
"""Test helpers for the ml.win commands: a small synthetic world and wrappers that capture output."""

from __future__ import annotations

from pathlib import Path

import numpy as np

from ml.win import select
from ml.win.models import LogisticDraftModel
from win_fixtures import random_drafts, write_database, write_seed_sql


def small_candidates(seed):
    return [LogisticDraftModel(1, 1.0, seed), LogisticDraftModel(2, 1.0, seed)]


def world(tmp_path: Path, count: int = 1500) -> tuple[Path, Path, Path]:
    """A database where champion 101 in top wins more often, engine data that knows none of the drafted champions,
    and the artifacts directory to use."""
    rng = np.random.default_rng(0)
    drafts = random_drafts(count, rng)
    logit = 1.5 * ((drafts[:, 0] == 101).astype(float) - (drafts[:, 5] == 101).astype(float))
    labels = (rng.uniform(size=count) < 1 / (1 + np.exp(-logit))).astype(int)
    db = tmp_path / "matches.sqlite"
    write_database(db, drafts, labels)
    seed_sql = write_seed_sql(tmp_path / "seed.sql", {"garen": 86}, [("garen", "top", 51.0)])
    return db, seed_sql, tmp_path / "win"


def run_select(db, seed_sql, artifacts, candidates=small_candidates):
    lines: list[str] = []
    code = select.main(
        ["--db", str(db), "--artifacts", str(artifacts), "--seed-sql", str(seed_sql)],
        out=lines.append,
        candidates_factory=candidates,
    )
    return code, lines
```

- [ ] **Step 2: Write the failing tests**

Create `test/ml/test_win_select.py`:

```python
import json

import numpy as np

from ml.win.baselines import References
from ml.win.models import BoostingDraftModel
from win_command_fixtures import run_select, small_candidates, world
from win_fixtures import random_drafts, write_database


def test_select_saves_the_split_the_model_its_weights_and_a_validation_report(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)

    code, lines = run_select(db, seed_sql, artifacts)

    assert code == 0
    assert (artifacts / "split.json").is_file()
    assert (artifacts / "model.joblib").is_file()
    weights = json.loads((artifacts / "model_weights.json").read_text(encoding="utf-8"))
    assert weights["stage"] in (1, 2)
    report = json.loads((artifacts / "validation_report.json").read_text(encoding="utf-8"))
    assert [row["model"] for row in report["candidates"]] == [model.name for model in small_candidates(42)]
    assert {row["model"] for row in report["references"]} == {References.ENGINE, References.WIN_RATES}
    assert report["chosen"] in {row["model"] for row in report["candidates"]}
    assert any(line.startswith("Modèle retenu") for line in lines)
    for line in lines:
        line.encode("cp1252")


def test_select_removes_stale_weights_when_boosting_is_chosen(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    artifacts.mkdir()
    (artifacts / "model_weights.json").write_text("{}", encoding="utf-8")

    boosting = {"learning_rate": 0.1, "max_leaf_nodes": 15, "l2_regularization": 1.0}
    code, _ = run_select(db, seed_sql, artifacts, candidates=lambda seed: [BoostingDraftModel(boosting, seed)])

    assert code == 0
    assert not (artifacts / "model_weights.json").exists()


def test_select_exit_codes_for_a_missing_database_an_unusable_one_and_missing_engine_data(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)

    assert run_select(tmp_path / "absent.sqlite", seed_sql, artifacts)[0] == 2

    small = tmp_path / "small.sqlite"
    write_database(small, random_drafts(20, np.random.default_rng(1)), np.ones(20, dtype=int))
    assert run_select(small, seed_sql, artifacts)[0] == 3

    assert run_select(db, tmp_path / "absent.sql", artifacts)[0] == 4
    assert not (artifacts / "model.joblib").exists()
```

- [ ] **Step 3: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_select.py -q`
Expected: FAIL, `ModuleNotFoundError: No module named 'ml.win.select'`

- [ ] **Step 4: Implement**

Create `ml/win/select.py`:

```python
"""Command: python -m ml.win.select --db <matches.sqlite> [--seed 42]

Splits the matches, trains every candidate on the training set, chooses on validation, and
saves the chosen model with a validation report. The test set is never evaluated here:
that is ml.win.test, which runs once.

Exit codes:
  0  finished
  2  invalid arguments, or the database does not exist
  3  the database is unusable (several patches, or too few matches)
  4  supabase/seed.sql is missing or unreadable
  5  the test set has already been evaluated, so choosing again is refused
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from pathlib import Path

import joblib

from ml.paths import SEED_SQL_PATH, WIN_ARTIFACT_DIR
from ml.win.baselines import References, SeedDataError, champions_missing_from_engine, load_engine_data
from ml.win.data import (
    DatasetRejected,
    MissingDatabaseError,
    load_matches,
    split_matches,
    subset,
    to_dataset,
    write_split,
)
from ml.win.metrics import summary
from ml.win.models import DraftModel, LogisticDraftModel, candidate_models, select_model

SPLIT_FILE = "split.json"
MODEL_FILE = "model.joblib"
WEIGHTS_FILE = "model_weights.json"
VALIDATION_REPORT_FILE = "validation_report.json"
TEST_REPORT_FILE = "test_report.json"


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Entraîne les modèles de victoire et choisit le meilleur sur la validation.")
    parser.add_argument("--db", required=True, help="base SQLite de la collecte")
    parser.add_argument("--seed", type=int, default=42, help="graine du découpage et du masquage")
    parser.add_argument("--artifacts", default=str(WIN_ARTIFACT_DIR), help="dossier des fichiers produits")
    parser.add_argument("--seed-sql", default=str(SEED_SQL_PATH), help="données du moteur du site")
    return parser.parse_args(argv)


def main(
    argv: Sequence[str] | None = None,
    *,
    out: Callable[[str], None] = print,
    candidates_factory: Callable[[int], Sequence[DraftModel]] = candidate_models,
) -> int:
    args = parse_args(argv)
    artifacts = Path(args.artifacts)

    if (artifacts / TEST_REPORT_FILE).is_file():
        out("Le jeu de test a déjà été évalué : choisir un nouveau modèle maintenant fausserait le résultat.")
        out(f"Pour tout recommencer volontairement, supprime le dossier {artifacts}.")
        return 5

    try:
        frame = load_matches(args.db)
    except MissingDatabaseError:
        out(f"Base introuvable : {args.db}")
        return 2
    except DatasetRejected as error:
        out(f"Base inutilisable : {error}.")
        return 3

    try:
        engine_data = load_engine_data(Path(args.seed_sql))
    except SeedDataError as error:
        out(f"Données du moteur illisibles : {error}.")
        return 4

    patch = str(frame["patch"].iloc[0])
    split = split_matches(frame, args.seed)
    write_split(artifacts / SPLIT_FILE, split, seed=args.seed, patch=patch, db_path=Path(args.db).resolve())
    train = to_dataset(subset(frame, split.train))
    validation = to_dataset(subset(frame, split.validation))
    out(
        f"Patch {patch} : {len(train)} parties d'entraînement, {len(validation)} de validation, "
        f"{len(split.test)} de test mises de côté."
    )

    out("Modèles candidats (log loss de validation) :")
    best, rows = select_model(train, validation, candidates_factory(args.seed), log=out)

    references = References(engine_data).fit(train.drafts, train.labels)
    reference_rows = [
        {"model": name, "kind": "reference", **summary(validation.labels, probabilities)}
        for name, probabilities in references.predict(validation.drafts).items()
    ]
    out("Références :")
    for row in reference_rows:
        out(f"  {row['model']} : log loss {row['log_loss']:.4f}")

    report = {
        "patch": patch,
        "seed": args.seed,
        "chosen": best.name,
        "candidates": rows,
        "references": reference_rows,
        "missing_from_engine": champions_missing_from_engine(train.drafts, engine_data),
    }
    (artifacts / VALIDATION_REPORT_FILE).write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")
    joblib.dump({"model": best, "patch": patch, "seed": args.seed}, artifacts / MODEL_FILE)

    weights_path = artifacts / WEIGHTS_FILE
    if isinstance(best, LogisticDraftModel):
        weights_path.write_text(json.dumps(best.weights()), encoding="utf-8")
    elif weights_path.exists():
        weights_path.unlink()

    out(f"Modèle retenu : {best.name}")
    out("Évaluation finale, une seule fois : python -m ml.win.test")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the tests**

Run: `python -m pytest test/ml/test_win_select.py -q`
Expected: `3 passed`

Run: `python -m pytest test/ml -q`
Expected: `121 passed`

Run: `python -m ml.win.select --db ml/artifacts/absent.sqlite; "EXIT=$LASTEXITCODE"`
Expected: in PowerShell, `Base introuvable : ml/artifacts/absent.sqlite` then `EXIT=2`, no traceback, and no `ml/artifacts/win/` directory created

- [ ] **Step 6: Commit**

```bash
git add ml/win/select.py test/ml/win_command_fixtures.py test/ml/test_win_select.py
git commit -m "feat: add the command that trains and chooses the win model" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 8: The test command

**Files:**
- Create: `ml/win/test.py`, `test/ml/test_win_test_command.py`

The module is named `test.py` so the command reads `python -m ml.win.test`. pytest only collects files named `test_*.py`, so it does not pick this module up. The saved report is the lock: while it exists, the command prints it again and recomputes nothing, and `ml.win.select` refuses to choose again.

- [ ] **Step 1: Write the failing tests**

Create `test/ml/test_win_test_command.py`:

```python
import json
import sqlite3
from contextlib import closing

from ml.win import test
from ml.win.baselines import References
from win_command_fixtures import run_select, world


def run_test(artifacts, seed_sql, now=lambda: "2026-09-20T10:00:00"):
    lines = []
    code = test.main(["--artifacts", str(artifacts), "--seed-sql", str(seed_sql)], out=lines.append, now=now)
    return code, lines


def test_test_refuses_to_run_before_a_model_is_chosen(tmp_path):
    _, seed_sql, artifacts = world(tmp_path)

    code, lines = run_test(artifacts, seed_sql)

    assert code == 5
    assert "ml.win.select" in lines[0]


def test_test_evaluates_once_then_only_prints_the_saved_report(tmp_path):
    # Enough test matches for the gap over the engine reference to be significant.
    db, seed_sql, artifacts = world(tmp_path, count=3000)
    run_select(db, seed_sql, artifacts)

    code, lines = run_test(artifacts, seed_sql)

    assert code == 0
    report_path = artifacts / "test_report.json"
    saved = report_path.read_bytes()
    report = json.loads(saved.decode("utf-8"))
    assert report["date"] == "2026-09-20T10:00:00"
    assert set(report["comparisons"]) == {References.ENGINE, References.WIN_RATES}
    assert set(report["partial_drafts"]) == {"3", "5", "8"}
    assert set(report["by_tier_group"]) == {"iron-silver", "gold-emerald", "diamond-plus"}
    assert len(report["calibration"]) == 10
    assert report["top_weights"][0]["key"] == ["champion", "top", 101]
    assert report["comparisons"][References.ENGINE]["low"] > 0
    assert report["missing_from_engine"] == 30  # 6 champions in each of 5 roles
    assert lines[-1].startswith("Verdict")
    for line in lines:
        line.encode("cp1252")

    def fail():
        raise AssertionError("the saved report must not be recomputed")

    code, lines = run_test(artifacts, seed_sql, now=fail)

    assert code == 0
    assert "déjà été évalué le 2026-09-20T10:00:00" in lines[0]
    assert report_path.read_bytes() == saved


def test_select_refuses_to_choose_again_once_the_test_set_has_been_evaluated(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    run_select(db, seed_sql, artifacts)
    run_test(artifacts, seed_sql)
    model_before = (artifacts / "model.joblib").read_bytes()

    code, lines = run_select(db, seed_sql, artifacts)

    assert code == 5
    assert "déjà été évalué" in lines[0]
    assert (artifacts / "model.joblib").read_bytes() == model_before


def test_test_refuses_a_database_that_lost_test_matches(tmp_path):
    db, seed_sql, artifacts = world(tmp_path)
    run_select(db, seed_sql, artifacts)
    test_ids = json.loads((artifacts / "split.json").read_text(encoding="utf-8"))["test"]
    with closing(sqlite3.connect(str(db))) as connection:
        connection.execute("delete from matches where match_id = ?", (test_ids[0],))
        connection.commit()

    code, lines = run_test(artifacts, seed_sql)

    assert code == 3
    assert "absentes" in lines[0]
    assert not (artifacts / "test_report.json").exists()
```

- [ ] **Step 2: Run to verify they fail**

Run: `python -m pytest test/ml/test_win_test_command.py -q`
Expected: FAIL, `ImportError: cannot import name 'test' from 'ml.win'`

- [ ] **Step 3: Implement**

Create `ml/win/test.py`:

```python
"""Command: python -m ml.win.test

Evaluates the chosen model and both references on the test set, once. The report is saved
with its date; while it exists, this command prints it again and recomputes nothing.

Exit codes:
  0  finished, or the saved report was printed
  2  the database recorded by ml.win.select no longer exists
  3  the database no longer holds the recorded patch or every test match
  4  supabase/seed.sql is missing or unreadable
  5  ml.win.select has not produced a model yet
"""

from __future__ import annotations

import argparse
import json
import sys
from collections.abc import Callable, Sequence
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import numpy as np

from ml.paths import SEED_SQL_PATH, WIN_ARTIFACT_DIR
from ml.win.baselines import References, SeedDataError, champions_missing_from_engine, load_engine_data
from ml.win.data import DatasetRejected, MissingDatabaseError, load_matches, read_split, subset, to_dataset
from ml.win.encoding import PICKS, TIER_GROUPS, hide_picks
from ml.win.metrics import calibration_table, paired_bootstrap, summary
from ml.win.models import LogisticDraftModel
from ml.win.select import MODEL_FILE, SPLIT_FILE, TEST_REPORT_FILE

PARTIAL_KNOWN_PICKS = (3, 5, 8)


def parse_args(argv: Sequence[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Évalue une seule fois le modèle retenu sur le jeu de test.")
    parser.add_argument("--artifacts", default=str(WIN_ARTIFACT_DIR), help="dossier des fichiers produits")
    parser.add_argument("--seed-sql", default=str(SEED_SQL_PATH), help="données du moteur du site")
    return parser.parse_args(argv)


def unseen_champions(train: np.ndarray, test: np.ndarray) -> int:
    """Distinct (role, champion) picks of the test set never seen in training."""

    def picks(drafts: np.ndarray) -> set[tuple[int, int]]:
        return {(index % 5, int(key)) for draft in drafts for index, key in enumerate(draft) if key}

    return len(picks(test) - picks(train))


def fmt(value: float | None, pattern: str) -> str:
    return "n/a" if value is None else format(value, pattern)


def print_report(report: dict[str, Any], out: Callable[[str], None]) -> None:
    out(f"Patch {report['patch']}, {report['matches']} parties de test, modèle : {report['chosen']}")
    rows = [("modèle", report["model"])] + list(report["references"].items())
    for name, result in rows:
        out(
            f"  {name} : log loss {result['log_loss']:.4f}, AUC {fmt(result['auc'], '.4f')}, "
            f"précision {fmt(result['accuracy'], '.1%')}"
        )
    for name, comparison in report["comparisons"].items():
        out(
            f"  écart avec {name} : {comparison['difference']:+.4f} "
            f"(IC 95 % de {comparison['low']:+.4f} à {comparison['high']:+.4f})"
        )
    if report["beats_references"]:
        out("Verdict : le modèle bat les deux références.")
    else:
        out("Verdict : le modèle ne bat pas les deux références.")


def evaluate(model: Any, references: References, train: Any, test: Any, seed: int) -> dict[str, Any]:
    model_probabilities = model.predict(test.drafts, test.tiers)
    reference_probabilities = references.predict(test.drafts)

    by_tier_group = {}
    groups = np.array([TIER_GROUPS[tier] for tier in test.tiers])
    for group in sorted(set(groups)):
        in_group = groups == group
        by_tier_group[group] = {"model": summary(test.labels[in_group], model_probabilities[in_group])}
        for name, probabilities in reference_probabilities.items():
            by_tier_group[group][name] = summary(test.labels[in_group], probabilities[in_group])

    partial_drafts = {}
    rng = np.random.default_rng(seed)
    for known in PARTIAL_KNOWN_PICKS:
        hidden = hide_picks(test.drafts, [PICKS - known] * len(test), rng)
        partial_drafts[str(known)] = {"model": summary(test.labels, model.predict(hidden, test.tiers))}
        for name, probabilities in references.predict(hidden).items():
            partial_drafts[str(known)][name] = summary(test.labels, probabilities)

    comparisons = {
        name: paired_bootstrap(test.labels, probabilities, model_probabilities, seed=seed)
        for name, probabilities in reference_probabilities.items()
    }
    return {
        "chosen": model.name,
        "matches": len(test),
        "model": summary(test.labels, model_probabilities),
        "references": {name: summary(test.labels, probabilities) for name, probabilities in reference_probabilities.items()},
        "comparisons": comparisons,
        "beats_references": all(comparison["low"] > 0 for comparison in comparisons.values()),
        "by_tier_group": by_tier_group,
        "partial_drafts": partial_drafts,
        "calibration": calibration_table(test.labels, model_probabilities),
        "unseen_champions": unseen_champions(train.drafts, test.drafts),
        "missing_from_engine": champions_missing_from_engine(test.drafts, references.engine_data),
        "top_weights": model.top_weights() if isinstance(model, LogisticDraftModel) else None,
    }


def main(
    argv: Sequence[str] | None = None,
    *,
    out: Callable[[str], None] = print,
    now: Callable[[], str] = lambda: datetime.now().isoformat(timespec="seconds"),
) -> int:
    args = parse_args(argv)
    artifacts = Path(args.artifacts)
    report_path = artifacts / TEST_REPORT_FILE

    if report_path.is_file():
        report = json.loads(report_path.read_text(encoding="utf-8"))
        out(f"Le jeu de test a déjà été évalué le {report['date']}. Résultat enregistré, rien n'est recalculé :")
        print_report(report, out)
        return 0

    if not (artifacts / MODEL_FILE).is_file() or not (artifacts / SPLIT_FILE).is_file():
        out("Aucun modèle retenu : lance d'abord python -m ml.win.select --db <base>.")
        return 5

    split, meta = read_split(artifacts / SPLIT_FILE)
    try:
        frame = load_matches(meta["db"], min_matches=0)
        if str(frame["patch"].iloc[0]) != meta["patch"]:
            raise DatasetRejected(f"la base ne contient plus le patch {meta['patch']}")
        train = to_dataset(subset(frame, split.train))
        test = to_dataset(subset(frame, split.test))
    except MissingDatabaseError:
        out(f"Base introuvable : {meta['db']}")
        return 2
    except DatasetRejected as error:
        out(f"Base inutilisable : {error}.")
        return 3

    try:
        engine_data = load_engine_data(Path(args.seed_sql))
    except SeedDataError as error:
        out(f"Données du moteur illisibles : {error}.")
        return 4

    model = joblib.load(artifacts / MODEL_FILE)["model"]
    references = References(engine_data).fit(train.drafts, train.labels)
    report = {"date": now(), "patch": meta["patch"], **evaluate(model, references, train, test, meta["seed"])}
    report_path.write_text(json.dumps(report, indent=1, ensure_ascii=False), encoding="utf-8")

    print_report(report, out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run the tests**

Run: `python -m pytest test/ml/test_win_test_command.py -q`
Expected: `4 passed`

Run: `python -m pytest test/ml -q`
Expected: `125 passed`

Run: `python -m ml.win.test --artifacts ml/artifacts/win-absent; "EXIT=$LASTEXITCODE"`
Expected: in PowerShell, `Aucun modèle retenu : lance d'abord python -m ml.win.select --db <base>.` then `EXIT=5`, no traceback

- [ ] **Step 5: Commit**

```bash
git add ml/win/test.py test/ml/test_win_test_command.py
git commit -m "feat: add the one-time test evaluation of the win model" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 9: Documentation

**Files:**
- Modify: `ml/README.md`, `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md`

- [ ] **Step 1: Document the commands**

At the end of `ml/README.md`, append:

````markdown
## Win Model

Trains a win-probability model on the ranked matches collected by `ml.collect`, and compares it with the site's rule engine and plain champion win rates. Design: `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md`.

```powershell
python -m ml.win.select --db "$env:LOCALAPPDATA\DraftForMe\matches.sqlite"
python -m ml.win.test
```

`ml.win.select` splits the matches, trains every candidate and keeps the best on validation. It can be run again freely until `ml.win.test` has been run. `ml.win.test` evaluates the test set once; afterwards it only prints the saved report, and `ml.win.select` refuses to choose a new model. Starting over means deleting `ml/artifacts/win/` deliberately.
````

- [ ] **Step 2: Record the deviations in the spec**

In `docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md`:

1. In **Models**, under **A. Logistic regression**, replace `the regularisation strength is chosen from a small grid on validation log loss` with `the regularisation strength C is chosen on validation log loss from 0.003, 0.01, 0.03, 0.1, 0.3 and 1.0`.

2. Replace the commands block

```text
python -m ml.win.select --db <path to matches.sqlite> [--seed 42]
python -m ml.win.test
```

with

```text
python -m ml.win.select --db <path to matches.sqlite> [--seed 42] [--artifacts <dir>] [--seed-sql <path>]
python -m ml.win.test [--artifacts <dir>] [--seed-sql <path>]
```

3. In **Outputs**, replace the line

```markdown
- `split.json`: the match ids of each set, the seed, and the patch.
```

with

```markdown
- `split.json`: the match ids of each set, the seed, the patch, and the database path that `ml.win.test` reads back.
```

4. Replace the paragraph starting with `**The test lock.**` with:

```markdown
**The test lock.** If `test_report.json` exists, `ml.win.test` prints the recorded result and recomputes nothing, and `ml.win.select` refuses to choose a new model, since choosing after seeing the test would bias it. Starting over requires deleting `ml/artifacts/win/` deliberately.
```

5. In the **Error Handling** table, replace the rows for codes 3 and 5 with:

```markdown
| 3 | The database holds more than one patch or fewer than 1,000 matches, or, for `ml.win.test`, no longer holds the recorded patch or every match of the split |
| 5 | `ml.win.test` run before `ml.win.select` has produced a model, or `ml.win.select` run after the test set was evaluated |
```

6. In **Testing**, replace the line starting with `- **Test lock:**` with:

```markdown
- **Test lock:** a second run of `ml.win.test` recomputes nothing, and `ml.win.select` refuses to run once the test has been evaluated.
```

- [ ] **Step 3: Verify and commit**

Run: `python -m pytest test/ml -q`
Expected: `125 passed`

```bash
git add ml/README.md docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md
git commit -m "docs: document the win model commands and record plan deviations" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: The real evaluation (performed by the owner, after the collection)

This task is not delegated. `ml.win.test` can be run only once per model choice, and the decision to run it belongs to the owner. It needs the finished collection database.

- [ ] **Step 1: Choose the model**

In PowerShell, from the repository root, once the collection has finished:

```powershell
python -m ml.win.select --db "$env:LOCALAPPDATA\DraftForMe\matches.sqlite"
```

Expected: the split sizes, one validation log loss per candidate (27 lines), both references, then `Modèle retenu : ...`. A few minutes. It can be rerun freely.

- [ ] **Step 2: Read the validation report before testing**

Open `ml/artifacts/win/validation_report.json` and check that the numbers are sensible. Draft-only prediction is hard, so validation log losses near 0.69 (a coin flip) or a little below are expected; the site engine reference is likely the weakest. Every candidate well above 0.70, or a report listing far fewer matches than collected, points to a problem. If anything looks wrong, stop and investigate before Step 3, because Step 3 cannot be repeated.

- [ ] **Step 3: Evaluate once**

```powershell
python -m ml.win.test
```

Expected: test metrics for the model and both references, both gaps with their 95 % intervals, and a `Verdict :` line.

- [ ] **Step 4: Record the outcome**

Add a `## Results` section at the end of the spec: the date, the chosen model, the test metrics, both intervals, the verdict, and what it means for project 3.

```bash
git add docs/superpowers/specs/2026-09-17-draftforme-win-model-design.md
git commit -m "docs: record the win model test results" -m "Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```
