import { ArrowRight } from "lucide-react";
import { ButtonLink } from "@/components/ui/button-link";

export function CtaSection() {
  return (
    <section aria-labelledby="cta-title" className="px-4 pb-20 sm:px-6 sm:pb-28">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 rounded-2xl border border-rule bg-surface p-8 shadow-[0_12px_32px_-16px_rgb(28_25_23/0.12)] sm:p-12 lg:flex-row lg:items-center">
        <div>
          <h2 id="cta-title" className="text-[clamp(1.625rem,3vw,2.25rem)] font-semibold leading-tight tracking-[-0.03em]">
            Préparez votre prochaine draft.
          </h2>
          <p className="mt-2 max-w-[52ch] text-base text-ink-muted">
            Aucune inscription, aucune configuration. Choisissez un rôle, le résultat s'affiche.
          </p>
        </div>
        <ButtonLink href="/draft">
          Lancer une draft
          <ArrowRight aria-hidden className="size-4" />
        </ButtonLink>
      </div>
    </section>
  );
}
