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

const KEY: MatchupKey = { role: "top", championLowId: "darius", championHighId: "garen" };

// A minimal thenable query builder: every chained call returns itself, and
// awaiting it resolves to the fixture. Mirrors the pattern already used in
// src/app/api/recommend/route.test.ts's makeQuery.
function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    in: chain,
    order: chain,
    upsert: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => void) => resolve(result)
  });
  return builder;
}

function stub(byTable: Record<string, ReturnType<typeof query>>) {
  return { from: (table: string) => byTable[table] ?? query({ data: null, error: null }) } as never;
}

describe("getVoteSummary", () => {
  it("counts each choice and reports the caller's own vote", async () => {
    const supabase = stub({
      matchup_votes: query({
        data: [
          { choice: "low", user_id: "user-1" },
          { choice: "low", user_id: "user-2" },
          { choice: "high", user_id: "user-3" },
          { choice: "even", user_id: "user-4" }
        ],
        error: null
      })
    });

    expect(await getVoteSummary(supabase, KEY, "user-1")).toEqual({
      low: 2,
      high: 1,
      even: 1,
      total: 4,
      myChoice: "low"
    });
  });

  it("has no opinion for a signed-out or non-voting caller", async () => {
    const supabase = stub({ matchup_votes: query({ data: [{ choice: "low", user_id: "user-2" }], error: null }) });
    expect((await getVoteSummary(supabase, KEY, null)).myChoice).toBeNull();
    expect((await getVoteSummary(supabase, KEY, "user-1")).myChoice).toBeNull();
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
      ...overrides
    };
  }

  it("sorts by score descending, then recency descending, before paginating", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [
          comment({ id: "old-low-score", created_at: "2026-09-01T00:00:00Z" }),
          comment({ id: "new-high-score", created_at: "2026-09-03T00:00:00Z" }),
          comment({ id: "new-no-score", created_at: "2026-09-02T00:00:00Z" })
        ],
        error: null
      }),
      matchup_comment_votes: query({
        data: [
          { comment_id: "new-high-score", user_id: "user-9", value: "for" },
          { comment_id: "new-high-score", user_id: "user-8", value: "for" },
          { comment_id: "old-low-score", user_id: "user-9", value: "against" }
        ],
        error: null
      })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments.map((c) => c.id)).toEqual(["new-high-score", "new-no-score", "old-low-score"]);
  });

  it("shows Utilisateur supprimé when the author is anonymized", async () => {
    const supabase = stub({
      matchup_comments: query({ data: [comment({ user_id: null })], error: null }),
      matchup_comment_votes: query({ data: [], error: null })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].authorNickname).toBeNull();
  });

  it("marks a comment edited once updated_at moves past created_at", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [comment({ created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" })],
        error: null
      }),
      matchup_comment_votes: query({ data: [], error: null })
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
      matchup_comment_votes: query({ data: [], error: null }),
      public_profiles: profiles
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(inSpy).toHaveBeenCalledWith("user_id", ["user-1", "user-2", "user-3"]);
    // user-3 has no public profile row: shown as a deleted user, never invented.
    expect(comments.map((c) => c.authorNickname)).toEqual(["Faker", "Caps", "Faker", null]);
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

  it("throws when the comments query fails instead of showing an empty discussion", async () => {
    const failure = { message: "boom" };
    const supabase = stub({ matchup_comments: query({ data: null, error: failure }) });
    await expect(getComments(supabase, KEY, null, { limit: 20, offset: 0 })).rejects.toBe(failure);
  });

  it("throws when the reactions query fails instead of showing zero scores", async () => {
    const failure = { message: "boom" };
    const supabase = stub({
      matchup_comments: query({ data: [comment({})], error: null }),
      matchup_comment_votes: query({ data: null, error: failure }),
      public_profiles: query({ data: [], error: null })
    });
    await expect(getComments(supabase, KEY, null, { limit: 20, offset: 0 })).rejects.toBe(failure);
  });

  it("throws when the public_profiles query fails instead of anonymizing everyone", async () => {
    const failure = { message: "boom" };
    const supabase = stub({
      matchup_comments: query({ data: [comment({})], error: null }),
      matchup_comment_votes: query({ data: [], error: null }),
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
      matchup_comments: query({ data: null, error: { message: "comment_rate_limited" } })
    });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({
      ok: false,
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
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
