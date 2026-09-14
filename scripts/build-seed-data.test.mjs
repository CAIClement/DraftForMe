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

  it("skips a counters entry that names the row's own champion", () => {
    const rows = [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: 12.93, ban_rate: 4.08, counters: ["ahri", "kennen"] }
    ];
    const sql = buildSeedLines({
      champions,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "mid", rows }],
      stats: []
    }).join("\n");

    const relationLines = sql.split("\n").filter((line) => line.includes("insert into public.counter_relations"));
    expect(relationLines).toHaveLength(1);
    expect(relationLines[0]).toContain("'ahri', 'kennen', 'mid'");
  });
});

describe("numberOrNull", () => {
  it("writes SQL null, not 0, for an explicit null win_rate", () => {
    const rows = [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: null, pick_rate: 12.93, ban_rate: 4.08, counters: [] }
    ];
    const sql = buildSeedLines({
      champions,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "mid", rows }],
      stats: []
    }).join("\n");

    expect(sql).toMatch(/'ahri', 'mid', 'euw', 'emerald_plus', null, 12\.93, 4\.08, null, 'opgg_cache'/);
  });

  it("writes SQL null, not 0, for an empty-string pick_rate", () => {
    const rows = [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: "", ban_rate: 4.08, counters: [] }
    ];
    const sql = buildSeedLines({
      champions,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "mid", rows }],
      stats: []
    }).join("\n");

    expect(sql).toMatch(/'ahri', 'mid', 'euw', 'emerald_plus', 52\.55, null, 4\.08, null, 'opgg_cache'/);
  });

  it("writes SQL null for a non-numeric ban_rate string", () => {
    const rows = [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: 12.93, ban_rate: "N/A", counters: [] }
    ];
    const sql = buildSeedLines({
      champions,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "mid", rows }],
      stats: []
    }).join("\n");

    expect(sql).toMatch(/'ahri', 'mid', 'euw', 'emerald_plus', 52\.55, 12\.93, null, null, 'opgg_cache'/);
  });

  it("writes SQL null games when games_played is explicitly null in the stats file", () => {
    const statsWithNull = [
      { region: "euw", tier: "emerald_plus", role: "mid", rows: [{ name: "Ahri", games_played: null }] }
    ];
    const sql = buildSeedLines({ champions, tierlists, stats: statsWithNull }).join("\n");

    expect(sql).toMatch(/4\.08, null, 'opgg_cache'/);
  });

  it("writes SQL null games when games_played is an empty string in the stats file", () => {
    const statsWithEmpty = [
      { region: "euw", tier: "emerald_plus", role: "mid", rows: [{ name: "Ahri", games_played: "" }] }
    ];
    const sql = buildSeedLines({ champions, tierlists, stats: statsWithEmpty }).join("\n");

    expect(sql).toMatch(/4\.08, null, 'opgg_cache'/);
  });
});

describe("punctuation in champion names", () => {
  const championsWithKaisa = {
    ...champions,
    "Kai'Sa": { id: "Kaisa", key: "145", image: "cdn/16.3.1/img/champion/Kaisa.png", tags: ["Marksman"] }
  };

  it("escapes the apostrophe in the champions insert literal", () => {
    const sql = buildSeedLines({ champions: championsWithKaisa, tierlists: [], stats: [] }).join("\n");

    expect(sql).toContain("'Kai''Sa'");
  });

  it("derives the row's own champion id from a punctuated name with the apostrophe stripped", () => {
    const rows = [{ rank: 1, name: "Kai'Sa", role: "adc", win_rate: 50.12, pick_rate: 18.5, ban_rate: 2.1, counters: [] }];
    const sql = buildSeedLines({
      champions: championsWithKaisa,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "adc", rows }],
      stats: []
    }).join("\n");

    expect(sql).toContain("'kaisa', 'adc', 'euw', 'emerald_plus'");
  });

  it("normalises a punctuated name inside a counters entry through championIdFromName", () => {
    const rows = [
      { rank: 1, name: "Ahri", slug: "ahri", role: "mid", win_rate: 52.55, pick_rate: 12.93, ban_rate: 4.08, counters: ["Kai'Sa"] }
    ];
    const sql = buildSeedLines({
      champions: championsWithKaisa,
      tierlists: [{ region: "euw", tier: "emerald_plus", role: "mid", rows }],
      stats: []
    }).join("\n");

    expect(sql).toContain(
      "insert into public.counter_relations (champion_id, countered_by_champion_id, role, source) values ('ahri', 'kaisa', 'mid', 'opgg_cache')"
    );
  });
});
