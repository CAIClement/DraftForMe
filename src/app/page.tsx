import { Explainer } from "@/components/marketing/explainer";
import { Hero } from "@/components/marketing/hero";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { TrustBar } from "@/components/marketing/trust-bar";
import { DraftTool } from "@/components/draft/draft-tool";
import { mapCounterRelationRows, mapStatsRowsToChampionStats } from "@/lib/data/normalize";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import { recommendChampions } from "@/lib/recommendation/engine";
import type { Recommendation } from "@/lib/recommendation/types";
import { createClient } from "@/lib/supabase/server";

type StatsRow = Parameters<typeof mapStatsRowsToChampionStats>[0][number];
type RelationRow = Parameters<typeof mapCounterRelationRows>[0][number];

const PATCH = "16.10";
const CONTEXT = "EUW · Emerald+";

// Resolved on the server so the page arrives already populated: no empty flash,
// and the example is indexable. Calls the engine directly rather than fetching
// this app's own API route over HTTP.
async function loadExample() {
  const supabase = await createClient();

  const [{ data: statsRows }, { data: relationRows }, { data: championRows }] = await Promise.all([
    supabase
      .from("champion_stats")
      .select("champion_id, role, win_rate, pick_rate, ban_rate, games, champions(id, name, image_url)")
      .eq("role", DEFAULT_EXAMPLE.role)
      .eq("region", DEFAULT_EXAMPLE.region)
      .eq("tier", DEFAULT_EXAMPLE.tier)
      .order("win_rate", { ascending: false }),
    supabase
      .from("counter_relations")
      .select("champion_id, countered_by_champion_id, role")
      .eq("role", DEFAULT_EXAMPLE.role),
    supabase.from("champions").select("id, name, image_url").order("name")
  ]);

  const stats = mapStatsRowsToChampionStats((statsRows ?? []) as unknown as StatsRow[]);

  const recommendations = recommendChampions({
    stats,
    playerPool: [],
    enemyPicks: [...DEFAULT_EXAMPLE.enemyPicks],
    bannedChampionIds: [],
    alreadyPickedChampionIds: [...DEFAULT_EXAMPLE.enemyPicks],
    priority: 50,
    topN: 3,
    counterRelations: mapCounterRelationRows((relationRows ?? []) as unknown as RelationRow[])
  });

  const champions = ((championRows ?? []) as { id: string; name: string; image_url: string | null }[]).map(
    (row) => ({ id: row.id, name: row.name, imageUrl: row.image_url ?? undefined })
  );

  // Champion appearances, not matches. See the comment on TrustBar.
  const appearances = stats.reduce<number | null>(
    (sum, champion) => (champion.games === null ? sum : (sum ?? 0) + champion.games),
    null
  );

  return { recommendations, champions, appearances, rankedChampions: stats.length };
}

export default async function HomePage() {
  let example: {
    recommendations: Recommendation[];
    champions: { id: string; name: string; imageUrl?: string }[];
    appearances: number | null;
    rankedChampions: number;
  };

  try {
    example = await loadExample();
  } catch {
    example = { recommendations: [], champions: [], appearances: null, rankedChampions: 0 };
  }

  return (
    <main>
      <SiteHeader context={`Patch ${PATCH} · ${CONTEXT}`} />

      <div className="mx-auto max-w-5xl px-6 py-7">
        <Hero />

        {example.recommendations.length === 0 ? (
          <p className="rounded-xl border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
            Les données de draft ne sont pas disponibles pour le moment. Réessayez dans un instant.
          </p>
        ) : (
          <DraftTool
            champions={example.champions}
            initialRole={DEFAULT_EXAMPLE.role}
            initialEnemyPicks={[...DEFAULT_EXAMPLE.enemyPicks]}
            initialRecommendations={example.recommendations}
          />
        )}

        <Explainer />
        <TrustBar
          appearances={example.appearances}
          rankedChampions={example.rankedChampions}
          patch={PATCH}
          context={CONTEXT}
        />
      </div>

      <SiteFooter />
    </main>
  );
}
