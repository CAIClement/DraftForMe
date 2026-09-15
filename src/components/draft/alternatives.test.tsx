import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Alternatives } from "./alternatives";
import type { Recommendation } from "@/lib/recommendation/types";

function build(name: string, games: number | null): Recommendation {
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
    render(<Alternatives recommendations={[build("Lissandra", 142000), build("Diana", 98000)]} />);

    expect(screen.getByText("Lissandra")).toBeInTheDocument();
    expect(screen.getByText("Diana")).toBeInTheDocument();
  });

  it("renders nothing when there are no alternatives", () => {
    const { container } = render(<Alternatives recommendations={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("omits the sample size when it is unknown", () => {
    render(<Alternatives recommendations={[build("Lissandra", null)]} />);

    expect(screen.queryByText(/parties/)).not.toBeInTheDocument();
  });
});
