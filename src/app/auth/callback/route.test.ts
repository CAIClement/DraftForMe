import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { GET } from "./route";

function stubCallback({
  exchangeError = null,
  displayName
}: {
  exchangeError?: Error | null;
  displayName?: string | null;
}) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: displayName === undefined ? null : { display_name: displayName },
    error: null
  });
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({
        data: { user: exchangeError ? null : { id: "user-1" } },
        error: exchangeError
      })
    },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }))
  } as never);
}

const location = (response: Response) => response.headers.get("location");

describe("GET /auth/callback", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("fails back to the sign-in page without a code", async () => {
    const response = await GET(new Request("https://draftforme.test/auth/callback?next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/connexion?erreur=1");
  });

  it("fails back to the sign-in page when the exchange fails", async () => {
    stubCallback({ exchangeError: new Error("bad code") });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/connexion?erreur=1");
  });

  it("asks for a nickname first when the profile has none", async () => {
    stubCallback({});
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/compte/pseudo?next=%2Fdraft");
  });

  it("returns to the requested page when the nickname exists", async () => {
    stubCallback({ displayName: "Faker" });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=/draft"));
    expect(location(response)).toBe("https://draftforme.test/draft");
  });

  it("never follows an unsafe return path", async () => {
    stubCallback({ displayName: "Faker" });
    const response = await GET(new Request("https://draftforme.test/auth/callback?code=abc&next=//evil.com"));
    expect(location(response)).toBe("https://draftforme.test/");
  });
});
