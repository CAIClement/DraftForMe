import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DraftTool } from "./draft-tool";
import type { Recommendation } from "@/lib/recommendation/types";

// `hasPool` decides whether the priority slider exists at all, and the engine
// reports it as the player factor's `available`. The default fixture is the
// signed-out case every visitor gets; `withPool` is the signed-in one.
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

const initial = [rec("Galio", 88), rec("Lissandra", 81), rec("Diana", 74)];

afterEach(() => {
  vi.restoreAllMocks();
});

describe("DraftTool", () => {
  it("renders the pre-solved example on first paint without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    expect(screen.getByText("Galio")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requests new recommendations when the role changes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ recommendations: [rec("Darius", 90)] }), { status: 200 })
    );

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => expect(screen.getByText("Darius")).toBeInTheDocument());
  });

  it("adjusts the weighting from inside the dossier, not before it", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ recommendations: [rec("Orianna", 85)] }), { status: 200 }));

    render(
      <DraftTool
        champions={champions}
        initialRole="mid"
        initialEnemyPicks={["zed"]}
        initialRecommendations={[rec("Galio", 88, { withPool: true })]}
      />
    );

    fireEvent.change(screen.getByLabelText(/priorité/i), { target: { value: "90" } });

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.priority).toBe(90);
  });

  // `computeWeights` throws `priority` away whenever the pool is empty, so with
  // no pool the slider would take a drag, redraw its number, fire a request and
  // return the identical ranking. It must not be on screen at all.
  it("does not offer the priority slider when the player factor could not be assessed", () => {
    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    expect(screen.queryByLabelText(/priorité/i)).not.toBeInTheDocument();
    expect(screen.getByText(/le classement est entièrement méta/i)).toBeInTheDocument();
  });

  it("offers the priority slider once the player factor is available", () => {
    render(
      <DraftTool
        champions={champions}
        initialRole="mid"
        initialEnemyPicks={["zed"]}
        initialRecommendations={[rec("Galio", 88, { withPool: true })]}
      />
    );

    expect(screen.getByLabelText(/priorité/i)).toBeInTheDocument();
    expect(screen.queryByText(/le classement est entièrement méta/i)).not.toBeInTheDocument();
  });

  it("sends an added enemy pick", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ recommendations: [rec("Orianna", 85)] }), { status: 200 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.change(screen.getByLabelText("Rechercher un pick ennemi"), { target: { value: "caitlyn" } });
    fireEvent.click(screen.getByRole("button", { name: "Caitlyn" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual(["zed", "caitlyn"]);
  });

  it("sends the reduced list when an enemy pick is removed", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ recommendations: [rec("Orianna", 85)] }), { status: 200 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Retirer Zed" }));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const body = JSON.parse(String(fetchSpy.mock.calls[0][1]?.body));
    expect(body.enemyPicks).toEqual([]);
  });

  it("finds a punctuated champion by its slug", () => {
    render(
      <DraftTool
        champions={[...champions, { id: "kaisa", name: "Kai'Sa" }]}
        initialRole="mid"
        initialEnemyPicks={[]}
        initialRecommendations={initial}
      />
    );

    fireEvent.change(screen.getByLabelText("Rechercher un pick ennemi"), { target: { value: "kaisa" } });

    expect(screen.getByRole("button", { name: "Kai'Sa" })).toBeInTheDocument();
  });

  it("clears the error banner once a later request succeeds", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("", { status: 500 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ recommendations: [rec("Darius", 90)] }), { status: 200 })
    );
    fireEvent.click(screen.getByRole("button", { name: "Jungle" }));

    await waitFor(() => expect(screen.getByText("Darius")).toBeInTheDocument());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps the previous result on screen when the request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status: 500 }));

    render(<DraftTool champions={champions} initialRole="mid" initialEnemyPicks={["zed"]} initialRecommendations={initial} />);

    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText("Galio")).toBeInTheDocument();
  });
});
