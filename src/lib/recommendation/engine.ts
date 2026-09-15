import { scoreCounter } from "./counter";
import type {
  ChampionStats,
  CounterRelation,
  CounterVerdict,
  PlayerPoolEntry,
  RecommendInput,
  Recommendation
} from "./types";

const MIN_GAMES_FOR_POOL = 10;

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function metaScore(champion: ChampionStats, totalChampions: number): number {
  const total = Math.max(totalChampions, 1);
  return clamp(100 - ((champion.rank - 1) / total) * 90);
}

function playerScore(championId: string, playerPool: PlayerPoolEntry[]): number {
  const entry = playerPool.find((poolEntry) => poolEntry.championId === championId);
  if (!entry) return 5;

  const games = entry.games ?? 0;
  if (games < MIN_GAMES_FOR_POOL) return 5;

  const winRate = entry.winRate ?? 50;
  const confidence = clamp(entry.confidence);
  const winRateBonus = (winRate - 50) * 2;
  const gamesBonus = Math.min(games * 0.6, 35);

  return clamp(20 + winRateBonus + gamesBonus + confidence * 0.25);
}

function computeWeights(priority: number, hasEnemy: boolean, hasPool: boolean) {
  const p = clamp(priority) / 100;
  let meta = 0.05 + p * 0.9;
  let player = 0.95 - p * 0.9;

  if (!hasPool) {
    meta = 0.95;
    player = 0.05;
  }

  const counter = hasEnemy ? 0.4 : 0;
  meta *= 1 - counter;
  player *= 1 - counter;

  const total = meta + player + counter;
  return {
    meta: meta / total,
    player: player / total,
    counter: counter / total
  };
}

function buildSummary(meta: number, player: number, counter: number, hasEnemy: boolean): string {
  const strongest = [
    { key: "meta", score: meta, text: "strong current meta profile" },
    { key: "player", score: player, text: "good fit with your champion pool" },
    { key: "counter", score: counter, text: "useful matchup angle" }
  ].sort((a, b) => b.score - a.score)[0];

  if (hasEnemy) {
    return `Recommended because it has a ${strongest.text} with matchup context included.`;
  }

  return `Recommended because it has a ${strongest.text}.`;
}

// Champion display names, not ids: this string is rendered verbatim in the
// dossier, and `beats`/`losesTo` never reach `Recommendation`, so the surface
// layer has no way to recover a name we drop here.
function counterDetail(counter: CounterVerdict, names: Map<string, string>): string {
  const label = (championId: string) => names.get(championId) ?? championId;
  const parts: string[] = [];
  if (counter.beats.length > 0) parts.push(`Prend l'avantage sur ${counter.beats.map(label).join(", ")}.`);
  if (counter.losesTo.length > 0) parts.push(`En difficulté contre ${counter.losesTo.map(label).join(", ")}.`);
  return parts.join(" ");
}

export function recommendChampions(input: RecommendInput): Recommendation[] {
  const banned = new Set(input.bannedChampionIds);
  const picked = new Set(input.alreadyPickedChampionIds);
  const relations = input.counterRelations ?? [];
  const hasEnemy = input.enemyPicks.length > 0;
  const hasPool = input.playerPool.some((entry) => (entry.games ?? 0) >= MIN_GAMES_FOR_POOL);
  const weights = computeWeights(input.priority, hasEnemy, hasPool);

  const candidates = input.stats.filter(
    (champion) => !banned.has(champion.championId) && !picked.has(champion.championId)
  );

  // Prefer the full champion table when the caller has one. `losesTo` holds
  // enemy picks, and an enemy need not be ranked in the candidate's role -- eight
  // seeded counters are not, so a stats-only map renders their raw slug.
  const names = new Map(
    (input.championNames ?? input.stats.map((champion) => ({ championId: champion.championId, name: champion.name })))
      .map((entry) => [entry.championId, entry.name])
  );

  // Bucket once rather than re-filtering the whole relation list per candidate.
  // Every candidate shares a role in practice, so the filter inside the loop
  // read as though role varied when it does not.
  const relationsByRole = new Map<string, CounterRelation[]>();
  for (const relation of relations) {
    const bucket = relationsByRole.get(relation.role);
    if (bucket) bucket.push(relation);
    else relationsByRole.set(relation.role, [relation]);
  }

  const recommendations = candidates
    .map((champion) => {
      const meta = metaScore(champion, input.stats.length);
      const player = playerScore(champion.championId, input.playerPool);
      const counter = scoreCounter(
        champion.championId,
        input.enemyPicks,
        relationsByRole.get(champion.role) ?? []
      );
      const total = meta * weights.meta + player * weights.player + counter.score * weights.counter;
      const warnings: string[] = [];

      if (hasEnemy && !counter.available) {
        warnings.push("No counter relation is known for the current enemy picks.");
      }

      return {
        championId: champion.championId,
        championName: champion.name,
        championImageUrl: champion.imageUrl,
        totalScore: round(total),
        metaScore: round(meta),
        playerScore: round(player),
        counterScore: round(counter.score),
        rank: champion.rank,
        winRate: champion.winRate,
        pickRate: champion.pickRate,
        banRate: champion.banRate,
        games: champion.games,
        totalRanked: input.stats.length,
        explanation: {
          summary: buildSummary(meta, player, counter.score, hasEnemy),
          factors: [
            {
              key: "meta" as const,
              label: "Force dans le patch",
              score: round(meta),
              weight: round(weights.meta * 100),
              // `rank` is the champion's position in a list the query ordered by
              // win rate, not the blended meta rank the tier list carries, so the
              // wording says winrate rather than letting "rang" imply otherwise.
              detail: `${champion.rank}e sur ${input.stats.length} au winrate en ${champion.role}.`,
              available: true
            },
            {
              key: "player" as const,
              label: "Votre pool",
              score: round(player),
              weight: round(weights.player * 100),
              detail:
                player > 5
                  ? "Ce champion fait partie de vos habitudes."
                  : "Ce champion n'est pas établi dans votre pool.",
              available: hasPool
            },
            {
              key: "counter" as const,
              label: "Matchup",
              score: round(counter.score),
              weight: round(weights.counter * 100),
              // Rendered verbatim by the dossier, so it has to be true in
              // every branch. `available` is false both when no enemy has been
              // picked yet and when enemies are known but no relation covers
              // them; one wording cannot honestly serve both.
              detail: counter.available
                ? counterDetail(counter, names)
                : hasEnemy
                  ? "Le matchup n'a pas pu être évalué : aucun counter connu pour ces picks adverses."
                  : "Ajoutez un pick adverse pour évaluer le matchup.",
              available: counter.available
            }
          ],
          warnings,
          alternatives: []
        }
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, input.topN);

  return recommendations.map((recommendation, index) => ({
    ...recommendation,
    explanation: {
      ...recommendation.explanation,
      alternatives: recommendations
        .filter((_, alternativeIndex) => alternativeIndex !== index)
        .slice(0, 2)
        .map((alternative) => ({
          championId: alternative.championId,
          championName: alternative.championName,
          championImageUrl: alternative.championImageUrl
        }))
    }
  }));
}
