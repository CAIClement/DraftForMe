import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /auth/login", () => {
  it.each(["google", "discord"])("redirects %s login attempts to the home page", async (provider) => {
    const response = await GET(new Request(`https://draftforme.test/auth/login?provider=${provider}`));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://draftforme.test/");
  });
});
