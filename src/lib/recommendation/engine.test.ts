import { describe, expect, it } from "vitest";
import { recommendChampions } from "./engine";
import type { ChampionStats, CounterRelation, PlayerPoolEntry } from "./types";

const stats: ChampionStats[] = [
  {
    championId: "ahri",
    name: "Ahri",
    imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png",
    role: "mid",
    rank: 1,
    winRate: 52,
    pickRate: 12,
    banRate: 4,
    games: 200000
  },
  {
    championId: "zed",
    name: "Zed",
    imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Zed.png",
    role: "mid",
    rank: 2,
    winRate: 51,
    pickRate: 10,
    banRate: 18,
    games: 150000
  },
  {
    championId: "orianna",
    name: "Orianna",
    imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Orianna.png",
    role: "mid",
    rank: 8,
    winRate: 49,
    pickRate: 7,
    banRate: 2,
    games: 90000
  }
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

  it("preserves champion images on recommendations and alternatives", () => {
    const result = recommendChampions({
      stats,
      playerPool: pool,
      enemyPicks: [],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 100,
      topN: 3
    });

    expect(result[0].championImageUrl).toBe("https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png");
    expect(result[0].explanation.alternatives[0]).toEqual({
      championId: "zed",
      championName: "Zed",
      championImageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Zed.png"
    });
  });
});

const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "orianna", role: "mid" },
  { championId: "ahri", counteredByChampionId: "zed", role: "mid" }
];

// A local fixture with adjacent meta ranks. The shared `stats` fixture puts
// orianna at rank 8 out of 3 champions, which clamps its meta score to 0 — a
// 57-point weighted deficit that no counter edge could overcome, making the
// ranking assertion below untestable against it.
const counterStats: ChampionStats[] = [
  { championId: "ahri", name: "Ahri", role: "mid", rank: 1, winRate: 52, pickRate: 12, banRate: 4, games: 200000 },
  { championId: "orianna", name: "Orianna", role: "mid", rank: 2, winRate: 50, pickRate: 7, banRate: 2, games: 90000 },
  { championId: "zed", name: "Zed", role: "mid", rank: 3, winRate: 51, pickRate: 10, banRate: 18, games: 150000 }
];

describe("counter relations in recommendations", () => {
  function run(enemyPicks: string[]) {
    return recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks,
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 10,
      counterRelations: relations
    });
  }

  it("carries champion facts through to the recommendation", () => {
    const [top] = run([]);

    expect(top.rank).toBeGreaterThan(0);
    expect(top.games).not.toBeUndefined();
    expect(top.totalCandidates).toBe(3);
  });

  it("marks the counter factor unavailable when there are no enemy picks", () => {
    const [top] = run([]);
    const counter = top.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
  });

  it("marks the counter factor unavailable when no relation is known", () => {
    const result = run(["orianna"]);
    const ahri = result.find((entry) => entry.championId === "ahri");
    const counter = ahri?.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
  });

  it("ranks a champion that counters the enemy above one the enemy counters", () => {
    const result = run(["zed"]);
    const orianna = result.findIndex((entry) => entry.championId === "orianna");
    const ahri = result.findIndex((entry) => entry.championId === "ahri");

    // orianna counters zed (counter 85); zed counters ahri (counter 15). Ahri
    // has the better meta rank, so this asserts the matchup can overturn a
    // one-rank meta deficit: orianna 74.05 against ahri 63.15.
    expect(orianna).toBeLessThan(ahri);
  });

  it("gives the countering champion a counter score above neutral", () => {
    const result = run(["zed"]);
    const orianna = result.find((entry) => entry.championId === "orianna");

    expect(orianna?.counterScore).toBeGreaterThan(50);
  });

  // The seeded data has no mutual pair inside a single role, but three exist
  // across roles (kennen/sylas, chogath/masteryi, teemo/zac). A relation from
  // another role must never influence a mid recommendation.
  it("ignores relations belonging to another role", () => {
    const result = recommendChampions({
      stats: counterStats,
      playerPool: [],
      enemyPicks: ["zed"],
      bannedChampionIds: [],
      alreadyPickedChampionIds: [],
      priority: 50,
      topN: 10,
      counterRelations: [{ championId: "zed", counteredByChampionId: "orianna", role: "top" }]
    });
    const orianna = result.find((entry) => entry.championId === "orianna");
    const counter = orianna?.explanation.factors.find((factor) => factor.key === "counter");

    expect(counter?.available).toBe(false);
    expect(orianna?.counterScore).toBe(50);
  });
});
