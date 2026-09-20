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
      ? `Votre lane, ${role}`
      : `Votre lane, ${role} : ${recommendedName} recommandé`;
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

          const ring = isYourLane
            ? "ring-2 ring-accent"
            : side === "ally"
              ? "ring-2 ring-team-ally"
              : "ring-2 ring-team-enemy";

          return (
            <button
              key={`${side}-${role}`}
              type="button"
              onClick={() => onSlotClick(side, role)}
              aria-label={anchorLabel(side, role, champion?.name ?? championId, isYourLane, recommended?.championName ?? null)}
              style={{ left: `${position.x}%`, top: `${position.y}%` }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${
                pinName === null ? "border-2 border-dashed border-ink-faint p-2" : ring
              }`}
            >
              {pinName === null ? (
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: "color-mix(in srgb, var(--paper) 70%, transparent)" }}
                  className="block h-4 w-4 rounded-full text-center text-xs leading-4 text-ink-faint"
                >
                  +
                </span>
              ) : (
                <ChampionAvatar name={pinName} imageUrl={pinImage} size={isYourLane ? 40 : 32} />
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
