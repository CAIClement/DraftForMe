import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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

export const metadata: Metadata = {
  title: "Avis sur ce matchup — DraftForMe",
  description: "Votez pour le gagnant de ce duel de lane et lisez l'avis des autres joueurs."
};

type ChampionRow = { id: string; name: string; image_url: string };

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
  params: Promise<{ role: string; pair: string }>;
  searchParams: Promise<{ offset?: string | string[] }>;
}) {
  const { role, pair } = await params;
  const { offset: offsetParam } = await searchParams;

  if (!isRole(role)) notFound();
  const parsedPair = parsePairSegment(pair);
  if (!parsedPair) notFound();

  const key: MatchupKey = { role, ...parsedPair };
  const path = `/duel/${role}/${pairSegment(key)}`;
  const offset = parseOffset(offsetParam);

  const supabase = await createClient();
  const [championsResult, user] = await Promise.all([
    supabase.from("champions").select("id, name, image_url").in("id", [key.championLowId, key.championHighId]),
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
  const signInHref = `/connexion?next=${encodeURIComponent(offset > 0 ? `${path}?offset=${offset}` : path)}` as Route;

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <p className="mb-2 text-sm text-ink-muted">{ROLE_LABELS[role]}</p>
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
            role={role}
            summary={summaryResult.value}
            action={castVote}
          />
        ) : (
          <ErrorMessage />
        )}

        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-ink">Discussion</h2>
          {user ? (
            <CommentForm role={role} championLowId={championLow.id} championHighId={championHigh.id} />
          ) : (
            <p className="text-sm text-ink-muted">
              <Link href={signInHref} className="text-accent underline underline-offset-2">
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
