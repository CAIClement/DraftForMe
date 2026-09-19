import type { Metadata } from "next";
import { DraftTool } from "@/components/draft/draft-tool";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import { headerContext, loadExampleOrEmpty } from "@/lib/draft/load-example";

// Required alongside the cached loader: see the comment in load-example.ts.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Outil de draft — DraftForMe",
  description: "Choisissez votre rôle, ajoutez les picks adverses et obtenez trois champions tenables, expliqués."
};

export default async function DraftPage() {
  const example = await loadExampleOrEmpty();

  return (
    <>
      <SiteHeader current="draft" context={headerContext(example.patch)} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">
        <div className="mb-5">
          <h1 className="mb-2 text-3xl font-semibold tracking-[-0.03em]">Outil de draft</h1>
          {example.recommendations.length > 0 && (
            <p className="max-w-[60ch] text-sm leading-relaxed text-ink-muted">
              Déjà rempli avec un exemple. Changez de rôle ou ajoutez les champions pickés en face : la
              recommandation se met à jour.
            </p>
          )}
        </div>

        {example.recommendations.length === 0 ? (
          <p className="rounded-xl border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
            Les données de draft ne sont pas disponibles pour le moment. Réessayez dans un instant.
          </p>
        ) : (
          <DraftTool
            champions={example.champions}
            initialRole={DEFAULT_EXAMPLE.role}
            initialEnemyPicks={[...DEFAULT_EXAMPLE.enemyPicks]}
            initialRecommendations={example.recommendations}
          />
        )}
      </main>

      <SiteFooter />
    </>
  );
}
