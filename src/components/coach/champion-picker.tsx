"use client";

type Champion = {
  id: string;
  name: string;
};

export function ChampionPicker({
  champions,
  selectedIds,
  onToggle
}: {
  champions: Champion[];
  selectedIds: string[];
  onToggle: (championId: string) => void;
}) {
  return (
    <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 md:grid-cols-3">
      {champions.map((champion) => {
        const selected = selectedIds.includes(champion.id);
        return (
          <button
            key={champion.id}
            type="button"
            onClick={() => onToggle(champion.id)}
            className={`rounded-md border px-3 py-2 text-left text-sm transition ${
              selected
                ? "border-teal bg-teal/15 text-white"
                : "border-line bg-panel text-slate-300 hover:border-slate-500"
            }`}
          >
            {champion.name}
          </button>
        );
      })}
    </div>
  );
}
