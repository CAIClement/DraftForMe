import { CoachWorkspace } from "@/components/coach/coach-workspace";
import { createClient } from "@/lib/supabase/server";

type ChampionRow = {
  id: string;
  name: string;
  image_url: string | null;
};

export default async function DraftPage() {
  let champions:
    | {
        id: string;
        name: string;
        imageUrl?: string;
      }[]
    | undefined = undefined;

  try {
    const supabase = await createClient();
    const { data } = await supabase.from("champions").select("id, name, image_url").order("name");
    const rows = (data ?? []) as ChampionRow[];
    champions = rows.map((champion) => ({
      id: champion.id,
      name: champion.name,
      imageUrl: champion.image_url ?? undefined
    }));
  } catch {
    champions = undefined;
  }

  return <CoachWorkspace champions={champions} />;
}
