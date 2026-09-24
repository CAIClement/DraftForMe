"use client";

import { useActionState } from "react";
import { saveNickname, type FormState } from "@/app/compte/actions";

const INITIAL: FormState = { error: null };

export function NicknameForm({ defaultValue, next }: { defaultValue?: string; next: string }) {
  const [state, action, pending] = useActionState(saveNickname, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <label htmlFor="nickname" className="block text-sm font-medium text-ink">
        Pseudo
      </label>
      <input
        id="nickname"
        name="nickname"
        defaultValue={defaultValue}
        required
        minLength={3}
        maxLength={20}
        autoComplete="nickname"
        aria-describedby="nickname-help"
        className="w-full max-w-sm rounded-md border border-rule bg-surface px-3 py-2 text-ink focus:border-accent focus:outline-none"
      />
      <p id="nickname-help" className="text-xs text-ink-faint">
        3 à 20 caractères : lettres sans accent, chiffres, « _ » et « - ». Il sera visible publiquement.
      </p>
      <input type="hidden" name="next" value={next} />
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
        Enregistrer
      </button>
    </form>
  );
}
