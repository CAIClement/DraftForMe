import Link from "next/link";
import type { Route } from "next";
import { FactorBars } from "./factor-bars";
import type { Recommendation } from "@/lib/recommendation/types";
import type { Role } from "@/lib/draft/roles";
import { matchupHref } from "@/lib/matchup/key";

function Fact({ label, value }: { label: string; value: string | null }) {
  if (value === null) return null;

  return (
    <div className="flex justify-between border-t border-rule-soft py-1 first:border-0">
      <span className="text-ink-faint">{label}</span>
      <b className="tabular-nums">{value}</b>
    </div>
  );
}

const number = new Intl.NumberFormat("fr-FR");

/**
 * Why a champion is recommended: the weighted factors, the facts behind them,
 * the counter sentence and, when the lane duel is known, the community link.
 * Shared by `Verdict` (home page) and the draft tool's comparison table.
 */
export function VerdictDetail({
  recommendation,
  role,
  enemyChampionId,
  className = ""
}: {
  recommendation: Recommendation;
  role?: Role;
  enemyChampionId?: string | null;
  className?: string;
}) {
  const counter = recommendation.explanation.factors.find((factor) => factor.key === "counter");
  const communityHref: Route | null =
    role && enemyChampionId && enemyChampionId !== recommendation.championId
      ? matchupHref(recommendation.championId, enemyChampionId, role)
      : null;

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      <FactorBars factors={recommendation.explanation.factors} />

      <div className="text-[11.5px]">
        <Fact
          label="Winrate"
          value={recommendation.winRate === null ? null : `${recommendation.winRate.toFixed(1)} %`}
        />
        <Fact
          label="Parties analysées"
          value={recommendation.games === null ? null : number.format(recommendation.games)}
        />
        <Fact label="Classement winrate" value={`#${recommendation.rank} / ${recommendation.totalRanked}`} />
        <Fact
          label="Pick / ban"
          value={
            recommendation.pickRate === null || recommendation.banRate === null
              ? null
              : `${recommendation.pickRate.toFixed(1)} % · ${recommendation.banRate.toFixed(1)} %`
          }
        />
      </div>

      <p className="col-span-full border-t border-rule-soft pt-2.5 text-xs leading-relaxed text-ink-muted">
        {counter?.detail}
        {communityHref && (
          <>
            {" "}
            <Link href={communityHref} className="text-accent underline underline-offset-2 hover:text-accent-pale">
              Avis de la communauté
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
