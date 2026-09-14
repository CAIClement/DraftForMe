import type { CounterRelation, CounterVerdict } from "./types";

const NEUTRAL = 50;
const EDGE = 35;

/**
 * Scores a candidate against the enemy picks using the seeded counter relations.
 *
 * The relation carries no win rate, only direction: `championId` is beaten by
 * `counteredByChampionId`. So a candidate that appears as the counter of an
 * enemy pick gains an edge, and one the enemy counters loses it. Enemy picks
 * with no known relation count as neutral, which dilutes the average rather
 * than being dropped — a single known edge should not read as certainty.
 */
export function scoreCounter(
  championId: string,
  enemyPicks: string[],
  relations: CounterRelation[]
): CounterVerdict {
  if (enemyPicks.length === 0) {
    return { score: NEUTRAL, available: false, beats: [], losesTo: [] };
  }

  const beats: string[] = [];
  const losesTo: string[] = [];

  const deltas = enemyPicks.map((enemyId) => {
    const candidateCountersEnemy = relations.some(
      (relation) => relation.championId === enemyId && relation.counteredByChampionId === championId
    );
    const enemyCountersCandidate = relations.some(
      (relation) => relation.championId === championId && relation.counteredByChampionId === enemyId
    );

    if (candidateCountersEnemy && !enemyCountersCandidate) {
      beats.push(enemyId);
      return EDGE;
    }

    if (enemyCountersCandidate && !candidateCountersEnemy) {
      losesTo.push(enemyId);
      return -EDGE;
    }

    return 0;
  });

  const available = beats.length > 0 || losesTo.length > 0;
  const average = deltas.reduce((sum, delta) => sum + delta, 0) / deltas.length;

  return { score: NEUTRAL + average, available, beats, losesTo };
}
