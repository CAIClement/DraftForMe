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
