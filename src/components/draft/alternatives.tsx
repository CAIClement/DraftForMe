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

/**
 * Interactive only when the caller can act on a choice. On the board, hovering
 * an alternative previews it on your lane and clicking promotes it. On the home
 * page the same list is a read-only sample -- it says so on the panel -- and
 * there is no board to project a preview onto, so the cards are plain elements.
 * A button that does nothing when pressed is worse than no button.
 */
export function Alternatives({
  recommendations,
  onPreview,
  onSelect
}: {
  recommendations: Recommendation[];
  onPreview?: (championId: string | null) => void;
  onSelect?: (championId: string) => void;
}) {
  if (recommendations.length === 0) return null;

  const interactive = onPreview !== undefined && onSelect !== undefined;

  return (
    <div className="mt-2 flex gap-2">
      {recommendations.map((recommendation) => {
        const body = (
          <>
            <b className="block text-sm font-bold tracking-tight text-ink">
              {recommendation.championName}{" "}
              <span className="font-extrabold text-accent">{Math.round(recommendation.totalScore)}</span>
            </b>
            <Facts recommendation={recommendation} />
          </>
        );

        const shell = "flex-1 rounded-lg border border-rule bg-surface px-3 py-2.5 text-left";

        if (!interactive) {
          return (
            <div key={recommendation.championId} data-testid="alternative" className={shell}>
              {body}
            </div>
          );
        }

        return (
          <button
            key={recommendation.championId}
            type="button"
            data-testid="alternative"
            onMouseEnter={() => onPreview(recommendation.championId)}
            onMouseLeave={() => onPreview(null)}
            onFocus={() => onPreview(recommendation.championId)}
            onBlur={() => onPreview(null)}
            onClick={() => onSelect(recommendation.championId)}
            className={`${shell} transition-colors duration-200 hover:border-accent`}
          >
            {body}
          </button>
        );
      })}
    </div>
  );
}
