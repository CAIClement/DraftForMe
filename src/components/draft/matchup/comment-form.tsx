"use client";

import { useActionState, useEffect, useState } from "react";
import { postComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";

const INITIAL: FormState = { error: null };

export function CommentForm({
  role,
  championLowId,
  championHighId
}: {
  role: string;
  championLowId: string;
  championHighId: string;
}) {
  const [state, formAction, pending] = useActionState(postComment, INITIAL);
  // React 19 clears an uncontrolled form's fields after any action runs, so a
  // failed post (rate limit, validation) would otherwise wipe what the user
  // typed. Controlled state keeps the text on error and is cleared only once
  // -- see EditForm/ReportForm in the sibling components for the same
  // "state !== INITIAL by reference" check that tells a real submission apart
  // from the initial mount.
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state !== INITIAL && !state.error) {
      setBody("");
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLowId} />
      <input type="hidden" name="championHighId" value={championHighId} />
      <label htmlFor="comment-body" className="sr-only">
        Votre avis sur ce matchup
      </label>
      <textarea
        id="comment-body"
        name="body"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        minLength={3}
        maxLength={500}
        required
        rows={3}
        placeholder="Votre avis sur ce matchup…"
        className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <p className="text-xs text-ink-faint">3 à 500 caractères. Texte brut : pas de mise en forme ni de liens cliquables.</p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity duration-200 disabled:opacity-60"
      >
        Publier
      </button>
    </form>
  );
}
