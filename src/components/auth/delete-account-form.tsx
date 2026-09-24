"use client";

import { useActionState } from "react";
import { deleteAccount, type FormState } from "@/app/compte/actions";
import { DELETE_CONFIRMATION } from "@/lib/auth/delete-confirmation";

const INITIAL: FormState = { error: null };

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <p className="text-sm text-ink-muted">
        La suppression est définitive : votre compte et votre pseudo sont effacés immédiatement.
      </p>
      <label htmlFor="confirmation" className="block text-sm text-ink">
        Tapez {DELETE_CONFIRMATION} pour confirmer
      </label>
      <input
        id="confirmation"
        name="confirmation"
        autoComplete="off"
        className="w-full max-w-sm rounded-md border border-rule bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
      />
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger transition-opacity duration-200 disabled:opacity-60"
      >
        Supprimer mon compte
      </button>
    </form>
  );
}
