import type { createClient } from "@/lib/supabase/server";
import type { MatchupKey } from "./key";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type VoteChoice = "low" | "high" | "even";
export type VoteSummary = { low: number; high: number; even: number; total: number; myChoice: VoteChoice | null };

export type ReactionValue = "for" | "against";
export type ReportReason = "spam" | "insultant" | "hors_sujet" | "autre";

export type Comment = {
  id: string;
  authorNickname: string | null; // null: anonymized (user_id is null)
  body: string;
  createdAt: string;
  updatedAt: string;
  edited: boolean;
  score: number;
  forCount: number;
  againstCount: number;
  myReaction: ReactionValue | null;
  isMine: boolean;
};

export type MutationResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";
const RATE_LIMITED_MESSAGE = "comment_rate_limited";
const UNIQUE_VIOLATION = "23505";
const COMMENT_MIN = 3;
const COMMENT_MAX = 500;

function whereMatchup<T extends { eq: (...args: [string, string]) => T }>(query: T, key: MatchupKey): T {
  return query.eq("role", key.role).eq("champion_low_id", key.championLowId).eq("champion_high_id", key.championHighId);
}

const VOTE_CHOICES: readonly VoteChoice[] = ["low", "high", "even"];

// Each choice is counted by the database (head: true, no rows sent back):
// loading the rows and counting them here would silently stop at PostgREST's
// max_rows. Throws on a read error, like getComments below: "0 votes" would
// be false.
export async function getVoteSummary(
  supabase: SupabaseServerClient,
  key: MatchupKey,
  userId: string | null
): Promise<VoteSummary> {
  const countQueries = VOTE_CHOICES.map((choice) =>
    whereMatchup(supabase.from("matchup_votes").select("id", { count: "exact", head: true }), key).eq("choice", choice)
  );
  const ownVoteQuery =
    userId === null
      ? null
      : whereMatchup(supabase.from("matchup_votes").select("choice"), key).eq("user_id", userId).maybeSingle();

  const [counts, ownVote] = await Promise.all([Promise.all(countQueries), ownVoteQuery]);

  const summary: VoteSummary = { low: 0, high: 0, even: 0, total: 0, myChoice: null };
  VOTE_CHOICES.forEach((choice, index) => {
    const { count, error } = counts[index];
    if (error) throw error;
    // Never happens with count: "exact"; guarded so a missing count cannot pass as 0.
    if (count === null) throw new Error(`matchup_votes: no count returned for "${choice}"`);
    summary[choice] = count;
    summary.total += summary[choice];
  });

  if (ownVote !== null) {
    if (ownVote.error) throw ownVote.error;
    summary.myChoice = (ownVote.data as { choice: VoteChoice } | null)?.choice ?? null;
  }
  return summary;
}

// created_at/updated_at are not sent: the database stamps them itself
// (migration 0005's triggers), so changing your mind just moves the choice.
export async function castVote(
  supabase: SupabaseServerClient,
  userId: string,
  key: MatchupKey,
  choice: VoteChoice
): Promise<MutationResult> {
  const { error } = await supabase.from("matchup_votes").upsert(
    {
      role: key.role,
      champion_low_id: key.championLowId,
      champion_high_id: key.championHighId,
      user_id: userId,
      choice
    } as never,
    { onConflict: "role,champion_low_id,champion_high_id,user_id" }
  );
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

type ReactionRow = { user_id: string; value: ReactionValue };
type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  matchup_comment_votes: ReactionRow[];
};
type PublicProfileRow = { user_id: string; display_name: string };

// Reads throw on a query error (same as load-example.ts): an empty discussion,
// zero scores or everyone shown as a deleted user would all be false, so the
// page's error boundary shows its French error instead.
export async function getComments(
  supabase: SupabaseServerClient,
  key: MatchupKey,
  userId: string | null,
  { limit, offset }: { limit: number; offset: number }
): Promise<{ comments: Comment[]; hasMore: boolean }> {
  // Reactions are embedded (matchup_comment_votes.comment_id's foreign key),
  // so each comment carries all of its own: no separate .in() on a list of
  // ids that could outgrow the URL, and no truncated reaction list. The
  // top-level comments are still capped at PostgREST's max_rows (1000) per
  // matchup, which is acceptable at this scale.
  const { data: commentRows, error: commentsError } = await whereMatchup(
    supabase
      .from("matchup_comments")
      .select("id, body, created_at, updated_at, user_id, matchup_comment_votes(user_id, value)"),
    key
  );
  if (commentsError) throw commentsError;
  const rows = (commentRows ?? []) as CommentRow[];
  if (rows.length === 0) return { comments: [], hasMore: false };

  // Nicknames come from the public_profiles view (migration 0005): profiles
  // itself only lets a user read their own row.
  const authorIds = [...new Set(rows.flatMap((row) => (row.user_id === null ? [] : [row.user_id])))];
  const nicknameByUser = new Map<string, string>();
  if (authorIds.length > 0) {
    const { data: profileRows, error: profilesError } = await supabase
      .from("public_profiles")
      .select("user_id, display_name")
      .in("user_id", authorIds);
    if (profilesError) throw profilesError;
    for (const profile of (profileRows ?? []) as PublicProfileRow[]) {
      nicknameByUser.set(profile.user_id, profile.display_name);
    }
  }

  const comments: Comment[] = rows.map((row) => {
    const rowReactions = row.matchup_comment_votes;
    const forCount = rowReactions.filter((r) => r.value === "for").length;
    const againstCount = rowReactions.filter((r) => r.value === "against").length;
    const mine = userId === null ? undefined : rowReactions.find((r) => r.user_id === userId);

    return {
      id: row.id,
      authorNickname: row.user_id === null ? null : (nicknameByUser.get(row.user_id) ?? null),
      body: row.body,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      edited: row.updated_at !== row.created_at,
      score: forCount - againstCount,
      forCount,
      againstCount,
      myReaction: mine?.value ?? null,
      isMine: userId !== null && row.user_id === userId
    };
  });

  // Score descending, ties broken by recency descending -- see "Deviations
  // from the spec" in the matchup-reviews plan for why this happens here and
  // not in the comment-list component.
  comments.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  const page = comments.slice(offset, offset + limit);
  return { comments: page, hasMore: offset + limit < comments.length };
}

export async function postComment(
  supabase: SupabaseServerClient,
  userId: string,
  key: MatchupKey,
  body: string
): Promise<MutationResult> {
  const trimmed = body.trim();
  if (trimmed.length < COMMENT_MIN || trimmed.length > COMMENT_MAX) {
    return { ok: false, error: `Le commentaire doit faire entre ${COMMENT_MIN} et ${COMMENT_MAX} caractères.` };
  }

  const { error } = await supabase.from("matchup_comments").insert({
    role: key.role,
    champion_low_id: key.championLowId,
    champion_high_id: key.championHighId,
    user_id: userId,
    body: trimmed
  } as never);

  if (error) {
    const message = (error as { message?: string }).message;
    return {
      ok: false,
      error: message === RATE_LIMITED_MESSAGE ? "Vous commentez trop vite. Réessayez dans quelques minutes." : GENERIC_ERROR
    };
  }
  return { ok: true };
}

// updated_at is bumped by the database's update trigger, only when the body
// actually changes; it is not sent from here.
export async function editComment(
  supabase: SupabaseServerClient,
  userId: string,
  commentId: string,
  body: string
): Promise<MutationResult> {
  const trimmed = body.trim();
  if (trimmed.length < COMMENT_MIN || trimmed.length > COMMENT_MAX) {
    return { ok: false, error: `Le commentaire doit faire entre ${COMMENT_MIN} et ${COMMENT_MAX} caractères.` };
  }

  const { data, error } = await supabase
    .from("matchup_comments")
    .update({ body: trimmed } as never)
    .eq("id", commentId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

export async function deleteComment(supabase: SupabaseServerClient, userId: string, commentId: string): Promise<MutationResult> {
  const { data, error } = await supabase
    .from("matchup_comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();

  if (error || !data) return { ok: false, error: GENERIC_ERROR };
  return { ok: true };
}

export async function reactToComment(
  supabase: SupabaseServerClient,
  userId: string,
  commentId: string,
  value: ReactionValue
): Promise<MutationResult> {
  const { error } = await supabase
    .from("matchup_comment_votes")
    .upsert({ comment_id: commentId, user_id: userId, value } as never, { onConflict: "comment_id,user_id" });
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

export async function reportComment(
  supabase: SupabaseServerClient,
  userId: string,
  commentId: string,
  reason: ReportReason
): Promise<MutationResult> {
  const { error } = await supabase
    .from("matchup_comment_reports")
    .insert({ comment_id: commentId, reporter_user_id: userId, reason } as never);

  if (error) {
    return {
      ok: false,
      error: (error as { code?: string }).code === UNIQUE_VIOLATION ? "Vous avez déjà signalé ce commentaire." : GENERIC_ERROR
    };
  }
  return { ok: true };
}
