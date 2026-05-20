"use client";

import type React from "react";
import { useMemo, useState } from "react";
import { ChampionPicker } from "./champion-picker";
import { DecisionSpace } from "./decision-space";
import type { Recommendation } from "@/lib/recommendation/types";

const C = {
  bg1: "#07101f",
  bg2: "#0a1830",
  surface: "#0a1830",
  surfaceAlt: "#112447",
  jade: "#4cf2b4",
  fg: "#e8eef9",
  fgMuted: "#98a6c2",
  fgFaint: "#5d6e8c",
  line: "rgba(120,180,220,0.10)",
  lineStrong: "rgba(120,180,220,0.18)",
  gold: "#d8b264",
  glow: "0 0 0 1px rgba(76,242,180,0.28), 0 0 50px -8px rgba(76,242,180,0.5)",
};

type Champion = {
  id: string;
  name: string;
  imageUrl?: string;
};

const fallbackChampions: Champion[] = [
  { id: "ahri", name: "Ahri", imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Ahri.png" },
  { id: "orianna", name: "Orianna", imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Orianna.png" },
  { id: "zed", name: "Zed", imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Zed.png" },
  { id: "jinx", name: "Jinx", imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Jinx.png" },
  { id: "kaisa", name: "Kai'Sa", imageUrl: "https://ddragon.leagueoflegends.com/cdn/16.3.1/img/champion/Kaisa.png" }
];

export function CoachWorkspace({ champions = fallbackChampions }: { champions?: Champion[] }) {
  const [riotId, setRiotId] = useState("");
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

  const card: React.CSSProperties = {
    borderRadius: 12, padding: 16,
    background: C.surface, border: `1px solid ${C.line}`,
  };
  const label: React.CSSProperties = {
    fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase",
    color: C.fgFaint, marginBottom: 10, display: "block",
    fontFamily: "var(--font-display)",
  };

  return (
    <main style={{ minHeight: "100vh", background: C.bg1, color: C.fg, fontFamily: "var(--font-body)" }}>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

          {/* ── Left sidebar ── */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Brand block */}
            <div style={{ ...card, paddingBottom: 18 }}>
              <div style={{
                fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700,
                letterSpacing: "-0.02em", color: C.fg, marginBottom: 6,
              }}>
                DraftForMe
              </div>
              <p style={{ fontSize: 13, color: C.fgMuted, margin: "0 0 14px", lineHeight: 1.5 }}>
                Ton coach personnel pour comprendre le meilleur pick.
              </p>
              <div>
                <label htmlFor="riot-id" style={label}>Riot ID</label>
                <input
                  id="riot-id"
                  type="text"
                  value={riotId}
                  onChange={(event) => setRiotId(event.target.value)}
                  placeholder="Nom#TAG"
                  autoComplete="username"
                  style={{
                    width: "100%", borderRadius: 8, padding: "9px 12px",
                    background: C.bg2, border: `1px solid ${C.lineStrong}`,
                    color: C.fg, fontSize: 14, fontFamily: "var(--font-body)",
                  }}
                />
                <p style={{ fontSize: 12, color: C.fgMuted, margin: "8px 0 0", lineHeight: 1.4 }}>
                  Ajoute ton identifiant Riot pour preparer ton profil DraftForMe.
                </p>
              </div>
            </div>

            {/* Role picker */}
            <div style={card}>
              <label htmlFor="role" style={label}>Rôle</label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                style={{
                  width: "100%", borderRadius: 8, padding: "9px 12px",
                  background: C.bg2, border: `1px solid ${C.lineStrong}`,
                  color: C.fg, fontSize: 14, fontFamily: "var(--font-body)", cursor: "pointer",
                }}
              >
                <option value="top">Top</option>
                <option value="jungle">Jungle</option>
                <option value="mid">Mid</option>
                <option value="adc">ADC</option>
                <option value="support">Support</option>
              </select>
            </div>

            {/* Priority slider */}
            <div style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span style={{ ...label, margin: 0, display: "inline" }}>Priorité méta</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: C.jade }}>{priority}</span>
              </div>
              <input
                type="range" min="0" max="100" value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.jade }}
              />
            </div>
          </aside>

          {/* ── Main content ── */}
          <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Picks + bans row */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div style={card}>
                <span style={label}>Picks ennemis</span>
                <ChampionPicker
                  champions={champions}
                  selectedIds={enemyPicks}
                  onToggle={toggleEnemy}
                  searchLabel="Rechercher un pick ennemi"
                />
              </div>
              <div style={card}>
                <span style={label}>Bans</span>
                <ChampionPicker
                  champions={champions}
                  selectedIds={bans}
                  onToggle={toggleBan}
                  searchLabel="Rechercher un ban"
                />
              </div>
            </div>

            {/* Generate button */}
            <div>
              <button
                type="button"
                onClick={requestRecommendations}
                disabled={isLoading || selectedIds.length === 0}
                style={{
                  width: "100%", padding: "13px 20px", borderRadius: 10,
                  fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14,
                  background: isLoading || selectedIds.length === 0
                    ? "rgba(76,242,180,0.25)"
                    : C.jade,
                  color: "#062013",
                  border: "none", cursor: selectedIds.length === 0 || isLoading ? "not-allowed" : "pointer",
                  boxShadow: selectedIds.length > 0 && !isLoading ? C.glow : "none",
                  transition: "box-shadow .2s, background .15s",
                }}
              >
                {isLoading ? "Analyse en cours…" : "Générer les recommandations"}
              </button>
              {error && (
                <p style={{ fontSize: 13, color: "#e87171", marginTop: 8, margin: "8px 0 0" }}>{error}</p>
              )}
            </div>

            {/* Recommendations */}
            {recommendations.length === 0 ? (
              <div style={{
                ...card, padding: 32, textAlign: "center",
                fontSize: 14, color: C.fgMuted, lineHeight: 1.6,
              }}>
                Ajoute des picks ennemis ou des bans,<br />puis lance l'analyse.
              </div>
            ) : (
              <DecisionSpace recommendations={recommendations} />
            )}
          </section>

        </div>
      </div>
    </main>
  );
}
