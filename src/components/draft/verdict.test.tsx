import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Verdict } from "./verdict";
import type { Recommendation } from "@/lib/recommendation/types";

function build(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    championId: "galio",
    championName: "Galio",
    championImageUrl: undefined,
    totalScore: 88,
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
        { key: "meta", label: "Force dans le patch", score: 72, weight: 36, detail: "7e sur 64 au winrate en mid.", available: true },
        { key: "player", label: "Votre pool", score: 84, weight: 24, detail: "Dans vos habitudes.", available: true },
        { key: "counter", label: "Matchup", score: 91, weight: 40, detail: "Prend l'avantage sur zed.", available: true }
      ],
      warnings: [],
      alternatives: []
    },
    ...overrides
  };
}

describe("Verdict", () => {
  it("shows the champion, the score and the sample size", () => {
    render(<Verdict recommendation={build()} />);

    expect(screen.getByText("Galio")).toBeInTheDocument();
    expect(screen.getByText("88")).toBeInTheDocument();
    expect(screen.getByText("204 556")).toBeInTheDocument();
  });

  it("omits a fact rather than rendering it as zero when it is null", () => {
    render(<Verdict recommendation={build({ games: null })} />);

    expect(screen.queryByText("Parties analysées")).not.toBeInTheDocument();
  });

  it("renders only the available factors", () => {
    const recommendation = build();
    recommendation.explanation.factors[2].available = false;

    render(<Verdict recommendation={recommendation} />);

    expect(screen.getByText("Force dans le patch")).toBeInTheDocument();
    expect(screen.queryByText("Matchup")).not.toBeInTheDocument();
  });

  it("renders the counter factor's own wording when it is available", () => {
    render(<Verdict recommendation={build()} />);

    expect(screen.getByText("Prend l'avantage sur zed.")).toBeInTheDocument();
  });

  it("still shows the counter sentence when the factor is unavailable", () => {
    const recommendation = build();
    recommendation.explanation.factors[2].available = false;
    recommendation.explanation.factors[2].detail = "Ajoutez un pick adverse pour évaluer le matchup.";

    render(<Verdict recommendation={recommendation} />);

    expect(screen.getByText("Ajoutez un pick adverse pour évaluer le matchup.")).toBeInTheDocument();
  });

  it("shows weights that sum to 100", () => {
    render(<Verdict recommendation={build()} />);

    const weights = screen.getAllByTestId("factor-weight").map((node) => Number(node.textContent?.replace(/\D/g, "")));

    expect(weights.reduce((sum, weight) => sum + weight, 0)).toBe(100);
  });
});

describe("Verdict's community link", () => {
  it("links to the canonical matchup when the direct opponent is known", () => {
    render(<Verdict recommendation={build()} role="mid" enemyChampionId="zed" />);
    expect(screen.getByRole("link", { name: "Avis de la communauté" })).toHaveAttribute("href", "/duel/mid/galio-vs-zed");
  });

  it("omits the link when there is no direct opponent yet", () => {
    render(<Verdict recommendation={build()} role="mid" enemyChampionId={null} />);
    expect(screen.queryByRole("link", { name: "Avis de la communauté" })).not.toBeInTheDocument();
  });

  it("omits the link when the enemy champion is the same as the recommended one", () => {
    render(<Verdict recommendation={build()} role="mid" enemyChampionId="galio" />);
    expect(screen.queryByRole("link", { name: "Avis de la communauté" })).not.toBeInTheDocument();
  });

  it("omits the link when the role is not known", () => {
    render(<Verdict recommendation={build()} enemyChampionId="zed" />);
    expect(screen.queryByRole("link", { name: "Avis de la communauté" })).not.toBeInTheDocument();
  });
});
