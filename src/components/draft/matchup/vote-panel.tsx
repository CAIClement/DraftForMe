"use client";

import { useActionState } from "react";
import type { Role } from "@/lib/draft/roles";
import type { VoteChoice, VoteSummary } from "@/lib/matchup/reviews";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";

const INITIAL: FormState = { error: null };
const PERCENT_THRESHOLD = 5;

type Champion = { id: string; name: string };

export function VotePanel({
  championLow,
  championHigh,
  role,
  summary,
  action
}: {
  championLow: Champion;
  championHigh: Champion;
  role: Role;
  summary: VoteSummary;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  // Below the threshold, no percentage line at all. At or above it, a single
  // choice must beat the other two to be named -- an exact tie for the top
  // spot (two or three choices sharing the max count) is reported as "Avis
  // partagés" instead of arbitrarily picking one.
  const percentLine: string | null =
    summary.total < PERCENT_THRESHOLD
      ? null
      : (() => {
          const entries = [
            { choice: "low" as const, count: summary.low },
            { choice: "high" as const, count: summary.high },
            { choice: "even" as const, count: summary.even }
          ];
          const max = Math.max(...entries.map((entry) => entry.count));
          const top = entries.filter((entry) => entry.count === max);
          if (top.length > 1) return `Avis partagés (${summary.total} votes)`;

          const pct = Math.round((max / summary.total) * 100);
          const verdict =
            top[0].choice === "low"
              ? `${championLow.name} gagne`
              : top[0].choice === "high"
                ? `${championHigh.name} gagne`
                : "c'est une égalité";
          return `${pct} % pensent que ${verdict} (${summary.total} votes)`;
        })();

  function choiceButton(choice: VoteChoice, label: string, count: number) {
    return (
      <button
        key={choice}
        type="submit"
        name="choice"
        value={choice}
        disabled={pending}
        aria-pressed={summary.myChoice === choice}
        className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors duration-200 ${
          summary.myChoice === choice ? "border-accent bg-accent-wash text-ink" : "border-rule text-ink-muted hover:border-accent"
        }`}
      >
        <span>{label}</span>
        <span className="tabular-nums text-xs text-ink-faint">{count}</span>
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLow.id} />
      <input type="hidden" name="championHighId" value={championHigh.id} />

      <div className="flex gap-2">
        {choiceButton("low", `${championLow.name} gagne`, summary.low)}
        {choiceButton("even", "Égalité", summary.even)}
        {choiceButton("high", `${championHigh.name} gagne`, summary.high)}
      </div>

      {percentLine && <p className="text-xs text-ink-faint">{percentLine}</p>}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
