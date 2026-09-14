export type ChampionStats = {
  championId: string;
  name: string;
  imageUrl?: string;
  role: string;
  rank: number;
  winRate: number | null;
  pickRate: number | null;
  banRate: number | null;
};

export type PlayerPoolEntry = {
  championId: string;
  name: string;
  games: number | null;
  winRate: number | null;
  confidence: number;
};

export type Matchup = {
  championId: string;
  enemyChampionId: string;
  winRate: number | null;
};

export type CounterRelation = {
  championId: string;
  counteredByChampionId: string;
  role: string;
};

export type CounterVerdict = {
  score: number;
  available: boolean;
  beats: string[];
  losesTo: string[];
};

export type RecommendationFactor = {
  key: "meta" | "player" | "counter";
  label: string;
  score: number;
  weight: number;
  detail: string;
};

export type RecommendationExplanation = {
  summary: string;
  factors: RecommendationFactor[];
  warnings: string[];
  alternatives: RecommendationAlternative[];
};

export type RecommendationAlternative = {
  championId: string;
  championName: string;
  championImageUrl?: string;
};

export type Recommendation = {
  championId: string;
  championName: string;
  championImageUrl?: string;
  totalScore: number;
  metaScore: number;
  playerScore: number;
  counterScore: number;
  explanation: RecommendationExplanation;
};

export type RecommendInput = {
  stats: ChampionStats[];
  playerPool: PlayerPoolEntry[];
  enemyPicks: string[];
  bannedChampionIds: string[];
  alreadyPickedChampionIds: string[];
  priority: number;
  topN: number;
  matchups?: Matchup[];
};
