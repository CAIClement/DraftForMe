"use client";

import { useActionState, useState } from "react";
import { deleteComment, editComment, reactToComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";
import type { Comment } from "@/lib/matchup/reviews";
import { ReportButton } from "./report-button";

const INITIAL: FormState = { error: null };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type Matchup = { role: string; championLowId: string; championHighId: string };

function ReactionForm({
  matchup,
  commentId,
  value,
  active,
  label
}: {
  matchup: Matchup;
  commentId: string;
  value: "for" | "against";
  active: boolean;
  label: string;
}) {
  const [, formAction, pending] = useActionState(reactToComment, INITIAL);
  return (
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
        className={`px-1.5 ${active ? "text-accent" : "text-ink-faint hover:text-ink"}`}
      >
        {label}
      </button>
    </form>
  );
}

function DeleteForm({ matchup, commentId }: { matchup: Matchup; commentId: string }) {
  const [, formAction, pending] = useActionState(deleteComment, INITIAL);
  return (
    <form action={formAction}>
      <input type="hidden" name="role" value={matchup.role} />
      <input type="hidden" name="championLowId" value={matchup.championLowId} />
      <input type="hidden" name="championHighId" value={matchup.championHighId} />
      <input type="hidden" name="commentId" value={commentId} />
      <button type="submit" disabled={pending} className="text-xs text-ink-faint hover:text-danger">
        Supprimer
      </button>
    </form>
  );
}

function EditForm({ matchup, comment, onCancel }: { matchup: Matchup; comment: Comment; onCancel: () => void }) {
  const [state, formAction, pending] = useActionState(editComment, INITIAL);
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

// currentUserId is accepted for API symmetry with the rest of the page (every
// other matchup component takes the caller's id) even though CommentList
// itself only needs the already-computed comment.isMine/comment.myReaction.
export function CommentList({
  comments,
  currentUserId,
  matchup
}: {
  comments: Comment[];
  currentUserId: string | null;
  matchup: Matchup;
}) {
  void currentUserId;
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
              {comment.edited && " · modifié"}
            </span>
          </div>

          {editingId === comment.id ? (
            <EditForm matchup={matchup} comment={comment} onCancel={() => setEditingId(null)} />
          ) : (
            <p data-testid="comment-body" className="mt-1 text-sm text-ink">
              {comment.body}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs">
            <ReactionForm
              matchup={matchup}
              commentId={comment.id}
              value="for"
              active={comment.myReaction === "for"}
              label={`▲ ${comment.forCount}`}
            />
            <ReactionForm
              matchup={matchup}
              commentId={comment.id}
              value="against"
              active={comment.myReaction === "against"}
              label={`▼ ${comment.againstCount}`}
            />
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
