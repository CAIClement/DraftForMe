"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRole } from "@/lib/draft/roles";
import { type MatchupKey, pairSegment } from "@/lib/matchup/key";
import * as reviews from "@/lib/matchup/reviews";
import { createClient } from "@/lib/supabase/server";

// Thin wrappers: read and check the form, require a signed-in, nicknamed
// account, then delegate to src/lib/matchup/reviews.ts, which owns the
// database calls and the French error messages.
export type FormState = { error: string | null };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";
const VOTE_CHOICES: readonly string[] = ["low", "high", "even"] satisfies reviews.VoteChoice[];
const REACTION_VALUES: readonly string[] = ["for", "against"] satisfies reviews.ReactionValue[];
const REPORT_REASONS: readonly string[] = ["spam", "insultant", "hors_sujet", "autre"] satisfies reviews.ReportReason[];

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

// Only a canonical key is accepted (same rule as parsePairSegment): the pair
// must already be sorted, so a matchup is never stored under two keys.
function readMatchupKey(formData: FormData): MatchupKey | null {
  const role = field(formData, "role");
  const championLowId = field(formData, "championLowId");
  const championHighId = field(formData, "championHighId");
  if (!isRole(role) || !championLowId || !championHighId || championLowId >= championHighId) return null;
  return { role, championLowId, championHighId };
}

function matchupPath(key: MatchupKey): Route {
  return `/duel/${key.role}/${pairSegment(key)}` as Route;
}

// Every write on this page needs a signed-in, nicknamed account (the spec's
// "Posting requires a nickname" decision) -- votes and comments alike.
// Returns null when the profile cannot be read: sending the user to choose a
// nickname they already have would be false.
async function requireNicknamedUser(nextPath: Route) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(nextPath)}` as Route);

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return null;
  if (!(profile as { display_name: string | null } | null)?.display_name) {
    redirect(`/compte/pseudo?next=${encodeURIComponent(nextPath)}` as Route);
  }

  return { supabase, userId: user.id };
}

type Session = NonNullable<Awaited<ReturnType<typeof requireNicknamedUser>>>;

// Shared tail of every action: guard, mutate, then refresh the page when the
// change is visible on it.
async function run(
  key: MatchupKey,
  mutate: (session: Session) => Promise<reviews.MutationResult>,
  { revalidate = true } = {}
): Promise<FormState> {
  const path = matchupPath(key);
  const session = await requireNicknamedUser(path);
  if (!session) return { error: GENERIC_ERROR };

  const result = await mutate(session);
  if (!result.ok) return { error: result.error };

  if (revalidate) revalidatePath(path);
  return { error: null };
}

export async function castVote(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const choice = field(formData, "choice");
  if (!key || !VOTE_CHOICES.includes(choice)) return { error: GENERIC_ERROR };

  return run(key, ({ supabase, userId }) =>
    reviews.castVote(supabase, userId, key, choice as reviews.VoteChoice)
  );
}

export async function postComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const body = field(formData, "body");
  if (!key) return { error: GENERIC_ERROR };

  return run(key, ({ supabase, userId }) => reviews.postComment(supabase, userId, key, body));
}

export async function editComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = field(formData, "commentId");
  const body = field(formData, "body");
  if (!key || !commentId) return { error: GENERIC_ERROR };

  return run(key, ({ supabase, userId }) => reviews.editComment(supabase, userId, commentId, body));
}

export async function deleteComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = field(formData, "commentId");
  if (!key || !commentId) return { error: GENERIC_ERROR };

  return run(key, ({ supabase, userId }) => reviews.deleteComment(supabase, userId, commentId));
}

export async function reactToComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = field(formData, "commentId");
  const value = field(formData, "value");
  if (!key || !commentId || !REACTION_VALUES.includes(value)) return { error: GENERIC_ERROR };

  return run(key, ({ supabase, userId }) =>
    reviews.reactToComment(supabase, userId, commentId, value as reviews.ReactionValue)
  );
}

// A report changes nothing on the page (reports are never shown), so it
// does not revalidate it.
export async function reportComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = field(formData, "commentId");
  const reason = field(formData, "reason");
  if (!key || !commentId || !REPORT_REASONS.includes(reason)) return { error: GENERIC_ERROR };

  return run(
    key,
    ({ supabase, userId }) => reviews.reportComment(supabase, userId, commentId, reason as reviews.ReportReason),
    { revalidate: false }
  );
}
