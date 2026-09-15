"use client";

import { useState } from "react";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import type { Recommendation } from "@/lib/recommendation/types";
import { Alternatives } from "./alternatives";
import { EnemyPicks, type Champion } from "./enemy-picks";
import { PriorityControl } from "./priority-control";
import { RefinePrompt } from "./refine-prompt";
import { RoleSelector } from "./role-selector";
import { Verdict } from "./verdict";

export function DraftTool({
  champions,
  initialRole,
  initialEnemyPicks,
  initialRecommendations
}: {
  champions: Champion[];
  initialRole: string;
  initialEnemyPicks: string[];
  initialRecommendations: Recommendation[];
}) {
  const [role, setRole] = useState(initialRole);
  const [enemyPicks, setEnemyPicks] = useState<string[]>(initialEnemyPicks);
  const [priority, setPriority] = useState(50);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The previous result deliberately stays on screen while a request is in
  // flight and after a failure: emptying it would punish the user for a
  // transient error and undo the "already solved" premise of the page.
  async function refresh(nextRole: string, nextEnemyPicks: string[], nextPriority: number) {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: nextRole,
          region: DEFAULT_EXAMPLE.region,
          tier: DEFAULT_EXAMPLE.tier,
          enemyPicks: nextEnemyPicks,
          bans: [],
          priority: nextPriority,
          topN: 3
        })
      });

      if (!response.ok) {
        setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
        return;
      }

      const payload = (await response.json()) as { recommendations: Recommendation[] };
      setRecommendations(payload.recommendations);
    } catch {
      setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
    } finally {
      setIsLoading(false);
    }
  }

  function changeRole(nextRole: string) {
    setRole(nextRole);
    void refresh(nextRole, enemyPicks, priority);
  }

  function addEnemy(championId: string) {
    const next = [...enemyPicks, championId];
    setEnemyPicks(next);
    void refresh(role, next, priority);
  }

  function removeEnemy(championId: string) {
    const next = enemyPicks.filter((id) => id !== championId);
    setEnemyPicks(next);
    void refresh(role, next, priority);
  }

  function changePriority(nextPriority: number) {
    setPriority(nextPriority);
    void refresh(role, enemyPicks, nextPriority);
  }

  const [top, ...rest] = recommendations;

  return (
    <div className="rounded-xl border border-rule bg-surface p-4 shadow-sm">
      <div className="mb-3.5 grid gap-3.5 sm:grid-cols-[1.1fr_1fr]">
        <div>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-faint">
            1 · Votre rôle
          </span>
          <RoleSelector role={role} onChange={changeRole} />
        </div>
        <div>
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-ink-faint">
            2 · Déjà pické en face
          </span>
          <EnemyPicks champions={champions} selectedIds={enemyPicks} onAdd={addEnemy} onRemove={removeEnemy} />
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-2.5 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
          {error}
        </p>
      )}

      <div aria-busy={isLoading} className="border-t border-rule-soft pt-3.5">
        {top ? (
          <>
            <Verdict recommendation={top} />
            <PriorityControl value={priority} onChange={changePriority} />
            <Alternatives recommendations={rest} />
            <RefinePrompt />
          </>
        ) : (
          <p className="py-6 text-center text-sm text-ink-muted">
            Aucune recommandation disponible pour ce rôle.
          </p>
        )}
      </div>
    </div>
  );
}
