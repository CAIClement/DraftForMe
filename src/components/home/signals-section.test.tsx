import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Recommendation } from "@/lib/recommendation/types";
import { SignalsSection } from "./signals-section";

function build(): Recommendation {
  return {
    championId: "galio",
    championName: "Galio",
    championImageUrl: undefined,
    totalScore: 77.6,
    metaScore: 72,
    playerScore: 84,
    counterScore: 91,
    rank: 7,
    winRate: 51.3,
    pickRate: 4.1,
    banRate: 2.8,
    games: 204556,
    totalRanked: 64,
    explanation: {
      summary: "Recommandé pour son matchup.",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 72, weight: 60, detail: "", available: true },
        { key: "counter", label: "Matchup", score: 91, weight: 40, detail: "", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

describe("SignalsSection", () => {
  it("gives screen readers the real rounded score of the recommended pick", () => {
    render(<SignalsSection top={build()} />);

    expect(screen.getByText("78", { selector: ".sr-only" })).toBeInTheDocument();
  });

  it("keeps the weighting card out when there is no recommendation", () => {
    render(<SignalsSection top={undefined} />);

    expect(screen.queryByText("Pondération du pick recommandé")).not.toBeInTheDocument();
  });
});
