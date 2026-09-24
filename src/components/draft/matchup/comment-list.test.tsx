import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentList } from "./comment-list";
import type { Comment } from "@/lib/matchup/reviews";

const reactToComment = vi.hoisted(() => vi.fn());
const editComment = vi.hoisted(() => vi.fn());
const deleteComment = vi.hoisted(() => vi.fn());
const reportComment = vi.hoisted(() => vi.fn());
vi.mock("@/app/duel/[role]/[pair]/actions", () => ({
  reactToComment,
  editComment,
  deleteComment,
  reportComment
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
        matchup={MATCHUP}
      />
    );

    const bodies = screen.getAllByTestId("comment-body").map((node) => node.textContent);
    expect(bodies).toEqual(["Premier", "Second"]);
  });

  it("shows a modifié marker with the edit date after an edit", () => {
    render(
      <CommentList
        comments={[comment({ edited: true, updatedAt: "2026-09-05T00:00:00Z" })]}
        matchup={MATCHUP}
      />
    );
    expect(screen.getByText(/modifié le/i)).toBeInTheDocument();
  });

  it("does not show a modifié marker when the comment was never edited", () => {
    render(<CommentList comments={[comment({ edited: false })]} matchup={MATCHUP} />);
    expect(screen.queryByText(/modifié/i)).not.toBeInTheDocument();
  });

  it("shows Utilisateur supprimé for an anonymized author", () => {
    render(<CommentList comments={[comment({ authorNickname: null })]} matchup={MATCHUP} />);
    expect(screen.getByText("Utilisateur supprimé")).toBeInTheDocument();
  });

  it("offers edit and delete only on the caller's own comment", () => {
    render(
      <CommentList
        comments={[comment({ id: "mine", isMine: true }), comment({ id: "theirs", isMine: false })]}
        matchup={MATCHUP}
      />
    );
    expect(screen.getAllByRole("button", { name: "Modifier" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(1);
  });

  it("offers the report button only on other people's comments", () => {
    render(
      <CommentList
        comments={[comment({ id: "mine", isMine: true }), comment({ id: "theirs", isMine: false })]}
        matchup={MATCHUP}
      />
    );
    expect(screen.getAllByRole("button", { name: "Signaler" })).toHaveLength(1);
  });

  it("marks the caller's own reaction as pressed and the other as not", () => {
    render(<CommentList comments={[comment({ myReaction: "for", forCount: 2 })]} matchup={MATCHUP} />);
    expect(screen.getByRole("button", { name: /Pertinent/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Pas pertinent/ })).toHaveAttribute("aria-pressed", "false");
  });

  it("labels the reaction buttons with their counts for screen readers", () => {
    render(<CommentList comments={[comment({ forCount: 3, againstCount: 1 })]} matchup={MATCHUP} />);
    expect(screen.getByRole("button", { name: "Pertinent (3)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pas pertinent (1)" })).toBeInTheDocument();
  });

  it("shows the reaction error as an alert without dropping it silently", async () => {
    reactToComment.mockResolvedValue({ error: "Une erreur est survenue. Réessayez plus tard." });
    render(<CommentList comments={[comment({})]} matchup={MATCHUP} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Pertinent/ }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Réessayez plus tard.");
  });

  it("shows the delete error as an alert without dropping it silently", async () => {
    deleteComment.mockResolvedValue({ error: "Une erreur est survenue. Réessayez plus tard." });
    render(<CommentList comments={[comment({ isMine: true })]} matchup={MATCHUP} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Supprimer" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Réessayez plus tard.");
  });

  it("focuses the edit textarea and labels it for screen readers", () => {
    render(<CommentList comments={[comment({ isMine: true })]} matchup={MATCHUP} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));

    const textarea = screen.getByLabelText("Modifier le commentaire");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveFocus();
  });

  it("closes the edit form after a successful save, but not before submitting", async () => {
    editComment.mockResolvedValue({ error: null });
    render(<CommentList comments={[comment({ isMine: true })]} matchup={MATCHUP} />);

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    expect(screen.getByLabelText("Modifier le commentaire")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    expect(screen.queryByLabelText("Modifier le commentaire")).not.toBeInTheDocument();
  });

  it("keeps the edit form open when the save fails", async () => {
    editComment.mockResolvedValue({ error: "Une erreur est survenue. Réessayez plus tard." });
    render(<CommentList comments={[comment({ isMine: true })]} matchup={MATCHUP} />);

    fireEvent.click(screen.getByRole("button", { name: "Modifier" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    expect(screen.getByLabelText("Modifier le commentaire")).toBeInTheDocument();
    expect(await screen.findByRole("alert")).toHaveTextContent("Une erreur est survenue. Réessayez plus tard.");
  });
});
