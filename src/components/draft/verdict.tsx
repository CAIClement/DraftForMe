import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { Score } from "@/components/ui/score";
import { VerdictDetail } from "./verdict-detail";
import type { Recommendation } from "@/lib/recommendation/types";
import type { Role } from "@/lib/draft/roles";

export function Verdict({
  recommendation,
  role,
  enemyChampionId
}: {
  recommendation: Recommendation;
  role?: Role;
  enemyChampionId?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-accent">
      <div className="flex items-center gap-3 bg-accent-wash p-3.5">
        <ChampionAvatar name={recommendation.championName} imageUrl={recommendation.championImageUrl} />
        <span>
          <span className="block text-lg font-bold tracking-tight">{recommendation.championName}</span>
          <span className="text-[10.5px] font-bold uppercase tracking-widest text-accent">Votre pick</span>
        </span>
        <span className="ml-auto">
          <Score value={recommendation.totalScore} />
        </span>
      </div>

      <VerdictDetail
        recommendation={recommendation}
        role={role}
        enemyChampionId={enemyChampionId}
        className="border-t border-rule-soft p-3.5"
      />
    </div>
  );
}
