import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; nickname: string | null };

// Every public page renders the header with this. Supabase being down or
// unconfigured must not take the page with it: it is treated as signed out.
// Wrapped in React's cache so a layout and a page share one lookup per render.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
    return { id: user.id, nickname: (data as { display_name: string | null } | null)?.display_name ?? null };
  } catch {
    return null;
  }
});
