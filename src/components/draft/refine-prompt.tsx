// Deliberately not a live input. Weighting by a player's pool needs an account,
// and `src/app/auth/login/route.ts` is currently a stub that redirects to `/`,
// so a working field would have nowhere to send a Riot ID. A control that
// accepts text and silently drops it is the one thing that would undercut a
// page whose whole premise is that everything on it is real. It states what is
// coming instead, and holds no state.
export function RefinePrompt() {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-rule bg-surface-sunk px-3.5 py-2.5 text-xs text-ink-muted">
      <span>
        Affinez avec <b className="text-ink">votre</b> pool : on pondère selon les champions que vous jouez vraiment.
      </span>
      <span className="ml-auto shrink-0 rounded-md border border-rule px-2.5 py-1.5 text-ink-faint">
        Bientôt
      </span>
    </div>
  );
}
