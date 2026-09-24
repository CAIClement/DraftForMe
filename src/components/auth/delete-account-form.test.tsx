import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const deleteAccount = vi.hoisted(() => vi.fn());
vi.mock("@/app/compte/actions", () => ({ deleteAccount }));

import { DeleteAccountForm } from "./delete-account-form";

describe("DeleteAccountForm", () => {
  it("explains what is deleted and asks for the confirmation word", () => {
    render(<DeleteAccountForm />);

    expect(screen.getByText(/définitive/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tapez SUPPRIMER/)).toBeInTheDocument();
  });

  it("shows the error the action returns", async () => {
    deleteAccount.mockResolvedValue({ error: "Tapez SUPPRIMER pour confirmer." });
    render(<DeleteAccountForm />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Supprimer mon compte" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Tapez SUPPRIMER pour confirmer.");
  });
});
