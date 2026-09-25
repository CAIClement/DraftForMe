import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ComparisonTable } from "./comparison-table";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(
  name: string,
  score: number,
  {
    matchup = true,
    winRate = 51.3 as number | null,
    games = 12400 as number | null
  }: { matchup?: boolean; winRate?: number | null; games?: number | null } = {}
): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: score,
    metaScore: 72,
    playerScore: 5,
    counterScore: 85,
    rank: 7,
    winRate,
    pickRate: 4.1,
    banRate: 2.8,
    games,
    totalRanked: 64,
    explanation: {
      summary: "",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 72, weight: 57, detail: "", available: true },
        { key: "player", label: "Votre pool", score: 5, weight: 3, detail: "", available: false },
        {
          key: "counter",
          label: "Matchup",
          score: 85,
          weight: 40,
          detail: `${name} prend l'avantage.`,
          available: matchup
        }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const four = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74), rec("Ahri", 70)];

function renderTable(overrides: Partial<Parameters<typeof ComparisonTable>[0]> = {}) {
  const props = {
    recommendations: four,
    selectedId: "galio",
    role: "mid" as const,
    enemyChampionId: "zed",
    onPreview: vi.fn(),
    onSelect: vi.fn(),
    ...overrides
  };
  render(<ComparisonTable {...props} />);
  return props;
}

function cellsOf(name: string, score: number) {
  const row = screen.getByRole("button", { name: `${name}, score ${score}` }).closest("tr");
  // Normalises the locale's thousands separator (its exact character varies
  // by ICU version) to a plain space.
  return Array.from(row?.querySelectorAll("td") ?? []).map((cell) => cell.textContent?.replace(/\s/g, " ") ?? "");
}

describe("ComparisonTable", () => {
  it("lists every recommendation in the order given", () => {
    renderTable();

    const names = screen
      .getAllByRole("button", { name: /, score \d+$/ })
      .map((button) => button.getAttribute("aria-label"));

    expect(names).toEqual(["Galio, score 88", "Lissandra, score 81", "Diana, score 74", "Ahri, score 70"]);
  });

  it("shows score, patch strength, matchup, winrate and games per row", () => {
    renderTable();

    expect(cellsOf("Galio", 88).slice(1)).toEqual(["88", "72", "85", "51.3 %", "12 400"]);
  });

  it("opens the selected row's detail and only that one", () => {
    renderTable({ selectedId: "diana" });

    expect(screen.getByRole("button", { name: "Diana, score 74" })).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Galio, score 88" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Diana prend l'avantage.")).toBeInTheDocument();
    expect(screen.queryByText("Galio prend l'avantage.")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Avis de la communauté" })).toHaveAttribute(
      "href",
      "/duel/mid/diana-vs-zed"
    );
  });

  it("selects a row on click", () => {
    const { onSelect } = renderTable();

    fireEvent.click(screen.getByRole("button", { name: "Diana, score 74" }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("diana");
  });

  it("selects a row when clicking a non-button cell", () => {
    const { onSelect } = renderTable();
    const row = screen.getByRole("button", { name: "Diana, score 74" }).closest("tr");
    if (row === null) throw new Error("row not found");
    const scoreCell = row.querySelectorAll("td")[1];
    if (scoreCell === undefined) throw new Error("score cell not found");

    fireEvent.click(scoreCell);

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("diana");
  });

  it("previews a row on hover and withdraws it on leave", () => {
    const { onPreview } = renderTable();
    const row = screen.getByRole("button", { name: "Lissandra, score 81" }).closest("tr");
    if (row === null) throw new Error("row not found");

    fireEvent.mouseEnter(row);
    expect(onPreview).toHaveBeenLastCalledWith("lissandra");

    fireEvent.mouseLeave(row);
    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  it("previews a row on keyboard focus too", () => {
    const { onPreview } = renderTable();

    fireEvent.focus(screen.getByRole("button", { name: "Lissandra, score 81" }));

    expect(onPreview).toHaveBeenLastCalledWith("lissandra");
  });

  it("withdraws the preview when the row's button blurs", () => {
    const { onPreview } = renderTable();
    const button = screen.getByRole("button", { name: "Lissandra, score 81" });

    fireEvent.focus(button);
    fireEvent.blur(button);

    expect(onPreview).toHaveBeenLastCalledWith(null);
  });

  // The site never shows an invented number: an unassessed matchup or an
  // unknown winrate leaves its cell empty, not "0" and not a dash.
  it("leaves a cell empty when its value is missing", () => {
    renderTable({ recommendations: [rec("Galio", 88, { matchup: false, winRate: null })] });

    const [, score, patch, matchup, winRate] = cellsOf("Galio", 88);

    expect(score).toBe("88");
    expect(patch).toBe("72");
    expect(matchup).toBe("");
    expect(winRate).toBe("");
  });

  it("leaves the games cell empty when games is missing", () => {
    renderTable({ recommendations: [rec("Galio", 88, { games: null })] });

    const [, , , , , games] = cellsOf("Galio", 88);

    expect(games).toBe("");
  });

  it("explains each column on demand", () => {
    renderTable();

    for (const label of ["Score", "Force dans le patch", "Matchup", "Winrate", "Parties"]) {
      expect(screen.getByRole("button", { name: `Qu'est-ce que ${label} ?` })).toBeInTheDocument();
    }

    fireEvent.click(screen.getByRole("button", { name: "Qu'est-ce que Matchup ?" }));

    expect(screen.getByRole("tooltip")).toHaveTextContent("votre adversaire direct compte double");
  });
});
