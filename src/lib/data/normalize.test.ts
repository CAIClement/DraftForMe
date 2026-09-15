import { describe, expect, it } from "vitest";
import { mapCounterRelationRows, mapStatsRowsToChampionStats } from "./normalize";

describe("mapStatsRowsToChampionStats", () => {
  it("joins champion rows and stats rows into engine input", () => {
    const result = mapStatsRowsToChampionStats([
      {
        champion_id: "ahri",
        role: "mid",
        win_rate: 52,
        pick_rate: 12,
        ban_rate: 3,
        games: 1000,
        champions: {
          id: "ahri",
          name: "Ahri",
          image_url: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png"
        }
      }
    ]);

    expect(result).toEqual([
      {
        championId: "ahri",
        name: "Ahri",
        imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png",
        role: "mid",
        rank: 1,
        winRate: 52,
        pickRate: 12,
        banRate: 3,
        games: 1000
      }
    ]);
  });

  it("carries the sample size through", () => {
    const [first] = mapStatsRowsToChampionStats([
      {
        champion_id: "ahri",
        role: "mid",
        win_rate: 52,
        pick_rate: 12,
        ban_rate: 4,
        games: 714379,
        champions: { id: "ahri", name: "Ahri", image_url: null }
      }
    ]);

    expect(first.games).toBe(714379);
  });
});

describe("mapCounterRelationRows", () => {
  it("maps rows and preserves the countered-by direction", () => {
    const result = mapCounterRelationRows([
      { champion_id: "zed", countered_by_champion_id: "galio", role: "mid" }
    ]);

    expect(result).toEqual([{ championId: "zed", counteredByChampionId: "galio", role: "mid" }]);
  });
});
