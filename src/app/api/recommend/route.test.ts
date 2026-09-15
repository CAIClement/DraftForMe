import { describe, expect, it, vi } from "vitest";
import type { Recommendation, RecommendInput } from "@/lib/recommendation/types";
import { recommendationRequestSchema } from "./schema";

const recommendChampionsMock = vi.hoisted(() =>
  vi.fn((_input: RecommendInput): Recommendation[] => [])
);

vi.mock("@/lib/recommendation/engine", () => ({
  recommendChampions: recommendChampionsMock
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn()
}));

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

describe("POST /api/recommend", () => {
  it("passes the queried counter relations through to the engine", async () => {
    const relationFixture = [{ champion_id: "zed", countered_by_champion_id: "galio", role: "mid" }];

    function makeQuery(result: { data: unknown; error: null }) {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: (resolve: (value: typeof result) => void) => resolve(result)
      };
      return query;
    }

    const supabaseStub = {
      auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
      from: (table: string) =>
        table === "counter_relations"
          ? makeQuery({ data: relationFixture, error: null })
          : makeQuery({ data: [], error: null })
    };

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabaseStub as never);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({ role: "mid", region: "euw", tier: "emerald_plus", enemyPicks: ["zed"], bans: [] })
    });

    await POST(request);

    expect(recommendChampionsMock).toHaveBeenCalledTimes(1);
    const input = recommendChampionsMock.mock.calls[0][0];
    expect(input.counterRelations).toEqual([
      { championId: "zed", counteredByChampionId: "galio", role: "mid" }
    ]);
  });
});
