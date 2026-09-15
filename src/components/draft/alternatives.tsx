import type { Recommendation } from "@/lib/recommendation/types";

const number = new Intl.NumberFormat("fr-FR");

// Joined rather than interpolated, so the separator cannot dangle when a fact
// is missing. The spec's rule is that a null fact is omitted, never shown as
// `0` or an em dash: a dash occupies the slot where a number goes and reads as
// "we measured this and found nothing", which is the opposite of the point.
function Facts({ recommendation }: { recommendation: Recommendation }) {
  const facts = [
    recommendation.winRate === null ? null : `${recommendation.winRate.toFixed(1)} %`,
    recommendation.games === null ? null : `${number.format(recommendation.games)} parties`
  ].filter((fact): fact is string => fact !== null);

  if (facts.length === 0) return null;

  return <span className="text-[10.5px] text-ink-faint">{facts.join(" · ")}</span>;
}

export function Alternatives({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2">
      {recommendations.map((recommendation) => (
        <div
          key={recommendation.championId}
          data-testid="alternative"
          className="flex-1 rounded-lg border border-rule bg-surface px-3 py-2.5"
        >
          <b className="block text-sm font-bold tracking-tight">
            {recommendation.championName}{" "}
            <span className="font-extrabold text-accent">{Math.round(recommendation.totalScore)}</span>
          </b>
          <Facts recommendation={recommendation} />
        </div>
      ))}
    </div>
  );
}
