"use client";

import { useActionState, useState } from "react";
import { reportComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";
import type { ReportReason } from "@/lib/matchup/reviews";

const INITIAL: FormState = { error: null };

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Indésirable (spam)" },
  { value: "insultant", label: "Insultant ou haineux" },
  { value: "hors_sujet", label: "Hors sujet" },
  { value: "autre", label: "Autre" }
];

export function ReportButton({
  role,
  championLowId,
  championHighId,
  commentId
}: {
  role: string;
  championLowId: string;
  championHighId: string;
  commentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportComment, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-faint transition-colors duration-200 hover:text-danger"
      >
        Signaler
      </button>
    );
  }

  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-rule bg-surface-sunk p-2 text-xs">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLowId} />
      <input type="hidden" name="championHighId" value={championHighId} />
      <input type="hidden" name="commentId" value={commentId} />
      <fieldset className="space-y-1">
        <legend className="sr-only">Motif du signalement</legend>
        {REASONS.map((reason) => (
          <label key={reason.value} className="flex items-center gap-2 text-ink-muted">
            <input type="radio" name="reason" value={reason.value} defaultChecked={reason.value === "spam"} />
            {reason.label}
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="text-accent hover:text-accent-pale">
        Envoyer le signalement
      </button>
    </form>
  );
}
