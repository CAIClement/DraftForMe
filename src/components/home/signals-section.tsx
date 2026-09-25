import { Gauge, Swords, UserRound } from "lucide-react";
import { FactorBars } from "@/components/draft/factor-bars";
import { CountUp } from "@/components/motion/count-up";
import { Reveal } from "@/components/motion/reveal";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import type { Recommendation } from "@/lib/recommendation/types";
import { Eyebrow, SectionTitle } from "./eyebrow";

const SIGNALS = [
  {
    icon: Gauge,
    title: "Force dans le patch",
    body: "Winrate, pick rate et ban rate du champion à votre poste."
  },
  {
    icon: Swords,
    title: "Lecture du matchup",
    body: "Les counters connus face aux champions déjà pickés en face."
  },
  {
    icon: UserRound,
    title: "Votre aisance",
    body: "Bientôt : la pondération par votre propre pool de champions."
  }
];

export function SignalsSection({ top }: { top: Recommendation | undefined }) {
  return (
    <section aria-labelledby="signals-title" className="px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <Reveal>
          <Eyebrow>Méthode</Eyebrow>
          <SectionTitle id="signals-title" lead="Trois critères," follow="un verdict argumenté." />
          <p className="max-w-[52ch] text-base leading-relaxed text-ink-muted">
            Chaque recommandation combine les mêmes critères, et le poids de chacun est affiché à côté du résultat. Vous
            savez toujours pourquoi un champion sort en tête.
          </p>
          <ul className="mt-8 divide-y divide-rule border-y border-rule">
            {SIGNALS.map((signal, index) => (
              <Reveal as="li" key={signal.title} delay={120 + index * 90} className="flex gap-4 py-4">
                <span className="grid size-9 flex-none place-items-center rounded-lg border border-rule bg-surface text-accent">
                  <signal.icon aria-hidden className="size-[18px]" strokeWidth={1.75} />
                </span>
                <span>
                  <strong className="block text-[15px] font-semibold">{signal.title}</strong>
                  <span className="text-sm text-ink-muted">{signal.body}</span>
                </span>
              </Reveal>
            ))}
          </ul>
        </Reveal>

        {/* The weights below are the example's real ones, straight from the engine. */}
        {top && (
          <Reveal delay={150}>
            <div className="halo rounded-2xl border border-rule bg-surface p-6 shadow-[0_12px_32px_-16px_var(--shadow)] sm:p-8">
              <div className="mb-6 flex items-center gap-3">
                <ChampionAvatar name={top.championName} imageUrl={top.championImageUrl} size={44} />
                <span>
                  <span className="block text-xs text-ink-faint">Pondération du pick recommandé</span>
                  <strong className="text-lg font-semibold tracking-tight">{top.championName}</strong>
                </span>
                <span className="ml-auto text-right">
                  <strong className="block text-2xl font-semibold tabular-nums text-accent">
                    <CountUp value={Math.round(top.totalScore)} />
                  </strong>
                  <span className="text-xs text-ink-faint">score / 100</span>
                </span>
              </div>
              <FactorBars factors={top.explanation.factors} />
              <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-rule-soft bg-rule-soft text-sm">
                <div className="bg-surface p-4">
                  <dt className="text-xs text-ink-faint">Classement winrate</dt>
                  <dd className="mt-1 font-semibold tabular-nums">
                    #{top.rank} sur {top.totalRanked}
                  </dd>
                </div>
                {top.winRate !== null && (
                  <div className="bg-surface p-4">
                    <dt className="text-xs text-ink-faint">Taux de victoire</dt>
                    <dd className="mt-1 font-semibold tabular-nums">{top.winRate.toFixed(1)} %</dd>
                  </div>
                )}
              </dl>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
