import { describe, expect, it, vi } from "vitest";
import {
  castVote,
  deleteComment,
  editComment,
  getComments,
  getVoteSummary,
  postComment,
  reactToComment,
  reportComment
} from "./reviews";
import type { MatchupKey } from "./key";
import type { VoteChoice } from "./reviews";

const KEY: MatchupKey = { role: "top", championLowId: "darius", championHighId: "garen" };

type QueryResult = { data?: unknown; error?: unknown; count?: number | null };
type Filters = Record<string, unknown>;
type Builder = Record<string, unknown> & { filters: Filters; eq: ReturnType<typeof vi.fn> };

// A minimal thenable query builder: every chained call returns itself, and
// awaiting it resolves to the fixture. Mirrors the pattern already used in
// src/app/api/recommend/route.test.ts's makeQuery. `.eq()` calls are recorded
// in `filters`, and the fixture may be a function of them, so one table can
// answer several differently-filtered queries (e.g. one count per choice).
function query(result: QueryResult | ((filters: Filters) => QueryResult)) {
  const filters: Filters = {};
  const builder = { filters } as Builder;
  const chain = () => builder;
  const resolved = () => ({ data: null, error: null, count: null, ...(typeof result === "function" ? result(filters) : result) });
  Object.assign(builder, {
    select: vi.fn(chain),
    eq: vi.fn((column: string, value: unknown) => {
      filters[column] = value;
      return builder;
    }),
    in: vi.fn(chain),
    order: chain,
    upsert: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    maybeSingle: () => Promise.resolve(resolved()),
    then: (resolve: (value: ReturnType<typeof resolved>) => void) => resolve(resolved())
  });
  return builder;
}

// A table maps to either one shared builder or a factory called on every
// from(), for queries built concurrently that must not share their filters.
function stub(byTable: Record<string, Builder | (() => Builder)>) {
  return {
    from: (table: string) => {
      const entry = byTable[table];
      if (entry === undefined) return query({ data: null, error: null });
      return typeof entry === "function" ? entry() : entry;
    }
  } as never;
}

const MATCHUP_FILTERS = { role: "top", champion_low_id: "darius", champion_high_id: "garen" };

describe("getVoteSummary", () => {
  // One builder per from() call: the three count queries and the caller's own
  // vote are built concurrently and each carries its own filters.
  function votesTable(counts: Record<VoteChoice, number>, myChoice: VoteChoice | null, error: unknown = null) {
    const builders: Builder[] = [];
    const factory = () => {
      const builder = query((filters) =>
        "user_id" in filters
          ? { data: myChoice === null ? null : { choice: myChoice }, error }
          : { count: counts[filters.choice as VoteChoice], error }
      );
      builders.push(builder);
      return builder;
    };
    return { builders, factory };
  }

  it("counts each choice and reports the caller's own vote", async () => {
    const votes = votesTable({ low: 2, high: 1, even: 1 }, "low");
    const supabase = stub({ matchup_votes: votes.factory });

    expect(await getVoteSummary(supabase, KEY, "user-1")).toEqual({
      low: 2,
      high: 1,
      even: 1,
      total: 4,
      myChoice: "low"
    });
  });

  it("counts in the database rather than loading rows, which max_rows would truncate", async () => {
    const votes = votesTable({ low: 1500, high: 0, even: 3 }, null);
    const summary = await getVoteSummary(stub({ matchup_votes: votes.factory }), KEY, null);

    expect(summary).toEqual({ low: 1500, high: 0, even: 3, total: 1503, myChoice: null });
    expect(votes.builders).toHaveLength(3);
    for (const builder of votes.builders) {
      expect(builder.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    }
    expect(votes.builders.map((b) => b.filters)).toEqual([
      { ...MATCHUP_FILTERS, choice: "low" },
      { ...MATCHUP_FILTERS, choice: "high" },
      { ...MATCHUP_FILTERS, choice: "even" }
    ]);
  });

  it("looks up the caller's own vote on this matchup only", async () => {
    const votes = votesTable({ low: 0, high: 0, even: 0 }, null);
    await getVoteSummary(stub({ matchup_votes: votes.factory }), KEY, "user-1");

    const own = votes.builders.filter((b) => "user_id" in b.filters);
    expect(own.map((b) => b.filters)).toEqual([{ ...MATCHUP_FILTERS, user_id: "user-1" }]);
  });

  it("has no opinion for a signed-out or non-voting caller", async () => {
    const votes = votesTable({ low: 1, high: 0, even: 0 }, null);
    const supabase = stub({ matchup_votes: votes.factory });
    expect((await getVoteSummary(supabase, KEY, null)).myChoice).toBeNull();
    expect((await getVoteSummary(supabase, KEY, "user-1")).myChoice).toBeNull();
  });

  it("throws when a count query fails instead of showing 0 votes", async () => {
    const failure = { message: "boom" };
    const supabase = stub({ matchup_votes: votesTable({ low: 0, high: 0, even: 0 }, null, failure).factory });
    await expect(getVoteSummary(supabase, KEY, null)).rejects.toBe(failure);
  });

  it("throws when the caller's own vote cannot be read", async () => {
    const failure = { message: "boom" };
    const supabase = stub({
      matchup_votes: () => query((filters) => ("user_id" in filters ? { data: null, error: failure } : { count: 0 }))
    });
    await expect(getVoteSummary(supabase, KEY, "user-1")).rejects.toBe(failure);
  });
});

describe("castVote", () => {
  it("upserts on the matchup's own unique columns rather than inserting", async () => {
    const votes = query({ data: null, error: null });
    const supabase = stub({ matchup_votes: votes });

    expect(await castVote(supabase, "user-1", KEY, "low")).toEqual({ ok: true });
    expect(votes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "top", champion_low_id: "darius", champion_high_id: "garen", user_id: "user-1", choice: "low" }),
      { onConflict: "role,champion_low_id,champion_high_id,user_id" }
    );
  });
});

describe("getComments", () => {
  function comment(overrides: Record<string, unknown>) {
    return {
      id: "c1",
      body: "body",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      user_id: "user-1",
      matchup_comment_votes: [],
      ...overrides
    };
  }

  it("sorts by score descending, then recency descending, before paginating", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [
          comment({
            id: "old-low-score",
            created_at: "2026-09-01T00:00:00Z",
            matchup_comment_votes: [{ user_id: "user-9", value: "against" }]
          }),
          comment({
            id: "new-high-score",
            created_at: "2026-09-03T00:00:00Z",
            matchup_comment_votes: [
              { user_id: "user-9", value: "for" },
              { user_id: "user-8", value: "for" }
            ]
          }),
          comment({ id: "new-no-score", created_at: "2026-09-02T00:00:00Z" })
        ],
        error: null
      })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments.map((c) => c.id)).toEqual(["new-high-score", "new-no-score", "old-low-score"]);
  });

  it("shows Utilisateur supprimé when the author is anonymized", async () => {
    const supabase = stub({
      matchup_comments: query({ data: [comment({ user_id: null })], error: null })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].authorNickname).toBeNull();
  });

  it("marks a comment edited once updated_at moves past created_at", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [comment({ created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" })],
        error: null
      })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].edited).toBe(true);
  });

  it("resolves author nicknames through public_profiles, once per distinct author", async () => {
    const profiles = query({
      data: [
        { user_id: "user-1", display_name: "Faker" },
        { user_id: "user-2", display_name: "Caps" }
      ],
      error: null
    });
    const inSpy = vi.fn(() => profiles);
    profiles.in = inSpy;
    const supabase = stub({
      matchup_comments: query({
        data: [
          comment({ id: "a", user_id: "user-1", created_at: "2026-09-03T00:00:00Z" }),
          comment({ id: "b", user_id: "user-2", created_at: "2026-09-02T00:00:00Z" }),
          comment({ id: "c", user_id: "user-1", created_at: "2026-09-01T00:00:00Z" }),
          comment({ id: "d", user_id: "user-3", created_at: "2026-08-31T00:00:00Z" })
        ],
        error: null
      }),
      public_profiles: profiles
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(inSpy).toHaveBeenCalledWith("user_id", ["user-1", "user-2", "user-3"]);
    // user-3 has no public profile row: shown as a deleted user, never invented.
    expect(comments.map((c) => c.authorNickname)).toEqual(["Faker", "Caps", "Faker", null]);
  });

  it("resolves nicknames only for the comments on the requested page", async () => {
    const profiles = query({ data: [{ user_id: "user-2", display_name: "Caps" }], error: null });
    const inSpy = vi.fn(() => profiles);
    profiles.in = inSpy;
    const supabase = stub({
      matchup_comments: query({
        data: [
          comment({ id: "newest", user_id: "user-1", created_at: "2026-09-03T00:00:00Z" }),
          comment({ id: "middle", user_id: "user-2", created_at: "2026-09-02T00:00:00Z" }),
          comment({ id: "oldest", user_id: "user-3", created_at: "2026-09-01T00:00:00Z" })
        ],
        error: null
      }),
      public_profiles: profiles
    });

    const { comments, hasMore } = await getComments(supabase, KEY, null, { limit: 1, offset: 1 });
    expect(inSpy).toHaveBeenCalledTimes(1);
    expect(inSpy).toHaveBeenCalledWith("user_id", ["user-2"]);
    expect(comments.map((c) => [c.id, c.authorNickname])).toEqual([["middle", "Caps"]]);
    expect(hasMore).toBe(true);
  });

  it("does not query public_profiles when the page is past the last comment", async () => {
    const from = vi.fn<(table: string) => Builder>((table) =>
      query({ data: table === "matchup_comments" ? [comment({})] : [], error: null })
    );

    expect(await getComments({ from } as never, KEY, null, { limit: 20, offset: 20 })).toEqual({
      comments: [],
      hasMore: false
    });
    expect(from).not.toHaveBeenCalledWith("public_profiles");
  });

  it("does not query public_profiles when every comment is anonymized", async () => {
    const from = vi.fn((table: string) =>
      table === "matchup_comments"
        ? query({ data: [comment({ user_id: null })], error: null })
        : query({ data: [], error: null })
    );
    const supabase = { from } as never;

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].authorNickname).toBeNull();
    expect(from).not.toHaveBeenCalledWith("public_profiles");
  });

  it("reads only the requested matchup's comments", async () => {
    const comments = query({ data: [comment({})], error: null });
    const supabase = stub({ matchup_comments: comments });

    await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments.filters).toEqual(MATCHUP_FILTERS);
  });

  it("throws when the comments query fails instead of showing an empty discussion", async () => {
    const failure = { message: "boom" };
    const supabase = stub({ matchup_comments: query({ data: null, error: failure }) });
    await expect(getComments(supabase, KEY, null, { limit: 20, offset: 0 })).rejects.toBe(failure);
  });

  it("loads reactions embedded in the comments query, not through a separate .in() list", async () => {
    const comments = query({
      data: [
        comment({
          id: "c1",
          matchup_comment_votes: [
            { user_id: "user-1", value: "for" },
            { user_id: "user-2", value: "for" },
            { user_id: "user-3", value: "against" }
          ]
        })
      ],
      error: null
    });
    const from = vi.fn((table: string) => (table === "matchup_comments" ? comments : query({ data: [], error: null })));

    const { comments: result } = await getComments({ from } as never, KEY, "user-3", { limit: 20, offset: 0 });
    expect(comments.select).toHaveBeenCalledWith(
      "id, body, created_at, updated_at, user_id, matchup_comment_votes(user_id, value)"
    );
    expect(from).not.toHaveBeenCalledWith("matchup_comment_votes");
    expect(result[0]).toMatchObject({ forCount: 2, againstCount: 1, score: 1, myReaction: "against" });
  });

  it("stops after the comments query when the matchup has no comments", async () => {
    const from = vi.fn<(table: string) => Builder>(() => query({ data: [], error: null }));

    expect(await getComments({ from } as never, KEY, "user-1", { limit: 20, offset: 0 })).toEqual({
      comments: [],
      hasMore: false
    });
    expect(from.mock.calls).toEqual([["matchup_comments"]]);
  });

  it("throws when the public_profiles query fails instead of anonymizing everyone", async () => {
    const failure = { message: "boom" };
    const supabase = stub({
      matchup_comments: query({ data: [comment({})], error: null }),
      public_profiles: query({ data: null, error: failure })
    });
    await expect(getComments(supabase, KEY, null, { limit: 20, offset: 0 })).rejects.toBe(failure);
  });
});

describe("postComment", () => {
  it("rejects a body outside 3-500 characters without touching the database", async () => {
    const comments = query({ data: null, error: null });
    const supabase = stub({ matchup_comments: comments });

    expect(await postComment(supabase, "user-1", KEY, "ab")).toEqual({
      ok: false,
      error: "Le commentaire doit faire entre 3 et 500 caractères."
    });
    expect(comments.insert).not.toHaveBeenCalled();
  });

  it("maps the rate-limit trigger's error to its French message", async () => {
    const supabase = stub({
      matchup_comments: query({ data: null, error: { code: "P0001", message: "comment_rate_limited" } })
    });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({
      ok: false,
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
    });
  });

  it("does not take an error for the rate limit on its message alone", async () => {
    const supabase = stub({
      matchup_comments: query({ data: null, error: { code: "XX000", message: "comment_rate_limited" } })
    });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({
      ok: false,
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });

  it("inserts a valid comment", async () => {
    const comments = query({ data: null, error: null });
    const supabase = stub({ matchup_comments: comments });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({ ok: true });
    expect(comments.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "top", champion_low_id: "darius", champion_high_id: "garen", user_id: "user-1" })
    );
  });
});

describe("editComment / deleteComment", () => {
  it("reports a generic error when RLS refuses (no matching row for this user)", async () => {
    const supabase = stub({ matchup_comments: query({ data: null, error: null }) });
    expect(await editComment(supabase, "user-1", "someone-elses-comment", "New text.")).toEqual({
      ok: false,
      error: "Une erreur est survenue. Réessayez plus tard."
    });
    expect(await deleteComment(supabase, "user-1", "someone-elses-comment")).toEqual({
      ok: false,
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });

  it("scopes the edit and the delete to the caller's own row", async () => {
    const edited = query({ data: { id: "c1" }, error: null });
    await editComment(stub({ matchup_comments: edited }), "user-1", "c1", "New text.");
    expect(edited.filters).toEqual({ id: "c1", user_id: "user-1" });

    const deleted = query({ data: { id: "c1" }, error: null });
    await deleteComment(stub({ matchup_comments: deleted }), "user-1", "c1");
    expect(deleted.filters).toEqual({ id: "c1", user_id: "user-1" });
  });

  it("succeeds when the row belongs to the caller", async () => {
    const supabase = stub({ matchup_comments: query({ data: { id: "c1" }, error: null }) });
    expect(await editComment(supabase, "user-1", "c1", "New text.")).toEqual({ ok: true });
    expect(await deleteComment(supabase, "user-1", "c1")).toEqual({ ok: true });
  });
});

describe("reactToComment", () => {
  it("upserts on (comment_id, user_id) rather than inserting", async () => {
    const votes = query({ data: null, error: null });
    const supabase = stub({ matchup_comment_votes: votes });

    expect(await reactToComment(supabase, "user-1", "c1", "for")).toEqual({ ok: true });
    expect(votes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: "c1", user_id: "user-1", value: "for" }),
      { onConflict: "comment_id,user_id" }
    );
  });
});

describe("reportComment", () => {
  it("refuses a duplicate report", async () => {
    const supabase = stub({ matchup_comment_reports: query({ data: null, error: { code: "23505" } }) });
    expect(await reportComment(supabase, "user-1", "c1", "spam")).toEqual({
      ok: false,
      error: "Vous avez déjà signalé ce commentaire."
    });
  });

  it("accepts a new report", async () => {
    const supabase = stub({ matchup_comment_reports: query({ data: null, error: null }) });
    expect(await reportComment(supabase, "user-1", "c1", "spam")).toEqual({ ok: true });
  });
});
