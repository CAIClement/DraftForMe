"use client";

/**
 * Sets the same `priority` the API already accepts. It lives next to the factor
 * bars rather than above the tool: asking someone to weight meta against their
 * own pool before they have seen either score is a question they cannot answer.
 */
export function PriorityControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <div className="mt-3 flex items-center gap-3 text-[11px] text-ink-muted">
      <label htmlFor="priority" className="font-semibold">
        Priorité : votre pool ↔ la méta
      </label>
      <input
        id="priority"
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="w-8 text-right tabular-nums font-bold text-ink">{value}</span>
    </div>
  );
}
