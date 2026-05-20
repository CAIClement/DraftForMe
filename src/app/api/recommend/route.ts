import { NextResponse } from "next/server";
import { mapPoolRowsToPlayerPool, mapStatsRowsToChampionStats } from "@/lib/data/normalize";
import { recommendChampions } from "@/lib/recommendation/engine";
import { createClient } from "@/lib/supabase/server";
import { recommendationRequestSchema } from "./schema";

type StatsRow = Parameters<typeof mapStatsRowsToChampionStats>[0][number];
type PoolRow = Parameters<typeof mapPoolRowsToPlayerPool>[0][number];

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

  const { data: statsRows, error: statsError } = await supabase
    .from("champion_stats")
    .select("champion_id, role, win_rate, pick_rate, ban_rate, champions(id, name, image_url)")
    .eq("role", parsed.data.role)
    .eq("region", parsed.data.region)
    .eq("tier", parsed.data.tier)
    .order("win_rate", { ascending: false });

  if (statsError) {
    return NextResponse.json({ error: "Unable to load champion stats." }, { status: 500 });
  }

  const { data: poolRows } = user
    ? await supabase
        .from("champion_pool_entries")
        .select("champion_id, confidence, games, win_rate, champions(id, name)")
        .eq("user_id", user.id)
    : { data: [] };

  const stats = mapStatsRowsToChampionStats((statsRows ?? []) as unknown as StatsRow[]);
  const playerPool = mapPoolRowsToPlayerPool((poolRows ?? []) as unknown as PoolRow[]);

  const recommendations = recommendChampions({
    stats,
    playerPool,
    enemyPicks: parsed.data.enemyPicks,
    bannedChampionIds: parsed.data.bans,
    alreadyPickedChampionIds: parsed.data.enemyPicks,
    priority: parsed.data.priority,
    topN: parsed.data.topN
  });

  if (user) {
    await supabase.from("recommendation_sessions").insert({
      user_id: user.id,
      role: parsed.data.role,
      region: parsed.data.region,
      tier: parsed.data.tier,
      enemy_picks: parsed.data.enemyPicks,
      bans: parsed.data.bans
    } as never);
  }

  return NextResponse.json({ recommendations });
}
