import type { RecommendationFactor } from "@/lib/recommendation/types";

/**
 * Rounds the weights for display without letting them drift off their true
 * total. The engine emits one decimal, so rounding each independently makes
 * 16.5 / 43.5 / 40 render as 17 / 44 / 40 — 101%, on the one component whose
 * whole job is to look rigorous. Largest-remainder fixes that.
 *
 * The target is the sum of the weights actually shown, not a hardcoded 100:
 * when a factor is unavailable its weight is genuinely unaccounted for, and
 * inflating the rest to 100 would be the same lie in the other direction.
 */
function displayWeights(factors: RecommendationFactor[]): number[] {
  const target = Math.round(factors.reduce((sum, factor) => sum + factor.weight, 0));
  const floors = factors.map((factor) => Math.floor(factor.weight));
  const shown = [...floors];
  let remainder = target - floors.reduce((sum, value) => sum + value, 0);

  const byFraction = factors
    .map((factor, index) => ({ index, fraction: factor.weight - Math.floor(factor.weight) }))
    .sort((a, b) => b.fraction - a.fraction);

  for (const { index } of byFraction) {
    if (remainder <= 0) break;
    shown[index] += 1;
    remainder -= 1;
  }

  return shown;
}

export function FactorBars({ factors }: { factors: RecommendationFactor[] }) {
  const available = factors.filter((factor) => factor.available);
  const weights = displayWeights(available);

  return (
    <div>
      {available.map((factor, index) => (
        <div key={factor.key} className="mb-2 flex items-center gap-2 text-[11px] text-ink-muted">
          <span className="w-24 font-semibold">{factor.label}</span>
          <span className="relative h-[5px] flex-1 rounded-full bg-rule">
            <i
              className="absolute inset-y-0 left-0 block rounded-full bg-accent"
              style={{ width: `${Math.max(0, Math.min(100, factor.score))}%` }}
            />
          </span>
          <span className="w-6 text-right font-bold text-ink tabular-nums">
            {Math.round(factor.score)}
          </span>
          <span data-testid="factor-weight" className="w-12 text-right text-[10px] text-ink-faint">
            ×{weights[index]} %
          </span>
        </div>
      ))}
    </div>
  );
}
