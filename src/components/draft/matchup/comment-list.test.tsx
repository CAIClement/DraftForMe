import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentList } from "./comment-list";
import type { Comment } from "@/lib/matchup/reviews";

vi.mock("@/app/duel/[role]/[pair]/actions", () => ({
  reactToComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  reportComment: vi.fn()
}));

function comment(overrides: Partial<Comment>): Comment {
  return {
    id: "c1",
    authorNickname: "Faker",
    body: "Un avis.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    edited: false,
    score: 0,
    forCount: 0,
    againstCount: 0,
    myReaction: null,
    isMine: false,
    ...overrides
  };
}

const MATCHUP = { role: "top" as const, championLowId: "darius", championHighId: "garen" };

describe("CommentList", () => {
  it("renders in the order it is given (sorting is reviews.ts's job, see the plan)", () => {
    render(
      <CommentList
        comments={[comment({ id: "first", body: "Premier" }), comment({ id: "second", body: "Second" })]}
        currentUserId={null}
        matchup={MATCHUP}
      />
    );

    const bodies = screen.getAllByTestId("comment-body").map((node) => node.textContent);
    expect(bodies).toEqual(["Premier", "Second"]);
  });

  it("shows a modifié marker after an edit", () => {
    render(<CommentList comments={[comment({ edited: true })]} currentUserId={null} matchup={MATCHUP} />);
    expect(screen.getByText(/modifié/i)).toBeInTheDocument();
  });

  it("shows Utilisateur supprimé for an anonymized author", () => {
    render(<CommentList comments={[comment({ authorNickname: null })]} currentUserId={null} matchup={MATCHUP} />);
    expect(screen.getByText("Utilisateur supprimé")).toBeInTheDocument();
  });

  it("offers edit and delete only on the caller's own comment", () => {
    render(
      <CommentList
        comments={[comment({ id: "mine", isMine: true }), comment({ id: "theirs", isMine: false })]}
        currentUserId="user-1"
        matchup={MATCHUP}
      />
    );
    expect(screen.getAllByRole("button", { name: "Modifier" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(1);
  });
});
