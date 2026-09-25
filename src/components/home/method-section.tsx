import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Eyebrow, SectionTitle } from "./eyebrow";

const STEPS = [
  {
    title: "Choisissez votre rôle",
    body: "Top, jungle, mid, ADC ou support. Le classement ne compare que des champions joués à ce poste."
  },
  {
    title: "Ajoutez les picks adverses",
    body: "Chaque champion verrouillé en face réordonne les résultats selon les counters connus."
  },
  {
    title: "Lisez le verdict",
    body: "Un pick principal, deux alternatives, et le détail du calcul pour chacun."
  }
];

export function MethodSection() {
  return (
    <section
      id="comment-ca-marche"
      aria-labelledby="method-title"
      className="scroll-mt-20 border-y border-rule bg-paper-deep px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal>
            <Eyebrow>Comment ça marche</Eyebrow>
            <SectionTitle id="method-title" lead="Deux informations suffisent." />
          </Reveal>
          <Link
            href="/draft"
            className="mb-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-accent underline decoration-transparent underline-offset-4 transition-colors duration-200 hover:decoration-current"
          >
            Ouvrir l'outil
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>

        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 120} className="rounded-2xl border border-rule bg-surface p-6">
              <span className="text-sm font-semibold tabular-nums text-accent">Étape {index + 1}</span>
              <h3 className="mb-2 mt-3 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="text-sm leading-relaxed text-ink-muted">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
