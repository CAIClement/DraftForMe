import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const saveNickname = vi.hoisted(() => vi.fn());
vi.mock("@/app/compte/actions", () => ({ saveNickname }));

import { NicknameForm } from "./nickname-form";

describe("NicknameForm", () => {
  it("prefills the current nickname and carries the return path", () => {
    const { container } = render(<NicknameForm defaultValue="Faker" next="/draft" />);

    expect(screen.getByLabelText("Pseudo")).toHaveValue("Faker");
    expect(container.querySelector('input[name="next"]')).toHaveValue("/draft");
    expect(screen.getByText(/visible publiquement/)).toBeInTheDocument();
  });

  it("shows the error the action returns", async () => {
    saveNickname.mockResolvedValue({ error: "Ce pseudo est déjà pris." });
    render(<NicknameForm next="/" />);

    fireEvent.change(screen.getByLabelText("Pseudo"), { target: { value: "Faker" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Ce pseudo est déjà pris.");
  });
});
