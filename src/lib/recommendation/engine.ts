import type {
  ChampionStats,
  Matchup,
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

function counterScore(championId: string, enemyPicks: string[], matchups: Matchup[]): number {
  if (enemyPicks.length === 0) return 50;

  const scores = enemyPicks.map((enemyChampionId) => {
    const matchup = matchups.find(
      (item) => item.championId === championId && item.enemyChampionId === enemyChampionId
    );
    if (!matchup || matchup.winRate === null) return 0;
    return (matchup.winRate - 50) * 4;
  });

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return clamp(50 + average);
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

function hasCompleteMatchupData(championId: string, enemyPicks: string[], matchups: Matchup[]): boolean {
  return enemyPicks.every((enemyChampionId) =>
    matchups.some((item) => item.championId === championId && item.enemyChampionId === enemyChampionId)
  );
}

export function recommendChampions(input: RecommendInput): Recommendation[] {
  const banned = new Set(input.bannedChampionIds);
  const picked = new Set(input.alreadyPickedChampionIds);
  const matchups = input.matchups ?? [];
  const hasEnemy = input.enemyPicks.length > 0;
  const hasPool = input.playerPool.some((entry) => (entry.games ?? 0) >= MIN_GAMES_FOR_POOL);
  const weights = computeWeights(input.priority, hasEnemy, hasPool);

  const recommendations = input.stats
    .filter((champion) => !banned.has(champion.championId) && !picked.has(champion.championId))
    .map((champion) => {
      const meta = metaScore(champion, input.stats.length);
      const player = playerScore(champion.championId, input.playerPool);
      const counter = counterScore(champion.championId, input.enemyPicks, matchups);
      const total = meta * weights.meta + player * weights.player + counter * weights.counter;
      const warnings: string[] = [];

      if (hasEnemy && !hasCompleteMatchupData(champion.championId, input.enemyPicks, matchups)) {
        warnings.push("Matchup data is incomplete for the current enemy picks.");
      }

      return {
        championId: champion.championId,
        championName: champion.name,
        totalScore: round(total),
        metaScore: round(meta),
        playerScore: round(player),
        counterScore: round(counter),
        explanation: {
          summary: buildSummary(meta, player, counter, hasEnemy),
          factors: [
            {
              key: "meta" as const,
              label: "Meta strength",
              score: round(meta),
              weight: round(weights.meta * 100),
              detail: `Rank #${champion.rank} for ${champion.role}.`
            },
            {
              key: "player" as const,
              label: "Personal fit",
              score: round(player),
              weight: round(weights.player * 100),
              detail: player > 5 ? "This champion is represented in your pool." : "This champion is not established in your pool."
            },
            {
              key: "counter" as const,
              label: "Matchup context",
              score: round(counter),
              weight: round(weights.counter * 100),
              detail: hasEnemy ? "Enemy picks are part of this score." : "No enemy picks selected yet."
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
        .map((alternative) => alternative.championName)
    }
  }));
}
