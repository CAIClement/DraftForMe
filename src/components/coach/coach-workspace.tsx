"use client";

import { useMemo, useState } from "react";
import { ChampionPicker } from "./champion-picker";
import { RecommendationCard } from "./recommendation-card";
import type { Recommendation } from "@/lib/recommendation/types";

type Champion = {
  id: string;
  name: string;
};

const fallbackChampions: Champion[] = [
  { id: "ahri", name: "Ahri" },
  { id: "orianna", name: "Orianna" },
  { id: "zed", name: "Zed" },
  { id: "jinx", name: "Jinx" },
  { id: "kaisa", name: "Kai'Sa" }
];

export function CoachWorkspace({ champions = fallbackChampions }: { champions?: Champion[] }) {
  const [role, setRole] = useState("mid");
  const [enemyPicks, setEnemyPicks] = useState<string[]>([]);
  const [bans, setBans] = useState<string[]>([]);
  const [priority, setPriority] = useState(50);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedIds = useMemo(() => [...enemyPicks, ...bans], [enemyPicks, bans]);

  function toggleEnemy(championId: string) {
    setEnemyPicks((current) =>
      current.includes(championId) ? current.filter((id) => id !== championId) : [...current, championId]
    );
  }

  function toggleBan(championId: string) {
    setBans((current) =>
      current.includes(championId) ? current.filter((id) => id !== championId) : [...current, championId]
    );
  }

  async function requestRecommendations() {
    setIsLoading(true);
    setError(null);
    const response = await fetch("/api/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role,
        region: "euw",
        tier: "emerald_plus",
        enemyPicks,
        bans,
        priority
      })
    });

    if (!response.ok) {
      setError("Impossible de générer une recommandation avec les données actuelles.");
      setIsLoading(false);
      return;
    }

    const payload = (await response.json()) as { recommendations: Recommendation[] };
    setRecommendations(payload.recommendations);
    setIsLoading(false);
  }

  return (
    <main className="min-h-screen bg-ink">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-4">
          <section className="rounded-md border border-line bg-panel p-4">
            <h1 className="text-2xl font-semibold text-white">DraftForMe</h1>
            <p className="mt-2 text-sm text-slate-300">Ton coach personnel pour comprendre le meilleur pick.</p>
            <div className="mt-4 flex gap-2">
              <a className="rounded-md border border-line px-3 py-2 text-sm text-white" href="/auth/login?provider=discord">
                Discord
              </a>
              <a className="rounded-md border border-line px-3 py-2 text-sm text-white" href="/auth/login?provider=google">
                Google
              </a>
            </div>
          </section>

          <section className="rounded-md border border-line bg-panel p-4">
            <label className="text-sm font-medium text-white" htmlFor="role">
              Rôle
            </label>
            <select
              id="role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mt-2 w-full rounded-md border border-line bg-ink px-3 py-2 text-white"
            >
              <option value="top">Top</option>
              <option value="jungle">Jungle</option>
              <option value="mid">Mid</option>
              <option value="adc">ADC</option>
              <option value="support">Support</option>
            </select>
          </section>

          <section className="rounded-md border border-line bg-panel p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-white">Priorité meta</h2>
              <span className="text-sm text-slate-300">{priority}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              className="mt-3 w-full"
            />
          </section>
        </aside>

        <section className="grid gap-6 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-4">
            <section className="rounded-md border border-line bg-panel p-4">
              <h2 className="font-medium text-white">Picks ennemis</h2>
              <div className="mt-3">
                <ChampionPicker champions={champions} selectedIds={enemyPicks} onToggle={toggleEnemy} />
              </div>
            </section>

            <section className="rounded-md border border-line bg-panel p-4">
              <h2 className="font-medium text-white">Bans</h2>
              <div className="mt-3">
                <ChampionPicker champions={champions} selectedIds={bans} onToggle={toggleBan} />
              </div>
            </section>

            <button
              type="button"
              onClick={requestRecommendations}
              disabled={isLoading || selectedIds.length === 0}
              className="w-full rounded-md bg-gold px-4 py-3 font-semibold text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? "Analyse en cours..." : "Générer les recommandations"}
            </button>
            {error ? <p className="text-sm text-red-200">{error}</p> : null}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Meilleurs choix</h2>
            {recommendations.length === 0 ? (
              <div className="rounded-md border border-line bg-panel p-6 text-sm text-slate-300">
                Ajoute des picks ennemis ou des bans, puis lance l'analyse.
              </div>
            ) : (
              recommendations.map((recommendation) => (
                <RecommendationCard key={recommendation.championId} recommendation={recommendation} />
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
