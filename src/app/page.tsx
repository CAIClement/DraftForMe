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
type ChampionRow = { id: string; name: string; image_url: string | null; ddragon_version: string };
type DatedRow = { fetched_at: string };

const CONTEXT = "EUW · Emerald+";

// Resolved on the server so the page arrives already populated: no empty flash,
// and the example is indexable. Calls the engine directly rather than fetching
// this app's own API route over HTTP.
async function loadExample() {
  const supabase = await createClient();

  const [statsResult, relationResult, championResult, indexResult] = await Promise.all([
    supabase
      .from("champion_stats")
      .select("champion_id, role, win_rate, pick_rate, ban_rate, games, fetched_at, champions(id, name, image_url)")
      .eq("role", DEFAULT_EXAMPLE.role)
      .eq("region", DEFAULT_EXAMPLE.region)
      .eq("tier", DEFAULT_EXAMPLE.tier)
      .order("win_rate", { ascending: false }),
    supabase
      .from("counter_relations")
      .select("champion_id, countered_by_champion_id, role")
      .eq("role", DEFAULT_EXAMPLE.role),
    supabase.from("champions").select("id, name, image_url, ddragon_version").order("name"),
    supabase
      .from("champion_stats")
      .select("games")
      .eq("region", DEFAULT_EXAMPLE.region)
      .eq("tier", DEFAULT_EXAMPLE.tier)
  ]);

  // A failed `champions` query is the dangerous one. `recommendations` derives
  // from `stats`, so the tool still renders -- but `EnemyPicks` resolves its
  // chips against `champions`, so every enemy pick silently disappears while
  // the verdict above it still cites those picks by name. Throwing routes both
  // fatal cases into the caller's visible degraded state instead.
  if (statsResult.error) throw statsResult.error;
  if (championResult.error) throw championResult.error;

  if (relationResult.error) {
    // Not fatal, but not silent either: the engine's "no counter relation
    // known" wording is identical whether the relation is genuinely absent or
    // this query fell over.
    console.error("counter_relations query failed", relationResult.error);
  }

  if (indexResult.error) {
    // Same posture as the relations query: the tool is fully usable without the
    // index totals, and their tiles are omitted rather than zeroed. Logged so an
    // outage is distinguishable from a genuinely empty index.
    console.error("champion_stats index query failed", indexResult.error);
  }

  const { data: statsRows } = statsResult;
  const { data: relationRows } = relationResult;
  const championRows = (championResult.data ?? []) as unknown as ChampionRow[];

  const stats = mapStatsRowsToChampionStats((statsRows ?? []) as unknown as StatsRow[]);

  const champions = championRows.map((row) => ({
    id: row.id,
    name: row.name,
    imageUrl: row.image_url ?? undefined
  }));

  const recommendations = recommendChampions({
    stats,
    playerPool: [],
    enemyPicks: [...DEFAULT_EXAMPLE.enemyPicks],
    bannedChampionIds: [],
    alreadyPickedChampionIds: [...DEFAULT_EXAMPLE.enemyPicks],
    priority: 50,
    topN: 3,
    counterRelations: mapCounterRelationRows((relationRows ?? []) as unknown as RelationRow[]),
    // The dossier names enemy picks, which need not be ranked in the
    // candidate's own role. Without the full table the engine falls back to the
    // raw id and prints a slug in its headline sentence.
    championNames: championRows.map((row) => ({ championId: row.id, name: row.name }))
  });

  // The League patch is the first two segments of the Data Dragon version:
  // "16.3.1" is patch 16.3. Derived rather than hardcoded, because a patch
  // number the data cannot support is exactly the kind of claim this bar exists
  // to rule out.
  const version = championRows[0]?.ddragon_version ?? null;
  const patch = version === null ? null : version.split(".").slice(0, 2).join(".");

  const fetchedAt =
    ((statsResult.data ?? []) as unknown as DatedRow[])
      .map((row) => row.fetched_at)
      .sort()
      .at(-1) ?? null;

  // Champion appearances, not matches. See the comment on TrustBar.
  //
  // Deliberately unscoped by role: these two numbers describe the whole indexed
  // dataset, they are rendered once on the server, and the visitor can switch
  // role without them updating. A role-qualified label would be wrong the moment
  // they did.
  const indexRows = (indexResult.data ?? []) as unknown as Array<{ games: number | null }>;
  const appearances = indexRows.reduce<number | null>(
    (sum, row) => (row.games === null ? sum : (sum ?? 0) + row.games),
    null
  );
  const rankedChampions = indexRows.length === 0 ? null : indexRows.length;

  // An unknown count is not a count of zero, and this row exists to establish
  // that real data sits behind the product.
  return {
    recommendations,
    champions,
    appearances,
    rankedChampions,
    patch,
    fetchedAt
  };
}

export default async function HomePage() {
  let example: {
    recommendations: Recommendation[];
    champions: { id: string; name: string; imageUrl?: string }[];
    appearances: number | null;
    rankedChampions: number | null;
    patch: string | null;
    fetchedAt: string | null;
  };

  try {
    example = await loadExample();
  } catch {
    example = {
      recommendations: [],
      champions: [],
      appearances: null,
      rankedChampions: null,
      patch: null,
      fetchedAt: null
    };
  }

  // A missing patch drops that segment entirely rather than rendering
  // "Patch null" -- the rest of the context is still true without it.
  const headerContext = [example.patch === null ? null : `Patch ${example.patch}`, "EUW", "Emerald+"]
    .filter((part): part is string => part !== null)
    .join(" · ");

  return (
    <main>
      <SiteHeader context={headerContext} />

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
        {example.rankedChampions !== null && (
          <TrustBar
            appearances={example.appearances}
            rankedChampions={example.rankedChampions}
            patch={example.patch}
            context={CONTEXT}
            updatedAt={example.fetchedAt}
          />
        )}
      </div>

      <SiteFooter />
    </main>
  );
}
