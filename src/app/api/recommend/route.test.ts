import { describe, expect, it } from "vitest";
import { recommendationRequestSchema } from "./schema";

describe("recommendationRequestSchema", () => {
  it("accepts a valid guest recommendation request", () => {
    const parsed = recommendationRequestSchema.parse({
      role: "mid",
      region: "euw",
      tier: "emerald_plus",
      enemyPicks: ["zed"],
      bans: [],
      priority: 50
    });

    expect(parsed.role).toBe("mid");
  });

  it("rejects an invalid priority", () => {
    expect(() =>
      recommendationRequestSchema.parse({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [],
        bans: [],
        priority: 101
      })
    ).toThrow();
  });
});
