"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteComment, editComment, reactToComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";
import type { Comment } from "@/lib/matchup/reviews";
import { ReportButton } from "./report-button";

const INITIAL: FormState = { error: null };
// Timestamps are stored in UTC and always shown in the site's audience's own
// time zone, not the reader's device time zone -- otherwise the same comment
// renders a different day server- and client-side (hydration mismatch) and
// two readers in different zones disagree on "when".
const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Paris"
});

type Matchup = { role: string; championLowId: string; championHighId: string };

function ReactionForm({
  matchup,
  commentId,
  value,
  active,
  count
}: {
  matchup: Matchup;
  commentId: string;
  value: "for" | "against";
  active: boolean;
  count: number;
}) {
  const [state, formAction, pending] = useActionState(reactToComment, INITIAL);
  const symbol = value === "for" ? "▲" : "▼";
  const ariaLabel = reactionLabel(value, count);

  return (
    <div className="inline-flex flex-col items-start">
      <form action={formAction} className="inline">
        <input type="hidden" name="role" value={matchup.role} />
        <input type="hidden" name="championLowId" value={matchup.championLowId} />
        <input type="hidden" name="championHighId" value={matchup.championHighId} />
        <input type="hidden" name="commentId" value={commentId} />
        <input type="hidden" name="value" value={value} />
        <button
          type="submit"
          disabled={pending}
          aria-pressed={active}
          aria-label={ariaLabel}
          className={`px-1.5 ${active ? "text-accent" : "text-ink-faint hover:text-ink"}`}
        >
          {symbol} {count}
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}

function reactionLabel(value: "for" | "against", count: number) {
  return value === "for" ? `Pertinent (${count})` : `Pas pertinent (${count})`;
}

function ReactionCount({ value, count }: { value: "for" | "against"; count: number }) {
  return (
    <span className="px-1.5 text-ink-faint">
      <span aria-hidden="true">
        {value === "for" ? "▲" : "▼"} {count}
      </span>
      <span className="sr-only">{reactionLabel(value, count)}</span>
    </span>
  );
}

function DeleteForm({ matchup, commentId }: { matchup: Matchup; commentId: string }) {
  const [state, formAction, pending] = useActionState(deleteComment, INITIAL);
  return (
    <div>
      <form action={formAction}>
        <input type="hidden" name="role" value={matchup.role} />
        <input type="hidden" name="championLowId" value={matchup.championLowId} />
        <input type="hidden" name="championHighId" value={matchup.championHighId} />
        <input type="hidden" name="commentId" value={commentId} />
        <button type="submit" disabled={pending} className="text-xs text-ink-faint hover:text-danger">
          Supprimer
        </button>
      </form>
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
    </div>
  );
}

function EditForm({
  matchup,
  comment,
  onCancel,
  onSaved
}: {
  matchup: Matchup;
  comment: Comment;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [state, formAction, pending] = useActionState(editComment, INITIAL);

  // useActionState's state is still the INITIAL object (by reference) until a
  // submission resolves, so comparing against it is how we tell "the save
  // just succeeded" apart from "the form just mounted" -- firing onSaved on
  // mount would close the form before the user typed anything.
  useEffect(() => {
    if (state !== INITIAL && !state.error) {
      onSaved();
    }
  }, [state, onSaved]);

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="role" value={matchup.role} />
      <input type="hidden" name="championLowId" value={matchup.championLowId} />
      <input type="hidden" name="championHighId" value={matchup.championHighId} />
      <input type="hidden" name="commentId" value={comment.id} />
      <textarea
        name="body"
        defaultValue={comment.body}
        minLength={3}
        maxLength={500}
        required
        autoFocus
        aria-label="Modifier le commentaire"
        className="w-full rounded-md border border-rule bg-surface px-2 py-1 text-sm text-ink"
      />
      {state.error && (
        <p role="alert" className="text-xs text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2 text-xs">
        <button type="submit" disabled={pending} className="text-accent">
          Enregistrer
        </button>
        <button type="button" onClick={onCancel} className="text-ink-faint">
          Annuler
        </button>
      </div>
    </form>
  );
}

export function CommentList({
  comments,
  matchup
}: {
  comments: Comment[];
  matchup: Matchup;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (comments.length === 0) {
    return (
      <p className="text-sm text-ink-muted">
        Aucun commentaire pour l&apos;instant. Soyez le premier à donner votre avis.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {comments.map((comment) => (
        <li key={comment.id} className="rounded-lg border border-rule-soft bg-surface p-3">
          <div className="flex items-center justify-between text-xs text-ink-faint">
            <span>{comment.authorNickname ?? "Utilisateur supprimé"}</span>
            <span>
              {dateFormat.format(new Date(comment.createdAt))}
              {comment.edited && ` · modifié le ${dateFormat.format(new Date(comment.updatedAt))}`}
            </span>
          </div>

          {editingId === comment.id ? (
            <EditForm
              matchup={matchup}
              comment={comment}
              onCancel={() => setEditingId(null)}
              onSaved={() => setEditingId(null)}
            />
          ) : (
            <p data-testid="comment-body" className="mt-1 text-sm text-ink">
              {comment.body}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs">
            {comment.isMine ? (
              // Reacting to one's own comment is refused (the database policy
              // agrees), so the author only reads the score.
              <>
                <ReactionCount value="for" count={comment.forCount} />
                <ReactionCount value="against" count={comment.againstCount} />
              </>
            ) : (
              <>
                <ReactionForm
                  matchup={matchup}
                  commentId={comment.id}
                  value="for"
                  active={comment.myReaction === "for"}
                  count={comment.forCount}
                />
                <ReactionForm
                  matchup={matchup}
                  commentId={comment.id}
                  value="against"
                  active={comment.myReaction === "against"}
                  count={comment.againstCount}
                />
              </>
            )}
            {comment.isMine && editingId !== comment.id && (
              <>
                <button type="button" onClick={() => setEditingId(comment.id)} className="text-ink-faint hover:text-ink">
                  Modifier
                </button>
                <DeleteForm matchup={matchup} commentId={comment.id} />
              </>
            )}
            {!comment.isMine && (
              <ReportButton
                role={matchup.role}
                championLowId={matchup.championLowId}
                championHighId={matchup.championHighId}
                commentId={comment.id}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
