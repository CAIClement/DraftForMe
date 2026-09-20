import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Alternatives } from "./alternatives";
import type { Recommendation } from "@/lib/recommendation/types";

// `games` defaults so the Task 14 tests (which only care about interaction,
// not the sample-size copy) can call `build("Viktor")` with a single arg,
// while every earlier test that exercises the fact line keeps passing it.
function build(name: string, games: number | null = 142000): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: 81,
    metaScore: 70,
    playerScore: 50,
    counterScore: 60,
    rank: 12,
    winRate: 51,
    pickRate: 3,
    banRate: 1,
    games,
    totalRanked: 64,
    explanation: { summary: "", factors: [], warnings: [], alternatives: [] }
  };
}

describe("Alternatives", () => {
  it("renders one entry per alternative", () => {
    render(
      <Alternatives
        recommendations={[build("Lissandra", 142000), build("Diana", 98000)]}
        onPreview={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText("Lissandra")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("renders nothing when there are no alternatives", () => {
    const { container } = render(<Alternatives recommendations={[]} onPreview={vi.fn()} onSelect={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("omits the sample size when it is unknown", () => {
    render(<Alternatives recommendations={[build("Lissandra", null)]} onPreview={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.queryByText(/parties/)).not.toBeInTheDocument();
  });

  it("renders exactly two alternatives", () => {
    render(
      <Alternatives
        recommendations={[build("Lissandra", 142000), build("Diana", 98000)]}
        onPreview={vi.fn()}
        onSelect={vi.fn()}
      />
    );

    expect(screen.getAllByTestId("alternative")).toHaveLength(2);
  });

  it("never renders a dash for a missing win rate", () => {
    const recommendation = build("Lissandra", 142000);
    recommendation.winRate = null;

    render(<Alternatives recommendations={[recommendation]} onPreview={vi.fn()} onSelect={vi.fn()} />);

    expect(screen.queryByText(/—/)).not.toBeInTheDocument();
    expect(screen.getByText("142 000 parties")).toBeInTheDocument();
  });

  it("previews an alternative on hover and withdraws it on leave", () => {
    const onPreview = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={onPreview} onSelect={vi.fn()} />);

    const card = screen.getByRole("button", { name: /viktor/i });

    fireEvent.mouseEnter(card);
    expect(onPreview).toHaveBeenLastCalledWith("viktor");

    fireEvent.mouseLeave(card);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  // Hover-only would make this a mouse feature. Focus has to do the same.
  it("previews on keyboard focus too", () => {
    const onPreview = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={onPreview} onSelect={vi.fn()} />);

    fireEvent.focus(screen.getByRole("button", { name: /viktor/i }));

    expect(onPreview).toHaveBeenLastCalledWith("viktor");
  });

  it("selects an alternative on click", () => {
    const onSelect = vi.fn();
    render(<Alternatives recommendations={[build("Viktor")]} onPreview={vi.fn()} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /viktor/i }));

    expect(onSelect).toHaveBeenCalledWith("viktor");
  });
});
