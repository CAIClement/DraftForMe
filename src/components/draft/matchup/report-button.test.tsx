import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const reportComment = vi.hoisted(() => vi.fn());
vi.mock("@/app/duel/[role]/[pair]/actions", () => ({ reportComment }));

import { ReportButton } from "./report-button";

describe("ReportButton", () => {
  it("offers the four report reasons", () => {
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));

    expect(screen.getByRole("radio", { name: /indésirable/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /insultant/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /hors sujet/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /autre/i })).toBeInTheDocument();
  });

  it("focuses the first reason when the form opens", () => {
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));

    expect(screen.getByRole("radio", { name: /indésirable/i })).toHaveFocus();
  });

  it("closes the form when Annuler is clicked", () => {
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.queryByRole("radio", { name: /indésirable/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Signaler" })).toBeInTheDocument();
  });

  it("shows the error when a comment was already reported", async () => {
    reportComment.mockResolvedValue({ error: "Vous avez déjà signalé ce commentaire." });
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    fireEvent.click(screen.getByRole("radio", { name: /indésirable/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Vous avez déjà signalé ce commentaire.");
  });

  it("shows a success message and hides the form after reporting", async () => {
    reportComment.mockResolvedValue({ error: null });
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    });

    expect(await screen.findByRole("status")).toHaveTextContent("Signalement envoyé.");
    expect(screen.queryByRole("radio", { name: /indésirable/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Signaler" })).not.toBeInTheDocument();
  });

  it("does not show a stale error after cancelling and reopening", async () => {
    reportComment.mockResolvedValue({ error: "Vous avez déjà signalé ce commentaire." });
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Vous avez déjà signalé ce commentaire.");

    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("returns focus to the Signaler button when the form is cancelled", () => {
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));

    expect(screen.getByRole("button", { name: "Signaler" })).toHaveFocus();
  });
});
