import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const failure = NextResponse.redirect(new URL("/connexion?erreur=1", url.origin));

  if (!code) return failure;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return failure;

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (!(profile as { display_name: string | null } | null)?.display_name) {
    const nicknamePage = new URL("/compte/pseudo", url.origin);
    nicknamePage.searchParams.set("next", next);
    return NextResponse.redirect(nicknamePage);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
