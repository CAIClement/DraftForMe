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
  directOpponent,
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

// "Play this lane". Drawn inline rather than pulled from an icon library for
// one glyph; `currentColor` lets the button's hover colour reach it.
function PlayerIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

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

  // Ephemeral by design: a preview changes what the map shows and nothing
  // else. It never enters the draft and never triggers a request.
  const [previewId, setPreviewId] = useState<string | null>(null);

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

  // A preview only ever points at an entry from the list already on screen
  // -- it is a look, not a fetch -- so a stale id (the previewed alternative
  // got promoted or the list changed under it) simply falls back to `top`
  // rather than showing nothing.
  const previewed = previewId === null ? undefined : recommendations.find((entry) => entry.championId === previewId);
  const shown = previewed ?? top;

  const recommended =
    shown === undefined
      ? null
      : {
          championId: shown.championId,
          championName: shown.championName,
          championImageUrl: shown.championImageUrl
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
            <div
              key={role}
              className="relative slot-rise"
              style={{ animationDelay: `${ROLES.indexOf(role) * 40}ms` }}
            >
              <DraftSlot
                side={side}
                role={role}
                champion={champion}
                isYourLane={isYourLane}
                onOpen={(openSide, openRole) => dispatch({ type: "openPicker", side: openSide, role: openRole })}
                onClear={(clearSide, clearRole) => apply({ type: "clear", side: clearSide, role: clearRole })}
              />
              {/* Sits on top of the slot rather than under it: as a row of its
                  own it doubled the column's height and made five lanes read as
                  ten. It cannot be nested inside the slot -- that slot is itself
                  a button, and a button inside a button is invalid. Its
                  accessible name and tooltip say what it does; the icon alone
                  is the visible label. */}
              {side === "ally" && !isYourLane && (
                <button
                  type="button"
                  onClick={() => apply({ type: "setYourRole", role })}
                  aria-label={`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                  title={`Jouer ${ROLE_LABELS[role].toLowerCase()}`}
                  className="absolute right-1.5 top-1/2 grid h-[26px] w-[26px] -translate-y-1/2 place-items-center rounded-md border border-rule bg-surface text-ink-faint hover:border-accent hover:text-accent"
                >
                  <PlayerIcon />
                </button>
              )}
            </div>
          );
        })}
      </section>
    );
  }

  return (
    <div className="rounded-xl border border-rule bg-surface p-4">
      <div className="grid gap-4 sm:grid-cols-[170px_1fr_170px]">
        {column("ally")}

        <section
          role="group"
          aria-label="Carte de la Faille"
          className={`relative ${isLoading ? "board-sweep opacity-80 saturate-[0.6] transition-[opacity,filter]" : ""}`}
        >
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
            <Verdict recommendation={top} role={draft.yourRole} enemyChampionId={directOpponent(draft)} />
            {playerFactor?.available ? (
              <PriorityControl value={draft.priority} onChange={changePriority} />
            ) : (
              <PriorityUnavailable />
            )}
            <Alternatives
              recommendations={rest}
              onPreview={setPreviewId}
              onSelect={(championId) => {
                setPreviewId(null);
                // Reorders what the server already sent; it asks for nothing new
                // because the server has already answered this exact draft.
                setRecommendations((current) => {
                  const chosen = current.find((entry) => entry.championId === championId);
                  if (chosen === undefined) return current;
                  return [chosen, ...current.filter((entry) => entry.championId !== championId)];
                });
              }}
            />
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
