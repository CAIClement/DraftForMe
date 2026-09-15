import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE } from "./default-example";

describe("DEFAULT_EXAMPLE", () => {
  it("references champions that exist in the seed, so the example is never empty", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    for (const championId of DEFAULT_EXAMPLE.enemyPicks) {
      expect(seed, `${championId} is missing from the seeded champions`).toContain(
        `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values ('${championId}'`
      );
    }
  });

  it("uses a role the stats are seeded for", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    expect(seed).toContain(`'${DEFAULT_EXAMPLE.role}', '${DEFAULT_EXAMPLE.region}', '${DEFAULT_EXAMPLE.tier}'`);
  });
});
