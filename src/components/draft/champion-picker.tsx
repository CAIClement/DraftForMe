"use client";

import { useState } from "react";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Side } from "@/lib/draft/draft-state";
import { ROLE_LABELS, type Role } from "@/lib/draft/roles";

export type PickerChampion = { id: string; name: string; imageUrl?: string };

const MAX_RESULTS = 12;

export function ChampionPicker({
  champions,
  excludedIds,
  target,
  onPick,
  onClose
}: {
  champions: PickerChampion[];
  excludedIds: string[];
  target: { side: Side; role: Role };
  onPick: (championId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");

  // Matched against the id as well as the display name: ids are the
  // punctuation-stripped slugs, so a search for "kaisa" finds Kai'Sa, which
  // matching on the name alone never would.
  const needle = query.trim().toLowerCase();
  const matches = champions
    .filter(
      (champion) =>
        !excludedIds.includes(champion.id) &&
        (needle === "" ||
          champion.name.toLowerCase().includes(needle) ||
          champion.id.includes(needle))
    )
    .slice(0, MAX_RESULTS);

  const lane = `${ROLE_LABELS[target.role]} ${target.side === "ally" ? "allié" : "adverse"}`;

  return (
    <div className="absolute inset-0 z-10 flex flex-col justify-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--paper)_90%,transparent)] p-3 backdrop-blur-sm">
      <div className="flex items-baseline justify-between">
        <label htmlFor="champion-picker" className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-accent">
          {lane}
        </label>
        <button type="button" onClick={onClose} className="text-[11px] text-ink-faint underline">
          Fermer
        </button>
      </div>

      <input
        id="champion-picker"
        type="search"
        role="combobox"
        autoFocus
        aria-expanded={matches.length > 0}
        aria-controls="champion-picker-results"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
          if (event.key === "Enter" && matches[0] !== undefined) onPick(matches[0].id);
        }}
        placeholder="Rechercher un champion"
        className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm text-ink"
      />

      <ul id="champion-picker-results" className="grid grid-cols-6 gap-1.5">
        {matches.map((champion) => (
          <li key={champion.id}>
            <button
              type="button"
              onClick={() => onPick(champion.id)}
              aria-label={champion.name}
              className="block w-full rounded-lg border border-rule p-0.5 hover:border-accent"
            >
              <ChampionAvatar name={champion.name} imageUrl={champion.imageUrl} size={34} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
