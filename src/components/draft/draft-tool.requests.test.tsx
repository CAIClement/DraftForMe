// These three pin the two invariants the eight tests in draft-tool.test.tsx
// cannot see: that only the newest request may write state, and that a slider
// drag issues one request rather than one per tick. Every one of those eight
// passes against an implementation with neither guard, so without this file a
// later reader could delete the request id or the debounce and stay green.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftTool } from "./draft-tool";
import type { Recommendation } from "@/lib/recommendation/types";

function rec(name: string, score: number): Recommendation {
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
        { key: "player", label: "Votre pool", score: 50, weight: 0, detail: "", available: false },
        { key: "counter", label: "Matchup", score: 80, weight: 40, detail: "Prend l'avantage.", available: true }
      ],
      warnings: [],
      alternatives: []
    }
  };
}

const champions = [{ id: "zed", name: "Zed" }];
const initial = [rec("Galio", 88)];

function ok(name: string) {
  return new Response(JSON.stringify({ recommendations: [rec(name, 90)] }), { status: 200 });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftTool request handling", () => {
  it("discards a superseded request even when it resolves last", async () => {
    const resolvers: Array<(response: Response) => void> = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolvers.push(resolve);
        })
    );

    render(
      <DraftTool champions={champions} initialRole="mid" initialEnemyPicks={[]} initialRecommendations={initial} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));

    await waitFor(() => expect(resolvers).toHaveLength(2));

    // The newest request settles first; the stale one settles last and must lose.
    resolvers[1](ok("Briar"));
    resolvers[0](ok("Anivia"));

    await waitFor(() => expect(screen.getByText("Briar")).toBeInTheDocument());
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

    render(
      <DraftTool champions={champions} initialRole="mid" initialEnemyPicks={[]} initialRecommendations={initial} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));

    await waitFor(() => expect(resolvers).toHaveLength(2));

    resolvers[1](ok("Briar"));
    resolvers[0](new Response("", { status: 500 }));

    await waitFor(() => expect(screen.getByText("Briar")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("collapses a slider drag into a single request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(
      <DraftTool champions={champions} initialRole="mid" initialEnemyPicks={[]} initialRecommendations={initial} />
    );

    const slider = screen.getByLabelText(/priorité/i);
    for (const value of ["55", "62", "71", "80", "90"]) {
      fireEvent.change(slider, { target: { value } });
    }

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body)).priority).toBe(90);
  });

  it("does not let a pending slider request carry a role the user has since changed", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(ok("Briar"));

    render(
      <DraftTool champions={champions} initialRole="mid" initialEnemyPicks={[]} initialRecommendations={initial} />
    );

    // The role changes inside the debounce window. The pending timer closed
    // over the old role and would be issued last, so it would also take the
    // highest request id and win.
    fireEvent.change(screen.getByLabelText(/priorité/i), { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());

    // Long enough that a surviving timer would have fired.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.role).toBe("top");
    expect(body.priority).toBe(90);
  });
});
