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
# Standard blue/red pick order; a draft in progress always hides a suffix of it.
PICK_ORDER = "BRRBBRRBBR"
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
        for draft, tier in zip(drafts, tiers, strict=True):
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
        for row, (draft, tier) in enumerate(zip(drafts, tiers, strict=True)):
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
    """A copy of `drafts` where row i has `hidden_counts[i]` picks hidden, the way a draft in progress
    would: a draft always hides a suffix of `PICK_ORDER`, so hiding `h` picks in total fixes how many
    of them are on each side (2 blue and 3 red for 5 hidden, for instance). Which slots are hidden
    inside each side is still chosen at random, since the pick order does not say which role a pick is.
    """
    result = drafts.copy()
    for row, hidden in zip(result, hidden_counts, strict=True):
        hidden = int(hidden)
        blue_hidden = PICK_ORDER[PICKS - hidden :].count("B")
        red_hidden = hidden - blue_hidden
        blue_slots = rng.choice(5, size=blue_hidden, replace=False)
        red_slots = rng.choice(5, size=red_hidden, replace=False) + 5
        row[np.concatenate([blue_slots, red_slots]).astype(int)] = 0
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
