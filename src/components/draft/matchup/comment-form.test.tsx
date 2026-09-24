import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const postComment = vi.hoisted(() => vi.fn());
vi.mock("@/app/duel/[role]/[pair]/actions", () => ({ postComment }));

import { CommentForm } from "./comment-form";

describe("CommentForm", () => {
  it("states the length rule and posts to the matchup", () => {
    render(<CommentForm role="top" championLowId="darius" championHighId="garen" />);
    expect(screen.getByText(/3 à 500 caractères/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "500");
  });

  it("shows the error the action returns and keeps the typed text", async () => {
    postComment.mockResolvedValue({ error: "Vous commentez trop vite. Réessayez dans quelques minutes." });
    render(<CommentForm role="top" championLowId="darius" championHighId="garen" />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Un avis bien construit." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Vous commentez trop vite. Réessayez dans quelques minutes.");
    expect(textarea).toHaveValue("Un avis bien construit.");
  });

  it("clears the typed text once the comment is posted successfully", async () => {
    postComment.mockResolvedValue({ error: null });
    render(<CommentForm role="top" championLowId="darius" championHighId="garen" />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Un avis bien construit." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(textarea).toHaveValue("");
  });
});
