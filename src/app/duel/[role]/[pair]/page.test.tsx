import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/current-user", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        in: async () => ({
          data: [
            { id: "darius", name: "Darius", image_url: "darius.png" },
            { id: "garen", name: "Garen", image_url: "garen.png" }
          ],
          error: null
        })
      })
    })
  }))
}));
vi.mock("@/lib/matchup/reviews", () => ({
  getVoteSummary: vi.fn(async () => ({})),
  getComments: vi.fn(async () => ({ comments: [], hasMore: false }))
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  })
}));
vi.mock("./actions", () => ({ castVote: vi.fn() }));
vi.mock("@/components/marketing/site-header", () => ({ SiteHeader: () => null }));
vi.mock("@/components/marketing/site-footer", () => ({ SiteFooter: () => null }));
vi.mock("@/components/draft/matchup/vote-panel", () => ({ VotePanel: () => null }));
vi.mock("@/components/draft/matchup/comment-list", () => ({ CommentList: () => null }));
vi.mock("@/components/draft/matchup/comment-form", () => ({
  CommentForm: () => <form aria-label="Nouveau commentaire" />
}));

import { getCurrentUser } from "@/lib/auth/current-user";
import MatchupPage from "./page";

async function renderPage(offset?: string) {
  const jsx = await MatchupPage({
    params: Promise.resolve({ role: "top", pair: "darius-vs-garen" }),
    searchParams: Promise.resolve(offset ? { offset } : {})
  });
  render(jsx);
}

describe("MatchupPage discussion", () => {
  beforeEach(() => {
    vi.mocked(getCurrentUser).mockReset();
  });

  it("shows the comment form to a signed-in user with a nickname", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", nickname: "Faker" });
    await renderPage();

    expect(screen.getByRole("form", { name: "Nouveau commentaire" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Choisissez un pseudo/ })).not.toBeInTheDocument();
  });

  it("asks a signed-in user without a nickname to pick one first, then come back here", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", nickname: null });
    await renderPage();

    expect(screen.queryByRole("form", { name: "Nouveau commentaire" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Choisissez un pseudo/ })).toHaveAttribute(
      "href",
      "/compte/pseudo?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
  });

  it("keeps the current comments page in the nickname link's return address", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({ id: "user-1", nickname: null });
    await renderPage("10");

    expect(screen.getByRole("link", { name: /Choisissez un pseudo/ })).toHaveAttribute(
      "href",
      "/compte/pseudo?next=%2Fduel%2Ftop%2Fdarius-vs-garen%3Foffset%3D10"
    );
  });

  it("asks a signed-out visitor to sign in", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    await renderPage();

    expect(screen.queryByRole("form", { name: "Nouveau commentaire" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Connectez-vous" })).toBeInTheDocument();
  });
});
