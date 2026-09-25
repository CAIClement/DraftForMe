import type { CSSProperties, ReactNode } from "react";
import { ArrowRight, Check } from "lucide-react";
import { Alternatives } from "@/components/draft/alternatives";
import { Verdict } from "@/components/draft/verdict";
import { HextechBackdrop } from "@/components/motion/hextech-backdrop";
import { ButtonLink } from "@/components/ui/button-link";
import type { Recommendation } from "@/lib/recommendation/types";
import { Eyebrow } from "./eyebrow";

const TITLE = "Sachez quoi pick, avant la fin du timer.";

function delay(ms: number): CSSProperties {
  return { "--reveal-delay": `${ms}ms` } as CSSProperties;
}

/** One title word, rising in on its own beat. */
function Word({ index, children }: { index: number; children: ReactNode }) {
  return (
    <span className="word-rise" style={delay(60 + index * 70)}>
      {children}
    </span>
  );
}

/**
 * The right-hand panel is the engine's real answer for the default example,
 * rendered with the tool's own components -- not a mockup. With no data it
 * says so instead of inventing a result.
 *
 * Everything here animates on load with CSS alone: it is above the fold, so a
 * JavaScript reveal would flash the content away on hydration.
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
    <section className="relative overflow-hidden border-b border-rule bg-[linear-gradient(180deg,var(--paper)_0%,var(--paper-deep)_100%)]">
      <HextechBackdrop />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:py-24">
        <div>
          <div className="rise">
            <Eyebrow>Coach de draft · League of Legends</Eyebrow>
          </div>
          {/* The words are split for the animation; the label keeps the sentence whole for screen readers. */}
          <h1
            aria-label={TITLE}
            className="mt-4 text-[clamp(2.5rem,5.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.04em]"
          >
            <span aria-hidden="true">
              <Word index={0}>Sachez</Word> <Word index={1}>quoi</Word>{" "}
              <Word index={2}>
                <span className="text-accent">pick</span>,
              </Word>
              <br />
              <Word index={3}>avant</Word> <Word index={4}>la</Word> <Word index={5}>fin</Word>{" "}
              <Word index={6}>du</Word> <Word index={7}>timer.</Word>
            </span>
          </h1>
          <p className="rise mt-5 max-w-[48ch] text-[17px] leading-relaxed text-ink-muted" style={delay(620)}>
            Indiquez votre rôle et les champions déjà verrouillés en face. DraftForMe vous propose trois picks, classés
            sur des données de parties réelles, avec le détail de chaque critère.
          </p>
          <div className="rise mt-8 flex flex-col gap-3 sm:flex-row" style={delay(700)}>
            <ButtonLink href="/draft">
              Lancer une draft
              <ArrowRight aria-hidden className="size-4" />
            </ButtonLink>
            <ButtonLink href="/#comment-ca-marche" variant="secondary">
              Comment ça marche
            </ButtonLink>
          </div>
          <ul className="rise mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-ink-muted" style={delay(780)}>
            {facts.map((fact) => (
              <li key={fact} className="flex items-center gap-1.5">
                <Check aria-hidden className="size-3.5 text-accent" strokeWidth={2.5} />
                {fact}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="card-pop sheen rounded-2xl border border-rule bg-surface p-3 shadow-[0_1px_2px_var(--shadow),0_12px_32px_-12px_var(--shadow)] sm:p-4"
          style={delay(450)}
        >
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
