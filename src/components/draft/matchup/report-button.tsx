"use client";

import { useActionState, useEffect, useRef, useState } from "react";
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

type ReportFields = { role: string; championLowId: string; championHighId: string; commentId: string };

// Owns the action's state, so a fresh `key` from the parent (below) remounts
// it -- and therefore resets state back to INITIAL -- every time the form
// reopens. Without that, cancelling after a failed report and reopening
// would show the previous, now-stale error again.
function ReportForm({
  role,
  championLowId,
  championHighId,
  commentId,
  onCancel,
  onSent
}: ReportFields & { onCancel: () => void; onSent: () => void }) {
  const [state, formAction, pending] = useActionState(reportComment, INITIAL);

  useEffect(() => {
    if (state !== INITIAL && !state.error) {
      onSent();
    }
  }, [state, onSent]);

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
        <button type="button" onClick={onCancel} className="text-ink-faint">
          Annuler
        </button>
      </div>
    </form>
  );
}

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
  // Bumped every time the form opens, so <ReportForm key={openCount}> is a
  // fresh instance each time -- see ReportForm's comment.
  const [openCount, setOpenCount] = useState(0);
  const signalerRef = useRef<HTMLButtonElement>(null);
  // The "Signaler" button doesn't exist in the DOM while the form is open, so
  // focusing it has to happen after the close re-render, not inside the
  // click handler that triggers it. Guarded by "was it open before" so this
  // never steals focus on the very first render (open starts false too).
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (wasOpenRef.current && !open) {
      signalerRef.current?.focus();
    }
    wasOpenRef.current = open;
  }, [open]);

  function openForm() {
    setOpenCount((count) => count + 1);
    setOpen(true);
  }

  function closeForm() {
    setOpen(false);
  }

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
        ref={signalerRef}
        type="button"
        onClick={openForm}
        className="text-xs text-ink-faint transition-colors duration-200 hover:text-danger"
      >
        Signaler
      </button>
    );
  }

  return (
    <ReportForm
      key={openCount}
      role={role}
      championLowId={championLowId}
      championHighId={championHighId}
      commentId={commentId}
      onCancel={closeForm}
      onSent={() => setSent(true)}
    />
  );
}
