import { describe, expect, it, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({ redirect }));

describe("/draft", () => {
  it("redirects to the single page", async () => {
    const { default: DraftPage } = await import("./page");

    DraftPage();

    expect(redirect).toHaveBeenCalledWith("/");
  });
});
