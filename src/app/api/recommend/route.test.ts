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
      enemyPicks: [{ championId: "zed", role: "mid" }],
      allyPicks: ["malphite"],
      bans: [],
      priority: 50
    });

    expect(parsed.role).toBe("mid");
    expect(parsed.enemyPicks[0].role).toBe("mid");
    expect(parsed.allyPicks).toEqual(["malphite"]);
  });

  it("defaults allyPicks to empty so an older client still parses", () => {
    const parsed = recommendationRequestSchema.parse({
      role: "mid",
      region: "euw",
      tier: "emerald_plus",
      enemyPicks: [],
      bans: []
    });

    expect(parsed.allyPicks).toEqual([]);
  });

  it("rejects an enemy pick on a lane that does not exist", () => {
    expect(() =>
      recommendationRequestSchema.parse({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [{ championId: "zed", role: "botlane" }],
        bans: []
      })
    ).toThrow();
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
  function makeQuery(result: { data: unknown; error: null }) {
    const query = {
      select: () => query,
      eq: () => query,
      order: () => query,
      then: (resolve: (value: typeof result) => void) => resolve(result)
    };
    return query;
  }

  it("passes the queried counter relations through to the engine", async () => {
    const relationFixture = [{ champion_id: "zed", countered_by_champion_id: "galio", role: "mid" }];

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
      body: JSON.stringify({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [{ championId: "zed", role: "mid" }],
        allyPicks: ["malphite"],
        bans: []
      })
    });

    await POST(request);

    expect(recommendChampionsMock).toHaveBeenCalledTimes(1);
    const input = recommendChampionsMock.mock.calls[0][0];
    expect(input.counterRelations).toEqual([
      { championId: "zed", counteredByChampionId: "galio", role: "mid" }
    ]);
    // Allies are excluded from the candidates and nothing else.
    expect(input.alreadyPickedChampionIds.sort()).toEqual(["malphite", "zed"]);
    expect(input.draftingRole).toBe("mid");
  });

  // The insert below is cast `as never`, so nothing else in the toolchain —
  // not the compiler, not the schema — would catch `enemy_picks` regressing
  // from champion ids back to `{championId, role}` pick objects.
  it("inserts enemy champion ids, not pick objects, into the session row", async () => {
    let insertPayload: unknown = null;

    const supabaseStub = {
      auth: { getUser: () => Promise.resolve({ data: { user: { id: "user-1" } } }) },
      from: (table: string) => {
        if (table === "recommendation_sessions") {
          return {
            insert: (payload: unknown) => {
              insertPayload = payload;
              return Promise.resolve({ data: null, error: null });
            }
          };
        }
        return makeQuery({ data: [], error: null });
      }
    };

    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue(supabaseStub as never);

    const { POST } = await import("./route");
    const request = new Request("http://localhost/api/recommend", {
      method: "POST",
      body: JSON.stringify({
        role: "mid",
        region: "euw",
        tier: "emerald_plus",
        enemyPicks: [{ championId: "zed", role: "mid" }],
        allyPicks: ["malphite"],
        bans: []
      })
    });

    await POST(request);

    expect(insertPayload).toMatchObject({ enemy_picks: ["zed"] });
  });
});
