import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-ink-faint sm:px-6">
        <span>
          <span className="font-semibold text-ink">DraftForMe</span> · Projet indépendant, non affilié à Riot Games.
        </span>
        <nav aria-label="Pied de page" className="flex gap-5">
          <Link href="/" className="transition-colors duration-200 hover:text-ink">
            Accueil
          </Link>
          <Link href="/draft" className="transition-colors duration-200 hover:text-ink">
            Outil de draft
          </Link>
        </nav>
      </div>
    </footer>
  );
}
