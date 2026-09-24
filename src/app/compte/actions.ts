"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateNickname } from "@/lib/auth/nickname";
import { DELETE_CONFIRMATION } from "@/lib/auth/delete-confirmation";
import { safeNextPath } from "@/lib/auth/safe-next-path";
import { createClient } from "@/lib/supabase/server";

// A "use server" file may only export async functions (and types), so the
// confirmation word lives in src/lib/auth/delete-confirmation.ts.
export type FormState = { error: string | null };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";
const UNIQUE_VIOLATION = "23505";

export async function saveNickname(_previous: FormState, formData: FormData): Promise<FormState> {
  const result = validateNickname(String(formData.get("nickname") ?? ""));
  if (!result.ok) return { error: result.error };

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) {
    const next = safeNextPath(String(formData.get("next") ?? "/compte"));
    redirect(`/connexion?next=${encodeURIComponent(next)}` as Route);
  }

  // The profiles row is created here the first time: the insert and update
  // policies from 0001 limit it to the user's own row.
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: user.id, display_name: result.nickname, updated_at: new Date().toISOString() } as never, {
      onConflict: "user_id"
    });

  if (error) {
    return { error: (error as { code?: string }).code === UNIQUE_VIOLATION ? "Ce pseudo est déjà pris." : GENERIC_ERROR };
  }

  revalidatePath("/", "layout");
  redirect(safeNextPath(String(formData.get("next") ?? "/compte")) as Route);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(error ? ("/connexion?erreur=deconnexion" as Route) : "/");
}

export async function deleteAccount(_previous: FormState, formData: FormData): Promise<FormState> {
  if (formData.get("confirmation") !== DELETE_CONFIRMATION) {
    return { error: `Tapez ${DELETE_CONFIRMATION} pour confirmer.` };
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect("/connexion" as Route);

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: GENERIC_ERROR };

  // auth-js tolerates the 401/403/404 from logging out a user that no longer
  // exists, then clears the local cookies.
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/");
}
