import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { castVote } from "./actions";
import { CommentForm } from "@/components/draft/matchup/comment-form";
import { CommentList } from "@/components/draft/matchup/comment-list";
import { VotePanel } from "@/components/draft/matchup/vote-panel";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isRole, ROLE_LABELS } from "@/lib/draft/roles";
import { type MatchupKey, pairSegment, parsePairSegment } from "@/lib/matchup/key";
import { COMMENTS_PER_PAGE, parseOffset } from "@/lib/matchup/pagination";
import { getComments, getVoteSummary } from "@/lib/matchup/reviews";
import { createClient } from "@/lib/supabase/server";

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";
const LINK = "text-sm text-accent underline underline-offset-2";

const DESCRIPTION = "Votez pour le gagnant de ce duel de lane et lisez l'avis des autres joueurs.";
const FALLBACK_METADATA: Metadata = { title: "Avis sur ce matchup — DraftForMe", description: DESCRIPTION };

type ChampionRow = { id: string; name: string; image_url: string };
type RouteParams = Promise<{ role: string; pair: string }>;

// Shared by generateMetadata and the page. Unknown role or non-canonical
// pair gives null.
const resolveKey = (role: string, pair: string): MatchupKey | null => {
  if (!isRole(role)) return null;
  const parsedPair = parsePairSegment(pair);
  return parsedPair ? { role, ...parsedPair } : null;
};

// Wrapped in React's cache so generateMetadata and the page share one query.
const loadChampions = cache(async (championLowId: string, championHighId: string) => {
  const supabase = await createClient();
  return supabase.from("champions").select("id, name, image_url").in("id", [championLowId, championHighId]);
});

// Never throws: anything that cannot be resolved falls back to the generic
// title, and the page itself decides between 404 and the error message.
export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  try {
    const { role, pair } = await params;
    const key = resolveKey(role, pair);
    if (!key) return FALLBACK_METADATA;

    const { data, error } = await loadChampions(key.championLowId, key.championHighId);
    if (error) return FALLBACK_METADATA;
    const rows = (data ?? []) as ChampionRow[];
    const low = rows.find((c) => c.id === key.championLowId);
    const high = rows.find((c) => c.id === key.championHighId);
    if (!low || !high) return FALLBACK_METADATA;

    return {
      title: `${low.name} vs ${high.name} (${ROLE_LABELS[key.role]}) — avis de la communauté`,
      description: DESCRIPTION
    };
  } catch {
    return FALLBACK_METADATA;
  }
}

function ErrorMessage() {
  return (
    <p role="alert" className="rounded-xl border border-rule bg-surface p-6 text-center text-sm text-ink-muted">
      {GENERIC_ERROR}
    </p>
  );
}

export default async function MatchupPage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams: Promise<{ offset?: string | string[] }>;
}) {
  const { role, pair } = await params;
  const { offset: offsetParam } = await searchParams;

  const key = resolveKey(role, pair);
  if (!key) notFound();
  const path = `/duel/${key.role}/${pairSegment(key)}`;
  const offset = parseOffset(offsetParam);

  const supabase = await createClient();
  const [championsResult, user] = await Promise.all([
    loadChampions(key.championLowId, key.championHighId),
    getCurrentUser()
  ]);

  // Without the champions nothing on the page can be named. A failed read is
  // not a 404 (the matchup may well exist), so it gets the generic error.
  if (championsResult.error) {
    return (
      <>
        <SiteHeader user={user} />
        <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
          <ErrorMessage />
        </main>
        <SiteFooter />
      </>
    );
  }

  const rows = (championsResult.data ?? []) as ChampionRow[];
  const championLow = rows.find((c) => c.id === key.championLowId);
  const championHigh = rows.find((c) => c.id === key.championHighId);
  if (!championLow || !championHigh) notFound();

  // Settled separately: one failed read replaces only its own section with
  // the generic error, never with zero counts or an empty discussion.
  const userId = user?.id ?? null;
  const [summaryResult, commentsResult] = await Promise.allSettled([
    getVoteSummary(supabase, key, userId),
    getComments(supabase, key, userId, { limit: COMMENTS_PER_PAGE, offset })
  ]);

  const nextPageHref = `${path}?offset=${offset + COMMENTS_PER_PAGE}` as Route;
  const firstPageHref = path as Route;
  const returnTo = encodeURIComponent(offset > 0 ? `${path}?offset=${offset}` : path);
  const signInHref = `/connexion?next=${returnTo}` as Route;
  const nicknameHref = `/compte/pseudo?next=${returnTo}` as Route;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="mb-2 text-sm text-ink-muted">{ROLE_LABELS[key.role]}</p>
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <ChampionAvatar name={championLow.name} imageUrl={championLow.image_url} />
          <h1 className="text-2xl font-semibold text-ink">
            {championLow.name} vs {championHigh.name}
          </h1>
          <ChampionAvatar name={championHigh.name} imageUrl={championHigh.image_url} />
        </div>

        {summaryResult.status === "fulfilled" ? (
          <VotePanel
            championLow={{ id: championLow.id, name: championLow.name }}
            championHigh={{ id: championHigh.id, name: championHigh.name }}
            role={key.role}
            summary={summaryResult.value}
            action={castVote}
          />
        ) : (
          <ErrorMessage />
        )}

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-ink">Discussion</h2>
          {user?.nickname ? (
            <CommentForm role={key.role} championLowId={championLow.id} championHighId={championHigh.id} />
          ) : user ? (
            // Without a nickname postComment would redirect to /compte/pseudo
            // and lose the typed text, so the form is not offered until then.
            <p className="text-sm text-ink-muted">
              <Link href={nicknameHref} className={LINK}>
                Choisissez un pseudo
              </Link>{" "}
              pour participer à la discussion.
            </p>
          ) : (
            <p className="text-sm text-ink-muted">
              <Link href={signInHref} className={LINK}>
                Connectez-vous
              </Link>{" "}
              pour donner votre avis.
            </p>
          )}

          {commentsResult.status === "rejected" ? (
            <ErrorMessage />
          ) : offset > 0 && commentsResult.value.comments.length === 0 ? (
            // Past the last page: "no comment yet" would be false here.
            <p className="text-sm text-ink-muted">Il n&apos;y a pas d&apos;autre commentaire à afficher.</p>
          ) : (
            <CommentList comments={commentsResult.value.comments} matchup={key} />
          )}

          <div className="flex flex-wrap gap-4">
            {offset > 0 && (
              <Link href={firstPageHref} className={LINK}>
                Revenir aux premiers commentaires
              </Link>
            )}
            {commentsResult.status === "fulfilled" && commentsResult.value.hasMore && (
              <Link href={nextPageHref} className={LINK}>
                Voir plus
              </Link>
            )}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
