import Link from "next/link";
import { RiotDisclaimer } from "@/components/legal/riot-disclaimer";

const LINKS = [
  { href: "/", label: "Accueil" },
  { href: "/draft", label: "Outil de draft" },
  { href: "/mentions-legales", label: "Mentions légales" },
  { href: "/confidentialite", label: "Confidentialité" },
  { href: "/conditions-utilisation", label: "Conditions d'utilisation" }
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-[13px] text-ink-faint sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-semibold text-ink">DraftForMe</span>
          <nav aria-label="Pied de page" className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors duration-200 hover:text-ink">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <RiotDisclaimer className="max-w-3xl text-xs leading-5" />
      </div>
    </footer>
  );
}
