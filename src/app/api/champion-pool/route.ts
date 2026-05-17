import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { championPoolRequestSchema } from "./schema";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("champion_pool_entries")
    .select("champion_id, confidence, games, win_rate, notes, champions(id, name)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "Unable to load champion pool." }, { status: 500 });
  }

  return NextResponse.json({ entries: data ?? [] });
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = championPoolRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid champion pool payload." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const rows = parsed.data.entries.map((entry) => ({
    user_id: user.id,
    champion_id: entry.championId,
    confidence: entry.confidence,
    games: entry.games ?? null,
    win_rate: entry.winRate ?? null,
    notes: entry.notes ?? null,
    source: "manual"
  }));

  const { error } = await supabase
    .from("champion_pool_entries")
    .upsert(rows as never, { onConflict: "user_id,champion_id" });

  if (error) {
    return NextResponse.json({ error: "Unable to save champion pool." }, { status: 500 });
  }

  return NextResponse.json({ status: "ok", saved: rows.length });
}
