export function SiteHeader({ context }: { context: string }) {
  return (
    <header className="flex items-center justify-between border-b border-rule px-6 py-3.5 text-sm text-ink-muted">
      <span className="text-base font-bold tracking-tight text-ink">DraftForMe</span>
      <span className="flex items-center gap-4">
        <a href="#comment-ca-marche" className="hover:text-ink">
          Comment ça marche
        </a>
        <span className="text-[11.5px] text-ink-faint">{context}</span>
      </span>
    </header>
  );
}
