"use client";

import { useActionState, useEffect, useState } from "react";
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
  const [sent, setSent] = useState(false);
  const [state, formAction, pending] = useActionState(reportComment, INITIAL);

  // Same INITIAL-identity trick as comment-list.tsx's EditForm: only a
  // resolved submission (not the initial render) can flip this to true.
  useEffect(() => {
    if (state !== INITIAL && !state.error) {
      setSent(true);
    }
  }, [state]);

  if (sent) {
    return (
      <p role="status" className="text-xs text-ink-faint">
        Signalement envoyé.
      </p>
    );
  }

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
        {REASONS.map((reason, index) => (
          <label key={reason.value} className="flex items-center gap-2 text-ink-muted">
            <input
              type="radio"
              name="reason"
              value={reason.value}
              defaultChecked={reason.value === "spam"}
              autoFocus={index === 0}
            />
            {reason.label}
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="text-accent hover:text-accent-pale">
          Envoyer le signalement
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-ink-faint">
          Annuler
        </button>
      </div>
    </form>
  );
}
