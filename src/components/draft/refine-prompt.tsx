"use client";

import { useState } from "react";

export function RefinePrompt() {
  const [riotId, setRiotId] = useState("");

  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-rule bg-surface-sunk px-3.5 py-2.5 text-xs text-ink-muted">
      <label htmlFor="riot-id">
        Affinez avec <b className="text-ink">votre</b> pool : on pondère selon les champions que vous jouez vraiment.
      </label>
      <input
        id="riot-id"
        type="text"
        value={riotId}
        onChange={(event) => setRiotId(event.target.value)}
        placeholder="Nom#TAG"
        autoComplete="username"
        className="ml-auto w-36 rounded-md border border-rule bg-surface px-2.5 py-1.5"
      />
    </div>
  );
}
