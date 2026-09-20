// These pin the two invariants the behaviour tests cannot see: that only the
// newest request may write state, and that a slider drag issues one request
// rather than one per tick. Both survive a rewrite only if something fails
// loudly when they are removed.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  { id: "darius", name: "Darius" }
];

const initialDraft = createDraftState({ yourRole: "mid" });
const initial = [rec("Galio", 88)];
const initialWithPool = [rec("Galio", 88, { withPool: true })];

function ok(name: string) {
  return new Response(JSON.stringify({ recommendations: [rec(name, 90)] }), { status: 200 });
}

// Both the enemy column and the map anchor buttons are labelled "Top adverse,
// vide" -- deliberately, so keyboard and mouse users get the same product.
// Scoping to the enemy column ("En face") is what disambiguates the query;
// the picker itself (the combobox, the champion buttons) is not ambiguous
// with anything else on the page, so it is queried unscoped.
function enemyColumn() {
  return within(screen.getByRole("group", { name: "En face" }));
}

// The recommended champion's name is rendered twice: once as plain text in
// the "your lane" column slot, once in the Verdict below. A bare getByText
// is ambiguous whenever the two coincide, which every assertion here about
// which recommendation won does. Scoping to this panel disambiguates it.
function recommendationPanel() {
  return within(screen.getByRole("group", { name: "Recommandation" }));
}

// Two placements, so two requests, without depending on the picker's internals.
function placeTwoEnemies() {
  fireEvent.click(enemyColumn().getByRole("button", { name: "Top adverse, vide" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "darius" } });
  fireEvent.click(screen.getByRole("button", { name: "Darius" }));

  fireEvent.click(enemyColumn().getByRole("button", { name: "Mid adverse, vide" }));
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "zed" } });
  fireEvent.click(screen.getByRole("button", { name: "Zed" }));
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftBoard request handling", () => {
  it("discards a superseded request even when it resolves last", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initial} />);

    placeTwoEnemies();

    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The newest request settles first; the stale one settles last and must lose.
    resolvers[1](ok("Briar"));
    resolvers[0](ok("Anivia"));

    await waitFor(() => expect(recommendationPanel().getByText("Briar")).toBeInTheDocument());
    expect(screen.queryByText("Anivia")).not.toBeInTheDocument();
  });

  it("does not leave a stale error banner over a newer success", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initial} />);

    placeTwoEnemies();

    await waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1](ok("Briar"));
    resolvers[0](new Response("", { status: 500 }));

    await waitFor(() => expect(recommendationPanel().getByText("Briar")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("collapses a slider drag into a single request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initialWithPool} />);

    const slider = screen.getByLabelText(/priorité/i);
    for (const value of ["55", "62", "71", "80", "90"]) {
      fireEvent.change(slider, { target: { value } });
    }

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).priority).toBe(90);
  });

  it("does not let a pending slider request carry a draft the user has since changed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(<DraftBoard champions={champions} initialDraft={initialDraft} initialRecommendations={initialWithPool} />);

    // The draft changes inside the debounce window. The pending timer closed
    // over the old draft and would be issued last, so it would also take the
    // highest request id and win.
    fireEvent.change(screen.getByLabelText(/priorité/i), { target: { value: "90" } });
    fireEvent.click(enemyColumn().getByRole("button", { name: "Top adverse, vide" }));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "darius" } });
    fireEvent.click(screen.getByRole("button", { name: "Darius" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    // Long enough that a surviving timer would have fired.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual([{ championId: "darius", role: "top" }]);
    expect(body.priority).toBe(90);
  });
});
