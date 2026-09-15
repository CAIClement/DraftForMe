"use client";

/**
 * Sets the same `priority` the API already accepts. It lives next to the factor
 * bars rather than above the tool: asking someone to weight meta against their
 * own pool before they have seen either score is a question they cannot answer.
 *
 * Only rendered when the player factor could actually be assessed. See
 * `PriorityUnavailable` for why.
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

// Stands in for the slider whenever the player factor is unavailable, which is
// every visitor until accounts ship. `computeWeights` in the engine overwrites
// meta and player with fixed weights when the pool is empty, so `priority` is
// discarded outright: a live slider would accept the drag, redraw its own
// number, fire a request, and come back with byte-identical recommendations.
// That is the same defect `RefinePrompt` refuses by name, so it gets the same
// answer -- say what the control will do, and do not pretend it does it yet.
export function PriorityUnavailable() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-rule bg-surface-sunk px-3.5 py-2.5 text-xs text-ink-muted">
      <span>
        Arbitrer <b className="text-ink">votre pool</b> contre la méta demande de connaître votre pool : sans lui, le
        classement est entièrement méta.
      </span>
      <span className="ml-auto shrink-0 rounded-md border border-rule px-2.5 py-1.5 text-ink-faint">Bientôt</span>
    </div>
  );
}
