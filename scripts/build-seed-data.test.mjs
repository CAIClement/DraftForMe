import { describe, expect, it } from "vitest";
import { buildSeedLines } from "./build-seed-data.mjs";

const champions = {
  Ahri: { id: "Ahri", key: "103", image: "cdn/16.3.1/img/champion/Ahri.png", tags: ["Mage"] },
  Kennen: { id: "Kennen", key: "85", image: "cdn/16.3.1/img/champion/Kennen.png", tags: ["Mage"] }
};

const tierlists = [
  {
    region: "euw",
    tier: "emerald_plus",
    role: "mid",
    rows: [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: 12.93, ban_rate: 4.08, counters: ["kennen"] }
    ]
  }
];

const stats = [
  { region: "euw", tier: "emerald_plus", role: "mid", rows: [{ name: "Ahri", games_played: "714379" }] }
];

describe("buildSeedLines", () => {
  it("writes the sample size joined from the stats file", () => {
    const sql = buildSeedLines({ champions, tierlists, stats }).join("\n");

    expect(sql).toContain("insert into public.champion_stats");
    expect(sql).toMatch(/'ahri', 'mid', 'euw', 'emerald_plus', 52\.55, 12\.93, 4\.08, 714379, 'opgg_cache'/);
  });

  it("writes null games when the champion is absent from the stats file", () => {
    const sql = buildSeedLines({ champions, tierlists, stats: [] }).join("\n");

    expect(sql).toMatch(/4\.08, null, 'opgg_cache'/);
  });

  it("emits one counter relation per counters entry, in the countered-by direction", () => {
    const sql = buildSeedLines({ champions, tierlists, stats }).join("\n");

    expect(sql).toContain(
      "insert into public.counter_relations (champion_id, countered_by_champion_id, role, source) values ('ahri', 'kennen', 'mid', 'opgg_cache')"
    );
  });
});
