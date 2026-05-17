import { describe, expect, it } from "vitest";
import { championPoolEntrySchema } from "./schema";

describe("championPoolEntrySchema", () => {
  it("accepts a valid champion pool entry", () => {
    const parsed = championPoolEntrySchema.parse({
      championId: "ahri",
      confidence: 75,
      games: 20,
      winRate: 55
    });

    expect(parsed.championId).toBe("ahri");
  });

  it("rejects invalid confidence", () => {
    expect(() =>
      championPoolEntrySchema.parse({
        championId: "ahri",
        confidence: 120
      })
    ).toThrow();
  });
});
