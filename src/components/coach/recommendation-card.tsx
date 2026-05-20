import type { Recommendation } from "@/lib/recommendation/types";

export function RecommendationCard({ recommendation }: { recommendation: Recommendation }) {
  return (
    <article className="rounded-md border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{recommendation.championName}</h3>
          <p className="mt-1 text-sm text-slate-300">{recommendation.explanation.summary}</p>
        </div>
        <div className="text-2xl font-bold text-teal">{recommendation.totalScore}</div>
      </div>

      <div className="mt-4 grid gap-2">
        {recommendation.explanation.factors.map((factor) => (
          <div key={factor.key} className="rounded-md bg-ink p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-white">{factor.label}</span>
              <span className="text-slate-300">
                {factor.score} · poids {factor.weight}%
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">{factor.detail}</p>
          </div>
        ))}
      </div>

      {recommendation.explanation.warnings.length > 0 ? (
        <div className="mt-3 rounded-md border border-danger/50 bg-danger/10 p-3 text-sm text-red-100">
          {recommendation.explanation.warnings.join(" ")}
        </div>
      ) : null}

      {recommendation.explanation.alternatives.length > 0 ? (
        <p className="mt-3 text-sm text-slate-400">
          Alternatives proches : {recommendation.explanation.alternatives.map((alternative) => alternative.championName).join(", ")}
        </p>
      ) : null}
    </article>
  );
}
