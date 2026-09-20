import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftBoard } from "./draft-board";
import { createDraftState } from "@/lib/draft/draft-state";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(name: string, score: number, { withPool = false } = {}): Recommendation {
  return {
    championId: name.toLowerCase(),
    championName: name,
    championImageUrl: undefined,
    totalScore: score,
    metaScore: 70,
    playerScore: 50,
    counterScore: 80,
    rank: 3,
    winRate: 51,
    pickRate: 4,
    banRate: 2,
    games: 1000,
    totalRanked: 60,
    explanation: {
      summary: "",
      factors: [
        { key: "meta", label: "Force dans le patch", score: 70, weight: 60, detail: "", available: true },
        { key: "player", label: "Votre pool", score: 50, weight: 0, detail: "", available: withPool },
        { key: "counter", label: "Matchup", score: 80, weight: 40, detail: "Prend l'avantage.", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const champions = [
  { id: "zed", name: "Zed" },
  { id: "caitlyn", name: "Caitlyn" },
  { id: "galio", name: "Galio" }
];

const solved = createDraftState({ yourRole: "mid", enemyPicks: [{ championId: "zed", role: "mid" }] });
const initial = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74)];

function ok(name: string) {
  return new Response(JSON.stringify({ recommendations: [rec(name, 90)] }), { status: 200 });
}

// Enemy and ally columns share their empty-slot wording with the map's anchors
// ("Top adverse, vide") by design, so a bare getByRole match is ambiguous.
// Scoping to the column group ("En face" / "Votre équipe") disambiguates it.
function enemyColumn() {
  return within(screen.getByRole("group", { name: "En face" }));
}

function allyColumn() {
  return within(screen.getByRole("group", { name: "Votre équipe" }));
}

// The recommended champion's name is rendered twice: once as plain text in
// the "your lane" column slot, once in the Verdict below. A bare getByText
// is ambiguous whenever the two coincide, which every test that checks "the
// recommendation changed" does. Scoping to this panel disambiguates it.
function recommendationPanel() {
  return within(screen.getByRole("group", { name: "Recommandation" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftBoard", () => {
  it("renders the pre-solved example on first paint without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    expect(recommendationPanel().getByText("Galio")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends a placed enemy with its lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(enemyColumn().getByRole("button", { name: "ADC adverse, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "caitlyn" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual([
      { championId: "zed", role: "mid" },
      { championId: "caitlyn", role: "adc" }
    ]);
    expect(body.role).toBe("mid");
  });

  // Allies exist to be excluded. If they stopped being sent, the only symptom
  // would be a champion recommended while sitting in your own team's list.
  it("sends allied picks so they leave the candidate list", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(allyColumn().getByRole("button", { name: "Top allié, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "galio" } });
    fireEvent.click(screen.getByRole("button", { name: "Galio" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).allyPicks).toEqual(["galio"]);
  });

  it("sends the reduced list when an enemy is removed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).enemyPicks).toEqual([]);
  });

  // Neither `draft-state.test.ts` (which calls `excludedChampionIds` directly)
  // nor `champion-picker.test.tsx` (which supplies `excludedIds` as a literal
  // prop) exercises the wire between them at this component: the line that
  // passes `excludedChampionIds(draft)` into `ChampionPicker`. If that
  // argument were dropped, the board would offer to recommend a champion
  // already standing on the map.
  it("excludes an already-placed champion from a picker opened on a different lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Orianna"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(enemyColumn().getByRole("button", { name: "Top adverse, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "caitlyn" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    fireEvent.click(enemyColumn().getByRole("button", { name: "Jungle adverse, vide" }));

    expect(screen.queryByRole("button", { name: "Caitlyn" })).not.toBeInTheDocument();
    // Matters as much as the line above: without it, a picker excluding
    // everyone (or rendering nothing) would also pass.
    expect(screen.getByRole("button", { name: "Galio" })).toBeInTheDocument();
  });

  it("requests again when you change lane", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Darius"));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Jouer top" }));

    await waitFor(() => expect(recommendationPanel().getByText("Darius")).toBeInTheDocument());
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).role).toBe("top");
  });

  it("does not offer the priority slider when the player factor could not be assessed", () => {
    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    expect(screen.queryByLabelText(/priorité/i)).not.toBeInTheDocument();
    expect(screen.getByText(/le classement est entièrement méta/i)).toBeInTheDocument();
  });

  it("keeps the previous result on screen when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(recommendationPanel().getByText("Galio")).toBeInTheDocument();
  });

  it("clears the error banner once a later request succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 500 }));

    render(<DraftBoard champions={champions} initialDraft={solved} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fetchSpy.mockResolvedValue(ok("Darius"));
    fireEvent.click(screen.getByRole("button", { name: "Jouer top" }));

    await waitFor(() => expect(recommendationPanel().getByText("Darius")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
