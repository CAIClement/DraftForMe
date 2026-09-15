import type { RecommendationFactor } from "@/lib/recommendation/types";

export function FactorBars({ factors }: { factors: RecommendationFactor[] }) {
  const available = factors.filter((factor) => factor.available);

  return (
    <div>
      {available.map((factor) => (
        <div key={factor.key} className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
          <em className="w-24 not-italic font-semibold">{factor.label}</em>
          <span className="relative h-[5px] flex-1 rounded-full bg-rule">
            <i
              className="absolute inset-y-0 left-0 block rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }}
            />
          </span>
          <u className="w-6 text-right font-bold not-underline text-ink tabular-nums">
            {Math.round(factor.score)}
          </u>
          <s data-testid="factor-weight" className="w-12 text-right text-[10px] no-underline text-ink-faint">
            ×{Math.round(factor.weight)} %
          </s>
        </div>
      ))}
    </div>
  );
}
