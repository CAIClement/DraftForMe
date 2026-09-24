import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Connexion — DraftForMe",
  description: "Connectez-vous à DraftForMe avec Discord ou Google."
};

const BUTTON =
  "block w-full rounded-md border border-rule bg-surface px-4 py-3 text-center text-sm font-medium text-ink transition-colors duration-200 hover:border-accent";

export default async function SignInPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; erreur?: string }>;
}) {
  const { next, erreur } = await searchParams;
  const safeNext = safeNextPath(next);

  if (await getCurrentUser()) redirect(safeNext as Route);

  const loginHref = (provider: "discord" | "google") =>
    `/auth/login?provider=${provider}&next=${encodeURIComponent(safeNext)}`;

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">Connexion</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Un compte vous permettra bientôt de donner votre avis sur les matchups. L&apos;outil de draft reste
        utilisable sans compte.
      </p>
      {erreur && (
        <p role="alert" className="mt-6 text-sm text-danger">
          La connexion a échoué. Réessayez.
        </p>
      )}
      <div className="mt-8 space-y-3">
        {/* Plain <a>: these are route handlers that redirect to the provider, not pages to prefetch. */}
        <a href={loginHref("discord")} className={BUTTON}>
          Continuer avec Discord
        </a>
        <a href={loginHref("google")} className={BUTTON}>
          Continuer avec Google
        </a>
      </div>
      <p className="mt-8 text-xs text-ink-faint">
        En vous connectant, vous acceptez les{" "}
        <Link href="/conditions-utilisation" className="underline underline-offset-2 hover:text-ink">
          conditions d&apos;utilisation
        </Link>{" "}
        et la{" "}
        <Link href="/confidentialite" className="underline underline-offset-2 hover:text-ink">
          politique de confidentialité
        </Link>
        .
      </p>
    </div>
  );
}
