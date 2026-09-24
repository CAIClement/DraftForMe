import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function stubOAuth(result: { data: { url: string | null }; error: Error | null }) {
  const signInWithOAuth = vi.fn().mockResolvedValue(result);
  vi.mocked(createClient).mockResolvedValue({ auth: { signInWithOAuth } } as never);
  return signInWithOAuth;
}

describe("GET /auth/login", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it.each(["discord", "google"] as const)("redirects to the %s authorization page", async (provider) => {
    const signInWithOAuth = stubOAuth({ data: { url: "https://provider.example/authorize?x=1" }, error: null });

    const response = await GET(new Request(`https://draftforme.test/auth/login?provider=${provider}&next=/draft`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://provider.example/authorize?x=1");
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider,
      options: {
        redirectTo: "https://draftforme.test/auth/callback?next=%2Fdraft",
        skipBrowserRedirect: true
      }
    });
  });

  it("rejects an unknown provider without contacting Supabase", async () => {
    const response = await GET(new Request("https://draftforme.test/auth/login?provider=github"));

    expect(response.status).toBe(400);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("sanitises the return path", async () => {
    const signInWithOAuth = stubOAuth({ data: { url: "https://provider.example/authorize" }, error: null });

    await GET(new Request("https://draftforme.test/auth/login?provider=discord&next=//evil.com"));

    expect(signInWithOAuth.mock.calls[0][0].options.redirectTo).toBe("https://draftforme.test/auth/callback?next=%2F");
  });

  it("sends the user back to the sign-in page when Supabase fails", async () => {
    stubOAuth({ data: { url: null }, error: new Error("provider disabled") });

    const response = await GET(new Request("https://draftforme.test/auth/login?provider=google"));

    expect(response.headers.get("location")).toBe("https://draftforme.test/connexion?erreur=1");
  });
});
