import { Reveal } from "@/components/motion/reveal";
import { TrustBar } from "@/components/marketing/trust-bar";
import { Eyebrow, SectionTitle } from "./eyebrow";

const POINTS = [
  { title: "Parties classées", body: "EUW, Emerald et au-dessus." },
  { title: "Counters connus", body: "Aucun pourcentage de matchup inventé." },
  { title: "Transparence", body: "Une donnée absente n'est jamais affichée à zéro." }
];

export function DataSection({
  appearances,
  rankedChampions,
  patch,
  context,
  updatedAt
}: {
  appearances: number | null;
  rankedChampions: number | null;
  patch: string | null;
  context: string;
  updatedAt: string | null;
}) {
  return (
    <section aria-labelledby="data-title" className="bg-band px-4 py-20 text-band-ink sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Eyebrow tone="inverse">Données</Eyebrow>
          <SectionTitle id="data-title" lead="Des chiffres réels," follow="rien d'estimé." tone="inverse" />
          <p className="max-w-[52ch] text-base leading-relaxed text-band-muted">
            Chaque nombre affiché provient de la base : taux de victoire, volume de parties, relations de counter.
            Lorsqu'une donnée manque, elle est retirée de l'écran plutôt que remplacée par une valeur plausible.
          </p>
          <ul className="mt-8 grid gap-6 sm:grid-cols-3">
            {POINTS.map((point, index) => (
              <Reveal as="li" key={point.title} delay={120 + index * 90} className="border-t border-band-rule pt-4">
                <strong className="block text-sm font-semibold text-band-ink">{point.title}</strong>
                <span className="text-sm text-band-muted">{point.body}</span>
              </Reveal>
            ))}
          </ul>
        </Reveal>

        {/* Only rendered when the index was readable; its tiles are real or absent. */}
        {rankedChampions !== null && (
          <Reveal delay={150} className="rounded-2xl border border-band-rule bg-surface/40 p-6 sm:p-8">
            <TrustBar
              appearances={appearances}
              rankedChampions={rankedChampions}
              patch={patch}
              context={context}
              updatedAt={updatedAt}
            />
          </Reveal>
        )}
      </div>
    </section>
  );
}
