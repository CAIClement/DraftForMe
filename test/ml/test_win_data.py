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
