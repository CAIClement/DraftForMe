import { describe, expect, it } from "vitest";
import { scoreCounter } from "./counter";
import type { CounterRelation } from "./types";

// zed is countered by galio; diana is countered by zed.
const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "galio", role: "mid" },
  { championId: "diana", counteredByChampionId: "zed", role: "mid" }
];

describe("scoreCounter", () => {
  it("is unavailable and neutral when there are no enemy picks", () => {
    const verdict = scoreCounter("galio", [], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("is unavailable when no relation is known for any enemy pick", () => {
    const verdict = scoreCounter("galio", ["orianna"], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("scores above neutral when the candidate counters the enemy", () => {
    const verdict = scoreCounter("galio", ["zed"], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeGreaterThan(50);
    expect(verdict.beats).toEqual(["zed"]);
  });

  it("scores below neutral when the enemy counters the candidate", () => {
    const verdict = scoreCounter("diana", ["zed"], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeLessThan(50);
    expect(verdict.losesTo).toEqual(["zed"]);
  });

  it("averages across enemy picks, so a known edge is diluted by an unknown", () => {
    const both = scoreCounter("galio", ["zed", "orianna"], relations);
    const only = scoreCounter("galio", ["zed"], relations);

    expect(both.available).toBe(true);
    expect(both.score).toBeGreaterThan(50);
    expect(both.score).toBeLessThan(only.score);
  });
});
