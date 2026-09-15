"use client";

import { useState } from "react";
import { Chip } from "@/components/ui/chip";

export type Champion = { id: string; name: string; imageUrl?: string };

export function EnemyPicks({
  champions,
  selectedIds,
  onAdd,
  onRemove
}: {
  champions: Champion[];
  selectedIds: string[];
  onAdd: (championId: string) => void;
  onRemove: (championId: string) => void;
}) {
  const [query, setQuery] = useState("");

  const selected = selectedIds
    .map((id) => champions.find((champion) => champion.id === id))
    .filter((champion): champion is Champion => champion !== undefined);

  // Matched against the id as well as the display name: ids are the
  // punctuation-stripped slugs, so a search for "kaisa" finds Kai'Sa, which
  // matching on the name alone never would.
  const needle = query.trim().toLowerCase();
  const matches =
    needle === ""
      ? []
      : champions
          .filter(
            (champion) =>
              !selectedIds.includes(champion.id) &&
              (champion.name.toLowerCase().includes(needle) || champion.id.includes(needle))
          )
          .slice(0, 6);

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selected.map((champion) => (
          <Chip
            key={champion.id}
            name={champion.name}
            imageUrl={champion.imageUrl}
            onRemove={() => onRemove(champion.id)}
          />
        ))}
      </div>

      <label htmlFor="enemy-search" className="sr-only">
        Rechercher un pick ennemi
      </label>
      <input
        id="enemy-search"
        type="search"
        role="combobox"
        aria-expanded={matches.length > 0}
        aria-controls="enemy-search-results"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Ajouter un champion adverse"
        className="w-full rounded-lg border border-rule bg-surface px-3 py-2 text-sm"
      />

      {matches.length > 0 && (
        <ul id="enemy-search-results" aria-live="polite" className="mt-1.5 flex flex-wrap gap-1.5">
          {matches.map((champion) => (
            <li key={champion.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(champion.id);
                  setQuery("");
                }}
                className="rounded-full border border-dashed border-rule px-3 py-1 text-sm text-ink-muted hover:border-accent hover:text-accent"
              >
                {champion.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
