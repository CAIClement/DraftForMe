import type { ReactNode } from "react";
import { formatLegalDate } from "@/lib/legal/site-info";

export function LegalPage({
  title,
  lastUpdated,
  children
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">{title}</h1>
      <p className="mt-3 text-sm text-ink-faint">Dernière mise à jour : {formatLegalDate(lastUpdated)}</p>
      <div className="mt-10 space-y-10">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 text-[15px] leading-7 text-ink-muted">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

export const LEGAL_LINK_CLASS =
  "text-accent underline underline-offset-2 transition-colors duration-200 hover:text-accent-pale";

export function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LEGAL_LINK_CLASS}>
      {children}
      <span className="sr-only"> (nouvel onglet)</span>
    </a>
  );
}
