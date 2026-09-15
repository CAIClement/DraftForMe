"use client";

import { useRef, useState } from "react";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import type { Recommendation } from "@/lib/recommendation/types";
import { Alternatives } from "./alternatives";
import { EnemyPicks, type Champion } from "./enemy-picks";
import { PriorityControl, PriorityUnavailable } from "./priority-control";
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

  // Only the newest request may write state. Without this, two in-flight
  // requests resolve in arbitrary order and the slower one wins, leaving
  // recommendations on screen that do not match the visible controls.
  const requestId = useRef(0);

  // The slider fires on every tick of a drag, not on release, so one drag
  // would otherwise be dozens of POSTs against a database-backed route.
  const priorityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The previous result deliberately stays on screen while a request is in
  // flight and after a failure: emptying it would punish the user for a
  // transient error and undo the "already solved" premise of the page.
  async function refresh(nextRole: string, nextEnemyPicks: string[], nextPriority: number) {
    // A pending slider request closed over the role and picks of an older
    // render, and because it would be issued last it would also carry the
    // highest request id -- so the guard below would hand the stale one the
    // win. Every other path already sends the current priority, which makes
    // that pending request redundant anyway. Clearing an already-fired handle
    // from inside the timer's own callback is a no-op.
    if (priorityTimer.current) clearTimeout(priorityTimer.current);

    const id = ++requestId.current;
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

      if (id !== requestId.current) return;

      if (!response.ok) {
        setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
        return;
      }

      const payload = (await response.json()) as { recommendations: Recommendation[] };
      if (id !== requestId.current) return;
      setRecommendations(payload.recommendations);
    } catch {
      if (id !== requestId.current) return;
      setError("Impossible de mettre à jour la recommandation. Le résultat affiché est le précédent.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
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

  // The number beside the slider tracks the thumb immediately; only the
  // request is deferred. There is deliberately no `useEffect` in this file --
  // that is what makes it structurally impossible to fetch on first paint,
  // which the pre-solved example depends on. The cost is that a timer can
  // outlive an unmount by one interval; the request id then discards its
  // result, so the worst case is a single wasted fetch.
  function changePriority(nextPriority: number) {
    setPriority(nextPriority);
    if (priorityTimer.current) clearTimeout(priorityTimer.current);
    priorityTimer.current = setTimeout(() => {
      void refresh(role, enemyPicks, nextPriority);
    }, 250);
  }

  const [top, ...rest] = recommendations;

  // The weighting question is only answerable when the player side of it has an
  // answer. `available` on this factor is global rather than per-champion, so it
  // is true exactly when the engine actually had a pool to weigh.
  const playerFactor = top?.explanation.factors.find((factor) => factor.key === "player");

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
            {playerFactor?.available ? (
              <PriorityControl value={priority} onChange={changePriority} />
            ) : (
              <PriorityUnavailable />
            )}
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
