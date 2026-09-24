import { Plus } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Eyebrow, SectionTitle } from "./eyebrow";

const QUESTIONS = [
  {
    q: "Faut-il créer un compte ?",
    a: "Non. L'outil fonctionne sans inscription : choisissez un rôle, ajoutez les picks adverses, et la recommandation s'affiche."
  },
  {
    q: "D'où viennent les données ?",
    a: "De statistiques de parties classées sur EUW, en Emerald et au-dessus. Le patch et la date de mise à jour sont indiqués sur le site."
  },
  {
    q: "Pourquoi trois champions plutôt qu'un seul ?",
    a: "Le meilleur pick sur le papier n'est pas toujours le vôtre. Le pick principal est détaillé ; les deux alternatives vous laissent arbitrer selon votre niveau de risque."
  },
  {
    q: "Mon pool de champions est-il pris en compte ?",
    a: "Pas encore. La pondération par vos propres champions est prévue ; d'ici là, ce critère est signalé comme indisponible plutôt que simulé."
  }
];

// Native <details>: keyboard and screen-reader support come for free, and the
// answers stay in the HTML for indexing.
export function FaqSection() {
  return (
    <section aria-labelledby="faq-title" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-start gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <SectionTitle id="faq-title" lead="Questions fréquentes" />
        </Reveal>

        <Reveal delay={120} className="border-t border-rule">
          {QUESTIONS.map((item, index) => (
            <details key={item.q} open={index === 0} className="group border-b border-rule">
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-5 text-base font-semibold [&::-webkit-details-marker]:hidden">
                {item.q}
                <Plus
                  aria-hidden
                  className="size-4 flex-none text-ink-faint transition-transform duration-200 group-open:rotate-45"
                />
              </summary>
              <p className="max-w-[62ch] pb-5 text-[15px] leading-relaxed text-ink-muted">{item.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}
