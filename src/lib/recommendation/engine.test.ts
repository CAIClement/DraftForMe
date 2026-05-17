import { describe, expect, it } from "vitest";
import { recommendChampions } from "./engine";
import type { ChampionStats, PlayerPoolEntry } from "./types";

const stats: ChampionStats[] = [
  { championId: "ahri", name: "Ahri", role: "mid", rank: 1, winRate: 52, pickRate: 12, banRate: 4 },
  { championId: "zed", name: "Zed", role: "mid", rank: 2, winRate: 51, pickRate: 10, banRate: 18 },
  { championId: "orianna", name: "Orianna", role: "mid", rank: 8, winRate: 49, pickRate: 7, banRate: 2 }
];

const pool: PlayerPoolEntry[] = [
  { championId: "orianna", name: "Orianna", games: 42, winRate: 61, confidence: 80 }
];

describe("recommendChampions", () => {
  it("excludes banned and already picked champions", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: ["zed"],
      alreadyPickedChampionIds: ["ahri"],
      priority: 50,
      topN: 10
    });

    expect(result.map((r) => r.championId)).toEqual(["orianna"]);
  });

  it("boosts a user's practiced champion when priority is pool-oriented", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 0,
      topN: 1
    });

    expect(result[0].championId).toBe("orianna");
    expect(result[0].explanation.factors.some((factor) => factor.key === "player")).toBe(true);
  });

  it("boosts meta rank when priority is meta-oriented", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 100,
      topN: 1
    });

    expect(result[0].championId).toBe("ahri");
  });

  it("uses matchup data when enemy picks are present", () => {
    const result = recommendChampions({
      stats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      matchups: [
        { championId: "ahri", enemyChampionId: "zed", winRate: 54 },
        { championId: "orianna", enemyChampionId: "zed", winRate: 47 }
      ]
    });

    expect(result[0].championId).toBe("ahri");
    expect(result[0].explanation.summary).toContain("matchup");
  });

  it("reports low confidence when matchup data is missing", () => {
    const result = recommendChampions({
      stats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 1,
      matchups: []
    });

    expect(result[0].explanation.warnings).toContain("Matchup data is incomplete for the current enemy picks.");
  });
});
