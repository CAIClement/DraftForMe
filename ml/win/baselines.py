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
    # role -> champion slug -> public win rate (percentage, as parsed from champion_stats)
    win_rate_by_role: dict[str, dict[str, float]]


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
    win_rate_by_role = {}
    for role, rows in win_rates.items():
        # The site orders a role's statistics by win rate and ranks by position. Ties are broken
        # by slug here to keep the port reproducible; the site's own order on ties is undefined,
        # which can shift a tied champion's meta score by about one rank step.
        ordered = sorted(rows, key=lambda row: (-row[0], row[1]))
        meta_by_role[role] = {slug: meta_score(rank, len(ordered)) for rank, (_, slug) in enumerate(ordered, start=1)}
        win_rate_by_role[role] = {slug: rate for rate, slug in rows}
    return EngineData(slug_by_key, meta_by_role, relations_by_role, win_rate_by_role)


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


# --- champion priors from public statistics -----------------------------------------


MIN_RATE = 1e-4


def win_rate_log_odds(win_rate_percentage: float) -> float:
    rate = min(max(win_rate_percentage / 100.0, MIN_RATE), 1 - MIN_RATE)
    return math.log(rate / (1 - rate))


class ChampionPrior:
    """The public win rates every model receives, as six antisymmetric log-odds features per draft.

    Built once from `EngineData` (the same `champion_stats` rows the rule engine reads), so every
    candidate model can be handed the same evidence from millions of games.
    """

    def __init__(self, data: EngineData) -> None:
        self.data = data
        self._cache: dict[tuple, np.ndarray] = {}

    def log_odds(self, champion_key: int, role: str) -> float:
        """Log-odds of the champion's public win rate in `role`.

        Falls back to the mean log-odds across the roles the statistics do rank the champion in
        when `role` is not one of them, then to neutral (0.0) for a champion the statistics never
        rank, an unmapped key, or a hidden pick (`champion_key` 0).
        """
        if not champion_key:
            return 0.0
        slug = self.data.slug_by_key.get(int(champion_key))
        if slug is None:
            return 0.0
        role_rates = self.data.win_rate_by_role.get(role, {})
        if slug in role_rates:
            return win_rate_log_odds(role_rates[slug])
        ranked = [win_rate_log_odds(rates[slug]) for rates in self.data.win_rate_by_role.values() if slug in rates]
        return float(np.mean(ranked)) if ranked else 0.0

    def features(self, drafts: np.ndarray) -> np.ndarray:
        """Per draft: blue minus red log-odds for each of the five roles, then their sum.

        Candidate models are fit repeatedly on byte-identical masked drafts (every stage and C
        value shares the same seed), so the result is cached by the array's shape and bytes. The
        cache returns a copy: callers must not be able to mutate what is stored.
        """
        key = (drafts.shape, drafts.dtype.str, drafts.tobytes())
        cached = self._cache.get(key)
        if cached is None:
            cached = self._compute_features(drafts)
            self._cache[key] = cached
        return cached.copy()

    def _compute_features(self, drafts: np.ndarray) -> np.ndarray:
        result = np.zeros((len(drafts), 6), dtype=np.float64)
        for row, draft in enumerate(drafts):
            for role_index, role in enumerate(ROLES):
                blue = self.log_odds(int(draft[role_index]), role)
                red = self.log_odds(int(draft[5 + role_index]), role)
                result[row, role_index] = blue - red
            result[row, 5] = result[row, :5].sum()
        return result


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
    # A third reference, fitted and predicted separately in ml.win.select/test: a priors-only
    # logistic model (stage 0), using this same off-role fallback. Named here so both commands
    # and their tests share one spelling.
    PRIORS_ONLY = "statistiques publiques seules"

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
