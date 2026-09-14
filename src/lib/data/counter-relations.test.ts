import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Lane matchups whose outcome is not seriously disputed: the second champion
// beats the first. If `counters` were read backwards, these would invert.
const KNOWN: Array<{ role: string; loser: string; winner: string }> = [
  { role: "top", loser: "fiora", winner: "malphite" },
  { role: "top", loser: "darius", winner: "quinn" }
];

function parseRelations(): Array<{ championId: string; counteredBy: string; role: string }> {
  const sql = readFileSync("supabase/seed.sql", "utf8");
  const pattern =
    /insert into public\.counter_relations \(champion_id, countered_by_champion_id, role, source\) values \('([^']+)', '([^']+)', '([^']+)'/g;

  return [...sql.matchAll(pattern)].map((match) => ({
    championId: match[1],
    counteredBy: match[2],
    role: match[3]
  }));
}

describe("counter relations", () => {
  const relations = parseRelations();

  it("seeds every counter pair from the tierlists", () => {
    expect(relations).toHaveLength(725);
  });

  it("never lists a champion as its own counter", () => {
    expect(relations.filter((relation) => relation.championId === relation.counteredBy)).toHaveLength(0);
  });

  it("points from the champion that loses the lane to the one that wins it", () => {
    for (const { role, loser, winner } of KNOWN) {
      const forward = relations.some(
        (relation) => relation.role === role && relation.championId === loser && relation.counteredBy === winner
      );
      const backward = relations.some(
        (relation) => relation.role === role && relation.championId === winner && relation.counteredBy === loser
      );

      expect(forward, `${winner} should be recorded as countering ${loser} in ${role}`).toBe(true);
      expect(backward, `${loser} must not be recorded as countering ${winner} in ${role}`).toBe(false);
    }
  });
});
