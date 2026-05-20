import { describe, expect, it } from "vitest";
import { mapStatsRowsToChampionStats } from "./normalize";

describe("mapStatsRowsToChampionStats", () => {
  it("joins champion rows and stats rows into engine input", () => {
    const result = mapStatsRowsToChampionStats([
      {
        champion_id: "ahri",
        role: "mid",
        win_rate: 52,
        pick_rate: 12,
        ban_rate: 3,
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
        banRate: 3
      }
    ]);
  });
});
