"use client";

import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

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
      <div className="flex items-center gap-2.5 rounded-lg border border-accent bg-accent-wash p-1.5">
        <ChampionAvatar name={champion?.name ?? ROLE_LABELS[role]} imageUrl={champion?.imageUrl} size={34} />
        <span className="min-w-0">
          <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-accent">
            {ROLE_LABELS[role]} · vous
          </span>
          <span className="block truncate text-[13px] font-bold text-ink">{champion?.name ?? "Recommandation"}</span>
        </span>
      </div>
    );
  }

  if (champion === null) {
    return (
      <button
        type="button"
        onClick={() => onOpen(side, role)}
        aria-label={`${lane}, vide`}
        className={`flex items-center gap-2.5 rounded-lg border border-dashed border-rule bg-surface-sunk p-1.5 text-left ${edge}`}
      >
        <span
          aria-hidden="true"
          className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-lg bg-surface text-[8.5px] font-extrabold uppercase text-ink-faint"
        >
          {ROLE_LABELS[role]}
        </span>
        <span className="min-w-0">
          <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">{lane}</span>
          <span className="block truncate text-[13px] font-semibold text-ink-faint">À placer</span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onClear(side, role)}
      aria-label={`Retirer ${champion.name}`}
      className={`flex items-center gap-2.5 rounded-lg border border-rule bg-surface p-1.5 text-left ${edge}`}
    >
      <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={34} />
      <span className="min-w-0">
        <span className="block text-[8.5px] font-extrabold uppercase tracking-[0.16em] text-ink-faint">{lane}</span>
        <span className="block truncate text-[13px] font-bold text-ink">{champion.name}</span>
      </span>
    </button>
  );
}
