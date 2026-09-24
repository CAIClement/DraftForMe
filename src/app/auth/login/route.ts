import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

const PROVIDERS = ["discord", "google"] as const;
type Provider = (typeof PROVIDERS)[number];

function isProvider(value: string | null): value is Provider {
  return PROVIDERS.includes(value as Provider);
}

// No `scopes` option: Supabase always requests its own default scopes for each
// provider and `scopes` could only add to them. The privacy policy describes
// what those defaults send.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider");

  if (!isProvider(provider)) {
    return NextResponse.json({ error: "Fournisseur inconnu." }, { status: 400 });
  }

  const callback = new URL("/auth/callback", url.origin);
  callback.searchParams.set("next", safeNextPath(url.searchParams.get("next")));

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: callback.toString(), skipBrowserRedirect: true }
  });

  if (error || !data.url) {
    return NextResponse.redirect(new URL("/connexion?erreur=1", url.origin));
  }

  return NextResponse.redirect(data.url);
}
