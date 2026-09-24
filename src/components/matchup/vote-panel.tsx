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

  const leader: { label: string; count: number } | null =
    summary.total < PERCENT_THRESHOLD
      ? null
      : [
          { choice: "low" as const, label: `${championLow.name} gagne`, count: summary.low },
          { choice: "high" as const, label: `${championHigh.name} gagne`, count: summary.high },
          { choice: "even" as const, label: "Égalité", count: summary.even }
        ].reduce((best, entry) => (entry.count > best.count ? entry : best));

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

      {leader && (
        <p className="text-xs text-ink-faint">
          {Math.round((leader.count / summary.total) * 100)} % pensent que {leader.label.toLowerCase()} ({summary.total} votes)
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
