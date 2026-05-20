"use client";

import { useId, useMemo, useState } from "react";

type Champion = {
  id: string;
  name: string;
  imageUrl?: string;
};

function ChampionPortrait({ champion }: { champion: Champion }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-line bg-ink text-xs font-semibold text-slate-400">
      {champion.imageUrl ? (
        <img
          src={champion.imageUrl}
          alt={`Portrait de ${champion.name}`}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        champion.name.slice(0, 2).toUpperCase()
      )}
    </span>
  );
}

export function ChampionPicker({
  champions,
  selectedIds,
  onToggle,
  searchLabel = "Rechercher un champion"
}: {
  champions: Champion[];
  selectedIds: string[];
  onToggle: (championId: string) => void;
  searchLabel?: string;
}) {
  const [query, setQuery] = useState("");
  const searchId = useId();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredChampions = useMemo(
    () =>
      normalizedQuery.length === 0
        ? champions
        : champions.filter(
            (champion) =>
              champion.name.toLowerCase().includes(normalizedQuery) ||
              champion.id.toLowerCase().includes(normalizedQuery)
          ),
    [champions, normalizedQuery]
  );

  return (
    <div className="space-y-3">
      <label className="sr-only" htmlFor={searchId}>
        {searchLabel}
      </label>
      <input
        id={searchId}
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un champion"
        className="w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal"
      />

      {filteredChampions.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-panel px-3 py-5 text-center text-sm text-slate-400">
          Aucun champion trouve.
        </div>
      ) : (
        <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
          {filteredChampions.map((champion) => {
            const selected = selectedIds.includes(champion.id);
            return (
              <button
                key={champion.id}
                type="button"
                onClick={() => onToggle(champion.id)}
                className={`flex min-h-14 items-center gap-3 rounded-md border px-2.5 py-2 text-left text-sm transition ${
                  selected
                    ? "border-teal bg-teal/15 text-white"
                    : "border-line bg-panel text-slate-300 hover:border-slate-500"
                }`}
                aria-pressed={selected}
              >
                <ChampionPortrait champion={champion} />
                <span className="min-w-0 flex-1 truncate font-medium">{champion.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
