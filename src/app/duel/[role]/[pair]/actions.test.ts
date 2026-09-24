import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  })
}));

const reviews = vi.hoisted(() => ({
  castVote: vi.fn(),
  postComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  reactToComment: vi.fn(),
  reportComment: vi.fn()
}));
vi.mock("@/lib/matchup/reviews", () => reviews);

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { castVote, deleteComment, editComment, postComment, reactToComment, reportComment } from "./actions";

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const MATCHUP_FIELDS = { role: "top", championLowId: "darius", championHighId: "garen" };

function stubSupabase({
  user = { id: "user-1" } as { id: string } | null,
  displayName = "Faker" as string | null,
  profileError = null as Error | null
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: displayName === null ? null : { display_name: displayName },
    error: profileError
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }))
  } as never);
}

beforeEach(() => {
  vi.mocked(createClient).mockReset();
  vi.mocked(revalidatePath).mockReset();
  Object.values(reviews).forEach((fn) => fn.mockReset());
});

describe("castVote", () => {
  it("sends a signed-out visitor to the sign-in page", async () => {
    stubSupabase({ user: null });
    await expect(castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
    expect(reviews.castVote).not.toHaveBeenCalled();
  });

  it("sends a nickname-less user to choose one first", async () => {
    stubSupabase({ displayName: null });
    await expect(castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).rejects.toThrow(
      "REDIRECT:/compte/pseudo?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
    expect(reviews.castVote).not.toHaveBeenCalled();
  });

  it("returns the generic error, not the nickname page, when the profile cannot be read", async () => {
    stubSupabase({ displayName: null, profileError: new Error("boom") });
    expect(await castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).toEqual({
      error: GENERIC_ERROR
    });
    expect(reviews.castVote).not.toHaveBeenCalled();
  });

  it("casts the vote and revalidates the matchup page", async () => {
    stubSupabase();
    reviews.castVote.mockResolvedValue({ ok: true });

    expect(await castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).toEqual({ error: null });
    expect(reviews.castVote).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      { role: "top", championLowId: "darius", championHighId: "garen" },
      "low"
    );
    expect(revalidatePath).toHaveBeenCalledWith("/duel/top/darius-vs-garen");
  });

  it("relays the helper's error without revalidating", async () => {
    stubSupabase();
    reviews.castVote.mockResolvedValue({ ok: false, error: GENERIC_ERROR });

    expect(await castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).toEqual({
      error: GENERIC_ERROR
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown choice", { ...MATCHUP_FIELDS, choice: "maybe" }],
    ["an unknown role", { ...MATCHUP_FIELDS, role: "bot", choice: "low" }],
    ["a pair out of canonical order", { role: "top", championLowId: "garen", championHighId: "darius", choice: "low" }],
    ["the same champion twice", { role: "top", championLowId: "garen", championHighId: "garen", choice: "low" }],
    ["a missing champion", { role: "top", championLowId: "", championHighId: "garen", choice: "low" }]
  ])("refuses %s without touching the database", async (_label, fields) => {
    stubSupabase();
    expect(await castVote({ error: null }, form(fields))).toEqual({ error: GENERIC_ERROR });
    expect(createClient).not.toHaveBeenCalled();
    expect(reviews.castVote).not.toHaveBeenCalled();
  });
});

describe("postComment", () => {
  it("posts a comment for a signed-in, nicknamed user", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValue({ ok: true });

    expect(await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Un avis." }))).toEqual({ error: null });
    expect(reviews.postComment).toHaveBeenCalledWith(expect.anything(), "user-1", MATCHUP_FIELDS, "Un avis.");
    expect(revalidatePath).toHaveBeenCalledWith("/duel/top/darius-vs-garen");
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    stubSupabase({ user: null });
    await expect(postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Un avis." }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
    expect(reviews.postComment).not.toHaveBeenCalled();
  });

  it("keeps the rate-limit message from the helper", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValue({
      ok: false,
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
    });

    expect(await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Un avis." }))).toEqual({
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
    });
  });

  it("allows a second comment on the same matchup (open discussion)", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Premier avis." }));
    await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Deuxième avis." }));

    expect(reviews.postComment).toHaveBeenCalledTimes(2);
  });
});

describe("editComment / deleteComment", () => {
  it("edits the user's own comment", async () => {
    stubSupabase();
    reviews.editComment.mockResolvedValue({ ok: true });

    expect(
      await editComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", body: "New text." }))
    ).toEqual({ error: null });
    expect(reviews.editComment).toHaveBeenCalledWith(expect.anything(), "user-1", "c1", "New text.");
    expect(revalidatePath).toHaveBeenCalledWith("/duel/top/darius-vs-garen");
  });

  it("relays a refusal to edit someone else's comment", async () => {
    stubSupabase();
    reviews.editComment.mockResolvedValue({ ok: false, error: GENERIC_ERROR });

    expect(
      await editComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", body: "New text." }))
    ).toEqual({ error: GENERIC_ERROR });
  });

  it("deletes the user's own comment", async () => {
    stubSupabase();
    reviews.deleteComment.mockResolvedValue({ ok: true });

    expect(await deleteComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1" }))).toEqual({
      error: null
    });
    expect(reviews.deleteComment).toHaveBeenCalledWith(expect.anything(), "user-1", "c1");
  });

  it("relays a refusal to delete someone else's comment", async () => {
    stubSupabase();
    reviews.deleteComment.mockResolvedValue({ ok: false, error: GENERIC_ERROR });

    expect(await deleteComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1" }))).toEqual({
      error: GENERIC_ERROR
    });
  });

  it("refuses a missing comment id without touching the database", async () => {
    stubSupabase();
    expect(await deleteComment({ error: null }, form(MATCHUP_FIELDS))).toEqual({ error: GENERIC_ERROR });
    expect(reviews.deleteComment).not.toHaveBeenCalled();
  });
});

describe("reactToComment", () => {
  it("moves the reaction rather than duplicating it (delegated to the upsert in reviews.ts)", async () => {
    stubSupabase();
    reviews.reactToComment.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    await reactToComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", value: "for" }));
    await reactToComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", value: "against" }));

    expect(reviews.reactToComment).toHaveBeenNthCalledWith(1, expect.anything(), "user-1", "c1", "for");
    expect(reviews.reactToComment).toHaveBeenNthCalledWith(2, expect.anything(), "user-1", "c1", "against");
  });

  it("refuses an unknown reaction value", async () => {
    stubSupabase();
    expect(await reactToComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", value: "meh" }))).toEqual({
      error: GENERIC_ERROR
    });
    expect(reviews.reactToComment).not.toHaveBeenCalled();
  });
});

describe("reportComment", () => {
  it("reports a comment without revalidating (reports are never shown)", async () => {
    stubSupabase();
    reviews.reportComment.mockResolvedValue({ ok: true });

    expect(await reportComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", reason: "spam" }))).toEqual({
      error: null
    });
    expect(reviews.reportComment).toHaveBeenCalledWith(expect.anything(), "user-1", "c1", "spam");
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a second report on the same comment", async () => {
    stubSupabase();
    reviews.reportComment.mockResolvedValue({ ok: false, error: "Vous avez déjà signalé ce commentaire." });

    expect(await reportComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", reason: "spam" }))).toEqual({
      error: "Vous avez déjà signalé ce commentaire."
    });
  });

  it("refuses an unknown reason", async () => {
    stubSupabase();
    expect(
      await reportComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", reason: "boring" }))
    ).toEqual({ error: GENERIC_ERROR });
    expect(reviews.reportComment).not.toHaveBeenCalled();
  });
});
