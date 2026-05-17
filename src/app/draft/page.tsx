import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { createClient } from "@/lib/supabase/server";

export default async function DraftPage() {
  let champions = undefined;

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("champions").select("id, name").order("name");
    champions = data ?? undefined;
  } catch {
    champions = undefined;
  }

  return <CoachWorkspace champions={champions} />;
}
