import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VotePanel } from "./vote-panel";

const CHAMPION_LOW = { id: "darius", name: "Darius" };
const CHAMPION_HIGH = { id: "garen", name: "Garen" };

function props(summary: Partial<Parameters<typeof VotePanel>[0]["summary"]> = {}) {
  return {
    championLow: CHAMPION_LOW,
    championHigh: CHAMPION_HIGH,
    role: "top" as const,
    summary: { low: 0, high: 0, even: 0, total: 0, myChoice: null, ...summary },
    action: vi.fn()
  };
}

describe("VotePanel", () => {
  it("always shows the raw count next to each choice", () => {
    render(<VotePanel {...props({ low: 3, high: 1, even: 0, total: 4 })} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show a derived percentage below 5 votes", () => {
    render(<VotePanel {...props({ low: 3, high: 1, even: 0, total: 4 })} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows the derived percentage once the matchup reaches 5 votes", () => {
    render(<VotePanel {...props({ low: 4, high: 1, even: 0, total: 5 })} />);
    expect(screen.getByText(/80 %/)).toBeInTheDocument();
    expect(screen.getByText(/Darius/)).toBeInTheDocument();
  });

  it("marks the caller's own choice", () => {
    render(<VotePanel {...props({ low: 1, total: 1, myChoice: "low" })} />);
    expect(screen.getByRole("button", { name: /Darius gagne/ })).toHaveAttribute("aria-pressed", "true");
  });
});
