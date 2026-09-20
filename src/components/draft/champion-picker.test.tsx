import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChampionPicker } from "./champion-picker";

const champions = [
  { id: "zed", name: "Zed" },
  { id: "caitlyn", name: "Caitlyn" },
  { id: "kaisa", name: "Kai'Sa" }
];

function renderPicker(overrides: Partial<Parameters<typeof ChampionPicker>[0]> = {}) {
  const props = {
    champions,
    excludedIds: [] as string[],
    target: { side: "enemy" as const, role: "mid" as const },
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides
  };

  render(<ChampionPicker {...props} />);
  return props;
}

describe("ChampionPicker", () => {
  it("says which lane it is filling", () => {
    renderPicker();

    expect(screen.getByText(/mid adverse/i)).toBeInTheDocument();
  });

  // Punctuated names are searched by their slug, which is what a player types.
  it("finds a punctuated champion by its slug", () => {
    renderPicker();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "kaisa" } });

    expect(screen.getByRole("button", { name: "Kai'Sa" })).toBeInTheDocument();
  });

  it("hides champions already placed elsewhere", () => {
    renderPicker({ excludedIds: ["zed"] });

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "z" } });

    expect(screen.queryByRole("button", { name: "Zed" })).not.toBeInTheDocument();
  });

  it("reports the picked champion", () => {
    const props = renderPicker();

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "cait" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));

    expect(props.onPick).toHaveBeenCalledWith("caitlyn");
  });

  it("takes the first match on Enter", () => {
    const props = renderPicker();

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "cait" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onPick).toHaveBeenCalledWith("caitlyn");
  });

  it("closes on Escape", () => {
    const props = renderPicker();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(props.onClose).toHaveBeenCalled();
  });
});
