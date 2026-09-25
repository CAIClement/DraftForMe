"use client";

import { Fragment } from "react";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { InfoTip } from "@/components/ui/info-tip";
import { VerdictDetail } from "./verdict-detail";
import type { Role } from "@/lib/draft/roles";
import type { Recommendation } from "@/lib/recommendation/types";

const number = new Intl.NumberFormat("fr-FR");

// The help texts describe what the engine computes today
// (`src/lib/recommendation/engine.ts`: `metaScore`, `computeWeights`;
// `counter.ts`: `scoreCounter`). If the engine changes, these change with it.
// "Score" names only patch strength and matchup: the pool's weight is not
// assessable for visitors until accounts ship, and has no column here.
const COLUMNS = [
  {
    key: "score",
    label: "Score",
    help: "Note sur 100 qui combine la force dans le patch et le matchup, selon les poids affichés dans le détail. Sans pick adverse, seule la force dans le patch compte.",
    align: "start"
  },
  {
    key: "meta",
    label: "Force dans le patch",
    help: "Place du champion dans le classement au winrate à ce rôle, ramenée sur 100 : le premier a 100, le dernier environ 10.",
    align: "start"
  },
  {
    key: "counter",
    label: "Matchup",
    help: "Comment ce champion s'en sort face aux picks adverses déjà posés. On part de 50 (neutre) : chaque adversaire qu'il contre fait monter le score, chaque adversaire qui le contre le fait baisser, et votre adversaire direct compte double. Basé sur les relations de counter connues entre champions, pas sur un winrate de matchup.",
    align: "start"
  },
  {
    key: "winRate",
    label: "Winrate",
    help: "Part des parties gagnées par ce champion à ce rôle, dans les données du patch actuel.",
    align: "end"
  },
  {
    key: "games",
    label: "Parties",
    help: "Nombre de parties sur lesquelles reposent ces statistiques.",
    align: "end"
  }
] as const;

function factorScore(recommendation: Recommendation, key: "meta" | "counter"): string | null {
  const factor = recommendation.explanation.factors.find((entry) => entry.key === key);
  return factor?.available ? String(Math.round(factor.score)) : null;
}

// One value per column, in `COLUMNS` order. `null` renders as an empty cell:
// the site never fills a missing number with `0` or a dash.
function cells(recommendation: Recommendation): Array<string | null> {
  return [
    String(Math.round(recommendation.totalScore)),
    factorScore(recommendation, "meta"),
    factorScore(recommendation, "counter"),
    recommendation.winRate === null ? null : `${recommendation.winRate.toFixed(1)} %`,
    recommendation.games === null ? null : number.format(recommendation.games)
  ];
}

/**
 * Every recommendation side by side, in the server's order: rows never move
 * when one is selected. The selected row's detail opens right under it. Hover
 * and focus preview a row on the map without committing it, like the
 * alternatives cards did.
 */
export function ComparisonTable({
  recommendations,
  selectedId,
  role,
  enemyChampionId,
  onPreview,
  onSelect
}: {
  recommendations: Recommendation[];
  selectedId: string;
  role: Role;
  enemyChampionId: string | null;
  onPreview: (championId: string | null) => void;
  onSelect: (championId: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-rule">
      <table className="w-full min-w-[440px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-rule text-[10px] font-bold uppercase tracking-[0.12em] text-ink-faint">
            <th scope="col" className="p-2 text-left">
              <span className="sr-only">Champion</span>
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key} scope="col" className="p-2 text-right">
                <span className="inline-flex items-center gap-1">
                  {column.label}
                  <InfoTip label={column.label} text={column.help} align={column.align} />
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {recommendations.map((recommendation, index) => {
            const id = recommendation.championId;
            const selected = id === selectedId;
            const detailId = `comparison-detail-${id}`;
            const score = Math.round(recommendation.totalScore);

            return (
              <Fragment key={id}>
                {/* The row takes the mouse click; the button in its first cell is
                    the one focusable element, and a keyboard activation of it
                    bubbles here as a click, so both paths select exactly once. */}
                <tr
                  onClick={() => onSelect(id)}
                  onMouseEnter={() => onPreview(id)}
                  onMouseLeave={() => onPreview(null)}
                  className={`cursor-pointer border-b border-rule-soft transition-colors duration-200 ${
                    selected ? "bg-accent-wash" : "hover:bg-surface-sunk"
                  }`}
                >
                  <td className={`p-1.5 ${selected ? "border-l-2 border-l-accent" : "border-l-2 border-l-transparent"}`}>
                    <button
                      type="button"
                      aria-label={`${recommendation.championName}, score ${score}`}
                      aria-expanded={selected}
                      aria-controls={selected ? detailId : undefined}
                      title={recommendation.championName}
                      onFocus={() => onPreview(id)}
                      onBlur={() => onPreview(null)}
                      className="flex items-center gap-2 rounded-lg"
                    >
                      <span aria-hidden="true" className="w-3 text-[10px] font-bold text-ink-faint">
                        {index + 1}
                      </span>
                      <ChampionAvatar
                        name={recommendation.championName}
                        imageUrl={recommendation.championImageUrl}
                        size={40}
                      />
                    </button>
                  </td>
                  {cells(recommendation).map((value, column) => (
                    <td
                      key={COLUMNS[column].key}
                      className={`p-2 text-right tabular-nums ${
                        column === 0 ? "text-sm font-extrabold text-accent" : "font-semibold text-ink"
                      }`}
                    >
                      {value}
                    </td>
                  ))}
                </tr>
                {selected && (
                  <tr id={detailId}>
                    <td colSpan={COLUMNS.length + 1} className="border-b border-rule bg-surface-sunk">
                      <VerdictDetail
                        recommendation={recommendation}
                        role={role}
                        enemyChampionId={enemyChampionId}
                        className="p-3.5"
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
