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
    try:
        with closing(sqlite3.connect(f"{path.resolve().as_uri()}?mode=ro", uri=True)) as db:
            frame = pd.read_sql_query(query, db)
    except (sqlite3.Error, pd.errors.DatabaseError) as error:
        raise DatasetRejected(f"{path} n'est pas une base de collecte lisible ({error})") from error

    if len(frame) == 0:
        raise DatasetRejected("la base ne contient aucune partie")
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
