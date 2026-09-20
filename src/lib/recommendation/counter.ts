import type { CounterRelation, CounterVerdict, EnemyPick } from "./types";

const NEUTRAL = 50;
const EDGE = 35;
const DIRECT_OPPONENT_WEIGHT = 2;

/**
 * Scores a candidate against the enemy picks using the seeded counter relations.
 *
 * The relation carries no win rate, only direction: `championId` is beaten by
 * `counteredByChampionId`. So a candidate that appears as the counter of an
 * enemy pick gains an edge, and one the enemy counters loses it. Enemy picks
 * with no known relation count as neutral, which dilutes the average rather
 * than being dropped — a single known edge should not read as certainty. The
 * average is weighted: the enemy on `draftingRole` counts twice.
 */
export function scoreCounter(
  championId: string,
  enemyPicks: EnemyPick[],
  relations: CounterRelation[],
  draftingRole?: string
): CounterVerdict {
  if (enemyPicks.length === 0) {
    return { score: NEUTRAL, available: false, beats: [], losesTo: [] };
  }

  const beats: string[] = [];
  const losesTo: string[] = [];

  const weighted = enemyPicks.map((pick) => {
    const candidateCountersEnemy = relations.some(
      (relation) => relation.championId === pick.championId && relation.counteredByChampionId === championId
    );
    const enemyCountersCandidate = relations.some(
      (relation) => relation.championId === championId && relation.counteredByChampionId === pick.championId
    );

    // The lane duel is the one the player is actually about to play. The
    // factor of two is a judgement call, not a measurement -- which is why
    // the engine states it in the factor's own wording.
    const weight = draftingRole !== undefined && pick.role === draftingRole ? DIRECT_OPPONENT_WEIGHT : 1;

    if (candidateCountersEnemy && !enemyCountersCandidate) {
      beats.push(pick.championId);
      return { delta: EDGE, weight };
    }

    if (enemyCountersCandidate && !candidateCountersEnemy) {
      losesTo.push(pick.championId);
      return { delta: -EDGE, weight };
    }

    return { delta: 0, weight };
  });

  const available = beats.length > 0 || losesTo.length > 0;
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const average = weighted.reduce((sum, entry) => sum + entry.delta * entry.weight, 0) / totalWeight;

  return { score: NEUTRAL + average, available, beats, losesTo };
}
