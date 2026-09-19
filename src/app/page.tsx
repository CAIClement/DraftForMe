import { ROLES } from "@/components/draft/role-selector";
import { CtaSection } from "@/components/home/cta-section";
import { DataSection } from "@/components/home/data-section";
import { FaqSection } from "@/components/home/faq-section";
import { Hero } from "@/components/home/hero";
import { MethodSection } from "@/components/home/method-section";
import { SignalsSection } from "@/components/home/signals-section";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { DEFAULT_EXAMPLE } from "@/lib/draft/default-example";
import { EXAMPLE_CONTEXT, headerContext, loadExampleOrEmpty } from "@/lib/draft/load-example";

// Required alongside the cached loader: see the comment in load-example.ts.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const example = await loadExampleOrEmpty();

  const roleLabel = ROLES.find((role) => role.id === DEFAULT_EXAMPLE.role)?.label ?? DEFAULT_EXAMPLE.role;
  // Resolved against the champion table rather than printing slugs; a pick the
  // table does not know is left out instead of shown as an id.
  const enemyNames = DEFAULT_EXAMPLE.enemyPicks
    .map((id) => example.champions.find((champion) => champion.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  const caption = enemyNames.length === 0 ? null : `${roleLabel} contre ${enemyNames.join(" et ")}`;

  return (
    <>
      <SiteHeader current="home" context={headerContext(example.patch)} />

      <main>
        <Hero recommendations={example.recommendations} caption={caption} patch={example.patch} />
        <SignalsSection top={example.recommendations[0]} />
        <MethodSection />
        <DataSection
          appearances={example.appearances}
          rankedChampions={example.rankedChampions}
          patch={example.patch}
          context={EXAMPLE_CONTEXT}
          updatedAt={example.fetchedAt}
        />
        <FaqSection />
        <CtaSection />
      </main>

      <SiteFooter />
    </>
  );
}
