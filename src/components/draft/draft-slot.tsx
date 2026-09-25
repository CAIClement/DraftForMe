"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

const PORTRAIT = 48;
const ROLE_TAG = "text-[9px] font-extrabold uppercase tracking-[0.14em]";

/**
 * Portrait only: the owner wanted the icons larger and the names gone. The
 * name stays in the accessible name and in a `title` tooltip, and the column
 * header already says which side the slot is on, so the visible tag is the
 * role alone.
 */
export function DraftSlot({
  side,
  role,
  champion,
  isYourLane,
  onOpen,
  onClear
}: {
  side: Side;
  role: Role;
  champion: { id: string; name: string; imageUrl?: string } | null;
  isYourLane: boolean;
  onOpen: (side: Side, role: Role) => void;
  onClear: (side: Side, role: Role) => void;
}) {
  const lane = `${ROLE_LABELS[role]} ${side === "ally" ? "allié" : "adverse"}`;
  const edge = side === "ally" ? "border-l-2 border-l-team-ally" : "border-r-2 border-r-team-enemy";

  if (isYourLane) {
    return (
      <div
        title={champion?.name}
        className="flex items-center gap-2.5 rounded-lg border border-accent bg-accent-wash p-1.5"
      >
        <ChampionAvatar name={champion?.name ?? ROLE_LABELS[role]} imageUrl={champion?.imageUrl} size={PORTRAIT} />
        <span className={`${ROLE_TAG} text-accent`}>{ROLE_LABELS[role]} · vous</span>
      </div>
    );
  }

  if (champion === null) {
    return (
      <button
        type="button"
        onClick={() => onOpen(side, role)}
        aria-label={`${lane}, vide`}
        title={`${lane} : choisir un champion`}
        className={`flex w-full items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left transition-colors duration-200 hover:bg-surface ${edge}`}
      >
        <span
          aria-hidden="true"
          className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-surface text-lg font-semibold text-ink-faint"
        >
          +
        </span>
        <span className={`${ROLE_TAG} text-ink-faint`}>{ROLE_LABELS[role]}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClear(side, role)}
      aria-label={`Retirer ${champion.name}`}
      title={`Retirer ${champion.name}`}
      className={`group flex w-full items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left transition-colors duration-200 hover:bg-surface-sunk ${edge}`}
    >
      <span className="relative shrink-0">
        <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={PORTRAIT} />
        {/* Clicking an occupied slot removes the pick, which nothing on screen
            said before. The cross only appears on hover or keyboard focus. */}
        <span
          aria-hidden="true"
          className="absolute inset-0 grid place-items-center rounded-lg bg-scrim text-lg font-bold text-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          ×
        </span>
      </span>
      <span className={`${ROLE_TAG} text-ink-faint`}>{ROLE_LABELS[role]}</span>
    </button>
  );
}
