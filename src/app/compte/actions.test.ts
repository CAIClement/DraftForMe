import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  })
}));

import { createClient } from "@/lib/supabase/server";
import { deleteAccount, saveNickname, signOut } from "./actions";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

function stubSupabase({
  user = { id: "user-1" } as { id: string } | null,
  upsertError = null as { code: string } | null,
  rpcError = null as Error | null
} = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });
  const rpc = vi.fn().mockResolvedValue({ error: rpcError });
  const signOutFn = vi.fn().mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }), signOut: signOutFn },
    from: vi.fn(() => ({ upsert })),
    rpc
  } as never);
  return { upsert, rpc, signOut: signOutFn };
}

describe("saveNickname", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("refuses an invalid nickname without touching the database", async () => {
    const { upsert } = stubSupabase();
    expect(await saveNickname({ error: null }, form({ nickname: "ab" }))).toEqual({
      error: "Le pseudo doit faire au moins 3 caractères."
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("saves the nickname and goes to the requested page", async () => {
    const { upsert } = stubSupabase();

    await expect(saveNickname({ error: null }, form({ nickname: " Faker ", next: "/draft" }))).rejects.toThrow(
      "REDIRECT:/draft"
    );
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: "user-1", display_name: "Faker" });
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: "user_id" });
  });

  it("says when the nickname is taken", async () => {
    stubSupabase({ upsertError: { code: "23505" } });
    expect(await saveNickname({ error: null }, form({ nickname: "Faker" }))).toEqual({
      error: "Ce pseudo est déjà pris."
    });
  });

  it("gives a generic message on any other database error", async () => {
    stubSupabase({ upsertError: { code: "08006" } });
    expect(await saveNickname({ error: null }, form({ nickname: "Faker" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    stubSupabase({ user: null });
    await expect(saveNickname({ error: null }, form({ nickname: "Faker" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fcompte"
    );
  });

  it("keeps the original target when sending a signed-out visitor to sign in", async () => {
    stubSupabase({ user: null });
    await expect(saveNickname({ error: null }, form({ nickname: "Faker", next: "/draft" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fdraft"
    );
  });

  it("never sends an unsafe next path to the sign-in redirect", async () => {
    stubSupabase({ user: null });
    await expect(saveNickname({ error: null }, form({ nickname: "Faker", next: "//evil.com" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2F"
    );
  });
});

describe("deleteAccount", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("refuses without the exact confirmation word", async () => {
    const { rpc } = stubSupabase();
    expect(await deleteAccount({ error: null }, form({ confirmation: "supprimer" }))).toEqual({
      error: "Tapez SUPPRIMER pour confirmer."
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletes the account, signs out and goes home", async () => {
    const { rpc, signOut: signOutFn } = stubSupabase();

    await expect(deleteAccount({ error: null }, form({ confirmation: "SUPPRIMER" }))).rejects.toThrow("REDIRECT:/");
    expect(rpc).toHaveBeenCalledWith("delete_my_account");
    expect(signOutFn).toHaveBeenCalledWith({ scope: "local" });
  });

  it("keeps the session and reports the failure when deletion fails", async () => {
    const { signOut: signOutFn } = stubSupabase({ rpcError: new Error("down") });
    expect(await deleteAccount({ error: null }, form({ confirmation: "SUPPRIMER" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
    expect(signOutFn).not.toHaveBeenCalled();
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    const { rpc } = stubSupabase({ user: null });
    await expect(deleteAccount({ error: null }, form({ confirmation: "SUPPRIMER" }))).rejects.toThrow(
      "REDIRECT:/connexion"
    );
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("signOut", () => {
  it("signs out and goes home", async () => {
    const { signOut: signOutFn } = stubSupabase();
    await expect(signOut()).rejects.toThrow("REDIRECT:/");
    expect(signOutFn).toHaveBeenCalled();
  });

  it("does not pretend it worked when Supabase reports a sign-out error", async () => {
    stubSupabase();
    vi.mocked(createClient).mockResolvedValueOnce({
      auth: { signOut: vi.fn().mockResolvedValue({ error: new Error("down") }) }
    } as never);
    await expect(signOut()).rejects.toThrow("REDIRECT:/compte?erreur=deconnexion");
  });
});
