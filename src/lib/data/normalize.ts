import type { ChampionStats, PlayerPoolEntry } from "@/lib/recommendation/types";

type StatsRow = {
  champion_id: string;
  role: string;
  win_rate: number | null;
  pick_rate: number | null;
  ban_rate: number | null;
  champions: {
    id: string;
    name: string;
  } | null;
};

type PoolRow = {
  champion_id: string;
  confidence: number;
  games: number | null;
  win_rate: number | null;
  champions: {
    id: string;
    name: string;
  } | null;
};

export function mapStatsRowsToChampionStats(rows: StatsRow[]): ChampionStats[] {
  return rows
    .filter((row) => row.champions !== null)
    .map((row, index) => ({
      championId: row.champion_id,
      name: row.champions?.name ?? row.champion_id,
      role: row.role,
      rank: index + 1,
      winRate: row.win_rate,
      pickRate: row.pick_rate,
      banRate: row.ban_rate
    }));
}

export function mapPoolRowsToPlayerPool(rows: PoolRow[]): PlayerPoolEntry[] {
  return rows
    .filter((row) => row.champions !== null)
    .map((row) => ({
      championId: row.champion_id,
      name: row.champions?.name ?? row.champion_id,
      games: row.games,
      winRate: row.win_rate,
      confidence: row.confidence
    }));
}
