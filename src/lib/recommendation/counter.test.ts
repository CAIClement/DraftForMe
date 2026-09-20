import { describe, expect, it } from "vitest";
import { scoreCounter } from "./counter";
import type { CounterRelation } from "./types";

// zed is countered by galio; diana is countered by zed; galio is countered by darius.
const relations: CounterRelation[] = [
  { championId: "zed", counteredByChampionId: "galio", role: "mid" },
  { championId: "diana", counteredByChampionId: "zed", role: "mid" },
  { championId: "galio", counteredByChampionId: "darius", role: "mid" }
];

const mid = (championId: string) => ({ championId, role: "mid" });

describe("scoreCounter", () => {
  it("is unavailable and neutral when there are no enemy picks", () => {
    const verdict = scoreCounter("galio", [], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("is unavailable when no relation is known for any enemy pick", () => {
    const verdict = scoreCounter("galio", [mid("orianna")], relations);

    expect(verdict.available).toBe(false);
    expect(verdict.score).toBe(50);
  });

  it("scores above neutral when the candidate counters the enemy", () => {
    const verdict = scoreCounter("galio", [mid("zed")], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeGreaterThan(50);
    expect(verdict.beats).toEqual(["zed"]);
  });

  it("scores below neutral when the enemy counters the candidate", () => {
    const verdict = scoreCounter("diana", [mid("zed")], relations);

    expect(verdict.available).toBe(true);
    expect(verdict.score).toBeLessThan(50);
    expect(verdict.losesTo).toEqual(["zed"]);
  });

  it("averages across enemy picks, so a known edge is diluted by an unknown", () => {
    const both = scoreCounter("galio", [mid("zed"), mid("orianna")], relations);
    const only = scoreCounter("galio", [mid("zed")], relations);

    expect(both.available).toBe(true);
    expect(both.score).toBeGreaterThan(50);
    expect(both.score).toBeLessThan(only.score);
  });

  // The decisive test. galio beats the enemy mid and loses to the enemy top.
  // Flat, those cancel to exactly neutral. Weighted, the lane opponent wins.
  it("counts the enemy on the drafting role twice", () => {
    const enemies = [
      { championId: "zed", role: "mid" },
      { championId: "darius", role: "top" }
    ];

    expect(scoreCounter("galio", enemies, relations).score).toBe(50);
    expect(scoreCounter("galio", enemies, relations, "mid").score).toBeGreaterThan(50);
  });

  it("falls back to flat weighting when no enemy stands on the drafting role", () => {
    const enemies = [
      { championId: "zed", role: "mid" },
      { championId: "darius", role: "top" }
    ];

    expect(scoreCounter("galio", enemies, relations, "adc").score).toBe(50);
  });

  // One enemy cannot be diluted by itself, so doubling its weight must be a
  // no-op. This is what keeps the single-enemy tests above stable.
  it("is unchanged by the weighting when there is a single enemy", () => {
    const flat = scoreCounter("galio", [mid("zed")], relations);
    const weighted = scoreCounter("galio", [mid("zed")], relations, "mid");

    expect(weighted.score).toBe(flat.score);
  });
});
