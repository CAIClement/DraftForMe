import type { Recommendation } from "@/lib/recommendation/types";

const number = new Intl.NumberFormat("fr-FR");

export function Alternatives({ recommendations }: { recommendations: Recommendation[] }) {
  if (recommendations.length === 0) return null;

  return (
    <div className="mt-2 flex gap-2">
      {recommendations.map((recommendation) => (
        <div key={recommendation.championId} className="flex-1 rounded-lg border border-rule bg-surface px-3 py-2.5">
          <b className="block text-sm font-bold tracking-tight">
            {recommendation.championName}{" "}
            <em className="not-italic font-extrabold text-accent">{Math.round(recommendation.totalScore)}</em>
          </b>
          <span className="text-[10.5px] text-ink-faint">
            {recommendation.winRate === null ? "—" : `${recommendation.winRate.toFixed(1)} %`}
            {recommendation.games !== null && ` · ${number.format(recommendation.games)} parties`}
          </span>
        </div>
      ))}
    </div>
  );
}
