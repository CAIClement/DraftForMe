import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_EXAMPLE } from "./default-example";
import { isRole } from "./roles";

describe("DEFAULT_EXAMPLE", () => {
  it("references champions that exist in the seed, so the example is never empty", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    for (const { championId } of DEFAULT_EXAMPLE.enemyPicks) {
      expect(seed, `${championId} is missing from the seeded champions`).toContain(
        `insert into public.champions (id, riot_key, slug, name, image_url, tags, ddragon_version) values ('${championId}'`
      );
    }
  });

  it("uses a role the stats are seeded for", () => {
    const seed = readFileSync("supabase/seed.sql", "utf8");

    expect(seed).toContain(`'${DEFAULT_EXAMPLE.role}', '${DEFAULT_EXAMPLE.region}', '${DEFAULT_EXAMPLE.tier}'`);
  });

  it("places every enemy on a real lane", () => {
    for (const { championId, role } of DEFAULT_EXAMPLE.enemyPicks) {
      expect(isRole(role), `${championId} sits on ${role}, which is not a lane`).toBe(true);
    }
  });

  // The landing page is the product demo. If nobody faces the drafted role,
  // it silently demonstrates the flat-weighting path instead of the feature.
  it("puts an enemy on the drafted lane", () => {
    const opponent = DEFAULT_EXAMPLE.enemyPicks.find((pick) => pick.role === DEFAULT_EXAMPLE.role);

    expect(opponent).toBeDefined();
  });

  it("places at most one enemy per lane", () => {
    const lanes = DEFAULT_EXAMPLE.enemyPicks.map((pick) => pick.role);

    expect(new Set(lanes).size).toBe(lanes.length);
  });
});
