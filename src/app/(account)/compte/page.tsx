import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { signOut } from "@/app/compte/actions";
import { DeleteAccountForm } from "@/components/auth/delete-account-form";
import { NicknameForm } from "@/components/auth/nickname-form";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "Mon compte — DraftForMe"
};

export default async function AccountPage({
  searchParams
}: {
  searchParams: Promise<{ erreur?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/compte")}` as Route);

  const { erreur } = await searchParams;

  return (
    <div className="mx-auto max-w-lg space-y-12 px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">Mon compte</h1>

      {erreur === "deconnexion" && (
        <p role="alert" className="text-sm text-danger">
          La déconnexion a échoué. Réessayez.
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Pseudo</h2>
        <NicknameForm defaultValue={user.nickname ?? undefined} next="/compte" />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Session</h2>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-rule px-4 py-2 text-sm text-ink-muted transition-colors duration-200 hover:text-ink"
          >
            Se déconnecter
          </button>
        </form>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-ink">Supprimer mon compte</h2>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
