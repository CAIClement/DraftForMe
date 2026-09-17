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
