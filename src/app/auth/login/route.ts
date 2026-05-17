import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const provider = requestUrl.searchParams.get("provider");

  if (provider !== "discord" && provider !== "google") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: `${requestUrl.origin}/auth/callback`
    }
  });

  if (!data.url) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.redirect(data.url);
}
