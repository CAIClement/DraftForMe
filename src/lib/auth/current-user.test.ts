import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./current-user";

function stubSupabase({ user, displayName }: { user: { id: string } | null; displayName?: string | null }) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: displayName === undefined ? null : { display_name: displayName },
    error: null
  });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from
  } as never);
  return { from, eq };
}

describe("getCurrentUser", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("returns null when nobody is signed in", async () => {
    stubSupabase({ user: null });
    expect(await getCurrentUser()).toBeNull();
  });

  it("returns the id and the nickname from the profile", async () => {
    const { from, eq } = stubSupabase({ user: { id: "user-1" }, displayName: "Faker" });

    expect(await getCurrentUser()).toEqual({ id: "user-1", nickname: "Faker" });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns a null nickname when the profile does not exist yet", async () => {
    stubSupabase({ user: { id: "user-1" } });
    expect(await getCurrentUser()).toEqual({ id: "user-1", nickname: null });
  });

  it("treats an unreachable Supabase as signed out rather than breaking the page", async () => {
    // Not `vi.mocked(createClient).mockRejectedValue(...)`: in this Vitest/Node
    // combination, a rejection thrown from a vi.fn() registered through
    // vi.mock() is reported as an unhandled test error even though
    // getCurrentUser's try/catch does catch it (verified with a console.log
    // spike). A plain rejecting function swapped in via vi.doMock for a fresh
    // dynamic import avoids the false positive while still exercising the
    // same catch path.
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      createClient: async () => {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
      }
    }));
    const { getCurrentUser: getCurrentUserWithFailingClient } = await import("./current-user");
    expect(await getCurrentUserWithFailingClient()).toBeNull();
  });
});
