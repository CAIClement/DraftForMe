"use client";

import { useReducer, useRef, useState } from "react";
import { Alternatives } from "./alternatives";
import { ChampionPicker } from "./champion-picker";
import { DraftSlot } from "./draft-slot";
import { PriorityControl, PriorityUnavailable } from "./priority-control";
import { RefinePrompt } from "./refine-prompt";
import { RiftMap } from "./rift-map";
import { Verdict } from "./verdict";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import {
  allyPickIds,
  draftReducer,
  enemyPicksWithRoles,
  excludedChampionIds,
  type DraftState,
  type Side
} from "@/lib/draft/draft-state";
import { ROLES, ROLE_LABELS } from "@/lib/draft/roles";
import type { Recommendation } from "@/lib/recommendation/types";

export type BoardChampion = { id: string; name: string; imageUrl?: string };

const PRIORITY_DEBOUNCE_MS = 250;

export function DraftBoard({
  champions,
  initialDraft,
  initialRecommendations
}: {
  champions: BoardChampion[];
  initialDraft: DraftState;
  initialRecommendations: Recommendation[];
}) {
  const [draft, dispatch] = useReducer(draftReducer, initialDraft);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only the newest request may write state. Without this, two in-flight
  // requests resolve in arbitrary order and the slower one wins, leaving a
  // recommendation on screen that does not match the visible board.
  const requestId = useRef(0);

  // The slider fires on every tick of a drag, not on release, so one drag
  // would otherwise be dozens of POSTs against a database-backed route.
  const priorityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = new Map(champions.map((champion) => [champion.id, champion]));

  // The previous result deliberately stays on screen while a request is in
  // flight and after a failure: emptying it would punish the user for a
  // transient error and undo the "already solved" premise of the page.
  async function refresh(next: DraftState) {
    // A pending slider request closed over an older draft, and because it
    // would be issued last it would also carry the highest request id -- so
    // the guard below would hand the stale one the win.
    if (priorityTimer.current) clearTimeout(priorityTimer.current);

    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: next.yourRole,
          region: DEFAULT_EXAMPLE.region,
          tier: DEFAULT_EXAMPLE.tier,
          enemyPicks: enemyPicksWithRoles(next),
          allyPicks: allyPickIds(next),
          bans: [],
          priority: next.priority,
          topN: 4
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

  // Every mutator computes the next state itself and hands it to both the
  // reducer and the request, so the request never reads a stale render.
  function apply(action: Parameters<typeof draftReducer>[1]) {
    const next = draftReducer(draft, action);
    dispatch(action);
    if (next !== draft) void refresh(next);
  }

  function changePriority(priority: number) {
    const next = draftReducer(draft, { type: "setPriority", priority });
    dispatch({ type: "setPriority", priority });
    if (priorityTimer.current) clearTimeout(priorityTimer.current);
    priorityTimer.current = setTimeout(() => {
      void refresh(next);
    }, PRIORITY_DEBOUNCE_MS);
  }

  const [top, ...rest] = recommendations;
  const playerFactor = top?.explanation.factors.find((factor) => factor.key === "player");

  const recommended =
    top === undefined
      ? null
      : {
          championId: top.championId,
          championName: top.championName,
          championImageUrl: top.championImageUrl
        };

  // Held once so the picker's `onPick` closure narrows on `picker`, not on
  // `draft.picker` re-read behind a `!`. The assertion was safe -- the
  // picker only ever renders while this is non-null -- but it was invisible;
  // this makes the compiler carry the guarantee instead of a promise.
  const picker = draft.picker;

  function column(side: Side) {
    const label = side === "ally" ? "Votre équipe" : "En face";

    return (
      // The map's anchors and this column's slots deliberately share their
      // accessible names ("Top adverse, vide") so keyboard and mouse users
      // get the same product. That means a bare role query is ambiguous
      // between the two; wrapping each region in its own labelled group is
      // what lets a test (or an assistive-tech user) disambiguate, without
      // renaming either button.
      <section role="group" aria-label={label} className="flex flex-col gap-1.5">
        <span
          className={`text-[9.5px] font-extrabold uppercase tracking-[0.18em] ${side === "ally" ? "text-team-ally" : "text-team-enemy"}`}
        >
          {label}
        </span>
        {ROLES.map((role) => {
          const isYourLane = side === "ally" && role === draft.yourRole;
          const championId = draft[side][role];
          const champion = isYourLane
            ? recommended === null
              ? null
              : { id: recommended.championId, name: recommended.championName, imageUrl: recommended.championImageUrl }
            : championId === null
              ? null
              : (byId.get(championId) ?? { id: championId, name: championId });

          return (
            <div key={role}>
              <DraftSlot
                side={side}
                role={role}
                champion={champion}
                isYourLane={isYourLane}
                onOpen={(openSide, openRole) => dispatch({ type: "openPicker", side: openSide, role: openRole })}
                onClear={(clearSide, clearRole) => apply({ type: "clear", side: clearSide, role: clearRole })}
              />
              {side === "ally" && !isYourLane && (
                <button
                  type="button"
                  onClick={() => apply({ type: "setYourRole", role })}
                  className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-ink-faint underline"
                >
                  {`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                </button>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <div data-surface="draft" className="rounded-xl border border-rule bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-[186px_1fr_186px]">
        {column("ally")}

        <section role="group" aria-label="Carte de la Faille" className="relative">
          <RiftMap
            state={draft}
            champions={champions}
            recommended={recommended}
            onSlotClick={(side, role) => {
              if (side === "ally" && role === draft.yourRole) return;
              if (draft[side][role] === null) dispatch({ type: "openPicker", side, role });
              else apply({ type: "clear", side, role });
            }}
          />
          {picker !== null && (
            <ChampionPicker
              champions={champions}
              excludedIds={excludedChampionIds(draft)}
              target={picker}
              onPick={(championId) =>
                apply({
                  type: "place",
                  side: picker.side,
                  role: picker.role,
                  championId
                })
              }
              onClose={() => dispatch({ type: "closePicker" })}
            />
          )}
        </section>

        {column("enemy")}
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-rule bg-surface-sunk px-3 py-2 text-xs text-ink-muted">
          {error}
        </p>
      )}

      {/* The recommended champion's name is also rendered as plain text in the
          "your lane" column slot above (see `column`), so its own label here
          disambiguates a text query the same way the two columns and the map
          disambiguate their shared slot names. */}
      <div
        role="group"
        aria-label="Recommandation"
        aria-busy={isLoading}
        className="mt-4 border-t border-rule-soft pt-4"
      >
        {top ? (
          <>
            <Verdict recommendation={top} />
            {playerFactor?.available ? (
              <PriorityControl value={draft.priority} onChange={changePriority} />
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
