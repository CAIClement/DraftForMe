"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { DraftState, Side } from "@/lib/draft/draft-state";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/draft/roles";

export type MapChampion = { id: string; name: string; imageUrl?: string };

export type RecommendedPin = {
  championId: string;
  championName: string;
  championImageUrl?: string;
};

// Percentages of the frame, not of the image: a missing asset costs the
// background and leaves every anchor exactly where it was.
const LANE_POSITIONS: Record<Side, Record<Role, { x: number; y: number }>> = {
  ally: {
    top: { x: 14, y: 36 },
    jungle: { x: 26, y: 52 },
    mid: { x: 40, y: 62 },
    support: { x: 56, y: 92 },
    adc: { x: 72, y: 90 }
  },
  enemy: {
    top: { x: 30, y: 14 },
    jungle: { x: 47, y: 27 },
    mid: { x: 63, y: 37 },
    support: { x: 78, y: 82 },
    adc: { x: 87, y: 69 }
  }
};

function sideLabel(side: Side): string {
  return side === "ally" ? "allié" : "adverse";
}

export function anchorLabel(
  side: Side,
  role: Role,
  championName: string | null,
  isYourLane: boolean,
  recommendedName: string | null
): string {
  if (isYourLane) {
    return recommendedName === null
      ? `Votre lane, ${ROLE_LABELS[role]}`
      : `Votre lane, ${ROLE_LABELS[role]} : ${recommendedName} recommandé`;
  }

  const lane = `${ROLE_LABELS[role]} ${sideLabel(side)}`;
  return championName === null ? `${lane}, vide` : `${lane} : ${championName}`;
}

export function RiftMap({
  state,
  champions,
  recommended,
  onSlotClick
}: {
  state: DraftState;
  champions: MapChampion[];
  recommended: RecommendedPin | null;
  onSlotClick: (side: Side, role: Role) => void;
}) {
  const byId = new Map(champions.map((champion) => [champion.id, champion]));

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[320px] overflow-hidden rounded-xl bg-paper ring-1 ring-rule">
      <img
        src="/map/rift.png"
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />

      {(["ally", "enemy"] as const).map((side) =>
        ROLES.map((role) => {
          const isYourLane = side === "ally" && role === state.yourRole;
          const championId = state[side][role];
          const champion = championId === null ? undefined : byId.get(championId);
          const position = LANE_POSITIONS[side][role];

          const pinName = isYourLane ? (recommended?.championName ?? null) : (champion?.name ?? championId);
          const pinImage = isYourLane ? recommended?.championImageUrl : champion?.imageUrl;

          // Your own lane's occupant is the recommendation, not a stored pick
          // (`championId` here is always null for it -- see draftReducer's
          // "place" case). Keying on `championId` alone would replay the
          // landing animation for every manually-placed pick but never for a
          // changed recommendation, which is the occupant that changes most
          // often on this anchor.
          const occupantId = isYourLane ? (recommended?.championId ?? null) : championId;

          const ringColorClass = isYourLane
            ? "ring-accent"
            : side === "ally"
              ? "ring-team-ally"
              : "ring-team-enemy";
          const ring = `ring-2 ${ringColorClass}`;

          return (
            <button
              key={`${side}-${role}-${occupantId ?? "empty"}`}
              type="button"
              onClick={() => onSlotClick(side, role)}
              aria-label={anchorLabel(side, role, champion?.name ?? championId, isYourLane, recommended?.championName ?? null)}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              className={`pin-drop absolute -translate-x-1/2 -translate-y-1/2 ${
                pinName === null
                  ? // `bg-paper/70` would be silently inert: this project's colour tokens are
                    // bare `var(--x)` with no `<alpha-value>` channel, so Tailwind emits no
                    // rule at all for an opacity modifier on one. The arbitrary value does
                    // emit, and keeps the tint on the same element the design put it on.
                    "rounded-full border-2 border-dashed border-ink-faint bg-[color-mix(in_srgb,var(--paper)_70%,transparent)] p-2"
                  : // Same corners as `ChampionAvatar` (`rounded-lg`): a circle around a
                    // square portrait read as a second, misaligned shape.
                    `rounded-lg ${ring}`
              }`}
            >
              {pinName === null ? (
                <span aria-hidden="true" className="block h-4 w-4 text-center text-base font-semibold leading-4 text-ink">
                  +
                </span>
              ) : (
                <>
                  {/* The button is already `position: absolute` -- any positioned
                      element (not just `relative` ones) establishes the containing
                      block its own absolutely-positioned children measure against,
                      so this ring needs nothing extra from the button to centre
                      itself. It mirrors the button's own left/top + -translate-1/2
                      centring trick against the button's box instead of the map's. */}
                  {/* The keyframes set transform and opacity only while they run,
                      and the animation has no fill mode. These resting classes are
                      what the span falls back to afterwards: centred and invisible.
                      Without them it reappeared at full opacity, offset by half its
                      size -- the stray "targets" next to every placed pick. */}
                  <span
                    aria-hidden="true"
                    className={`pin-ping absolute left-1/2 top-1/2 h-full w-full -translate-x-1/2 -translate-y-1/2 rounded-lg opacity-0 ring-2 ${ringColorClass}`}
                  />
                  <ChampionAvatar name={pinName} imageUrl={pinImage} size={isYourLane ? 40 : 32} />
                </>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
