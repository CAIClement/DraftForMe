import { NextResponse } from "next/server";
import { mapCounterRelationRows, mapPoolRowsToPlayerPool, mapStatsRowsToChampionStats } from "@/lib/data/normalize";
import { recommendChampions } from "@/lib/recommendation/engine";
import { createClient } from "@/lib/supabase/server";
import { recommendationRequestSchema } from "./schema";

type StatsRow = Parameters<typeof mapStatsRowsToChampionStats>[0][number];
type PoolRow = Parameters<typeof mapPoolRowsToPlayerPool>[0][number];
type CounterRelationRowType = Parameters<typeof mapCounterRelationRows>[0][number];
type ChampionNameRow = { id: string; name: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = recommendationRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid recommendation request.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [statsResult, poolResult, relationResult, championResult] = await Promise.all([
    supabase
      .from("champion_stats")
      .select("champion_id, role, win_rate, pick_rate, ban_rate, games, champions(id, name, image_url)")
      .eq("role", parsed.data.role)
      .eq("region", parsed.data.region)
      .eq("tier", parsed.data.tier)
      .order("win_rate", { ascending: false }),
    user
      ? supabase
          .from("champion_pool_entries")
          .select("champion_id, confidence, games, win_rate, champions(id, name)")
          .eq("user_id", user.id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("counter_relations")
      .select("champion_id, countered_by_champion_id, role")
      .eq("role", parsed.data.role),
    // The whole table, not just this role's ranked champions: the dossier names
    // the enemy picks, and an enemy need not be ranked in the role being drafted
    // for. Without this the engine falls back to the raw champion id.
    supabase.from("champions").select("id, name")
  ]);

  const { data: statsRows, error: statsError } = statsResult;
  const { data: poolRows } = poolResult;
  const { data: relationRows, error: relationError } = relationResult;
  const { data: championRows, error: championError } = championResult;

  if (statsError) {
    return NextResponse.json({ error: "Unable to load champion stats." }, { status: 500 });
  }

  if (relationError) {
    // Not fatal: stats and pool still produce a usable ranking without the
    // counter term. But it must not pass silently — the engine's "no counter
    // relation known" warning is indistinguishable from this outage to a user.
    console.error("counter_relations query failed", relationError);
  }

  if (championError) {
    // Also not fatal: the ranking is unaffected and the engine still has the
    // candidates' own names. Only the enemy names in the matchup sentence fall
    // back to ids, which is worth a log rather than a 500.
    console.error("champions query failed", championError);
  }

  const stats = mapStatsRowsToChampionStats((statsRows ?? []) as unknown as StatsRow[]);
  const playerPool = mapPoolRowsToPlayerPool((poolRows ?? []) as unknown as PoolRow[]);

  // The column behind `enemy_picks` is `text[]`, and the insert below is cast
  // `as never`, so a shape mistake here would compile and only fail against
  // the live database. Extract once, use for both.
  const enemyChampionIds = parsed.data.enemyPicks.map((pick) => pick.championId);

  const recommendations = recommendChampions({
    stats,
    playerPool,
    enemyPicks: parsed.data.enemyPicks,
    draftingRole: parsed.data.role,
    bannedChampionIds: parsed.data.bans,
    alreadyPickedChampionIds: [...parsed.data.allyPicks, ...enemyChampionIds],
    priority: parsed.data.priority,
    topN: parsed.data.topN,
    counterRelations: mapCounterRelationRows((relationRows ?? []) as unknown as CounterRelationRowType[]),
    championNames: ((championRows ?? []) as unknown as ChampionNameRow[]).map((row) => ({
      championId: row.id,
      name: row.name
    }))
  });

  return NextResponse.json({ recommendations });
}
