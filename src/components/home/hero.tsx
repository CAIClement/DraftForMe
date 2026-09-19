import { ArrowRight, Check } from "lucide-react";
import { Alternatives } from "@/components/draft/alternatives";
import { Verdict } from "@/components/draft/verdict";
import { ButtonLink } from "@/components/ui/button-link";
import type { Recommendation } from "@/lib/recommendation/types";
import { Eyebrow } from "./eyebrow";

/**
 * The right-hand panel is the engine's real answer for the default example,
 * rendered with the tool's own components -- not a mockup. With no data it
 * says so instead of inventing a result.
 */
export function Hero({
  recommendations,
  caption,
  patch
}: {
  recommendations: Recommendation[];
  caption: string | null;
  patch: string | null;
}) {
  const [top, ...rest] = recommendations;

  const facts = ["Sans inscription", "Données EUW · Emerald+", patch === null ? null : `Patch ${patch}`].filter(
    (fact): fact is string => fact !== null
  );

  return (
    <section className="border-b border-rule bg-[linear-gradient(180deg,var(--paper)_0%,var(--paper-deep)_100%)]">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-24">
        <div>
          <Eyebrow>Coach de draft · League of Legends</Eyebrow>
          <h1 className="mt-4 text-[clamp(2.5rem,5.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em]">
            Sachez quoi <span className="text-accent">pick</span>,<br />
            avant la fin du timer.
          </h1>
          <p className="mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-muted">
            Indiquez votre rôle et les champions déjà verrouillés en face. DraftForMe vous propose trois picks, classés
            sur des données de parties réelles, avec le détail de chaque critère.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <ButtonLink href="/draft">
              Lancer une draft
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="/#comment-ca-marche" variant="secondary">
              Comment ça marche
            </ButtonLink>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-muted">
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-rule bg-surface p-3 shadow-[0_1px_2px_rgb(28_25_23/0.04),0_12px_32px_-12px_rgb(28_25_23/0.12)] sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3 px-1">
            <span className="text-xs font-medium text-ink-muted">{caption ? `Exemple réel · ${caption}` : "Exemple"}</span>
            <span className="rounded-full border border-rule px-2 py-0.5 text-[11px] text-ink-faint">Lecture seule</span>
          </div>
          {top ? (
            <>
              <Verdict recommendation={top} />
              <Alternatives recommendations={rest} />
            </>
          ) : (
            <p className="rounded-xl border border-rule-soft bg-surface-sunk p-8 text-center text-sm text-ink-muted">
              L'exemple en direct n'est pas disponible pour le moment. L'outil reste accessible.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
