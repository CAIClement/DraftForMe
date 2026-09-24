# DraftForMe Matchup Reviews Design

Date: 2026-09-24

## Summary

Let signed-in players leave a community opinion on a lane matchup (which champion wins, and why) and read others': one vote per account per matchup, a flat discussion of comments, up/downvotes on other people's comments, and a report button. This is the third and last of the three pieces of work announced in the legal-pages and accounts specs. It ships with updates to the privacy policy and terms of use in the same piece of work, as promised in both.

Reviews are read-only input for the player: **they do not feed `src/lib/recommendation/`.** The engine keeps scoring purely from `champion_stats` and `counter_relations`, both sourced from OP.GG. Wiring community votes into the score is a real product change with its own trade-offs (weight, abuse resistance, cold start) and would need its own spec.

## Why

- **The two previous pieces of work exist for this one.** Accounts give reviews an author to attribute a vote to, rate-limit, and moderate. Legal pages already say reviews are coming.
- **The verdict comes first, the discussion second.** Each matchup page leads with the vote (who wins this lane); below it, players discuss the matchup in a flat list of comments. The owner chose an open discussion over one review per account, so volume is capped by a database-side rate limit rather than by the data model.
- **Nothing today identifies "a matchup."** The engine's `counter_relations` table is directional and scoped by role (`champion_id` is beaten by `countered_by_champion_id` in `role`), which is right for scoring but wrong for a community page: "Darius top vs Garen top" is one conversation, not two.

## Decisions

| Question | Decision |
|---|---|
| What a "vote" is | A single choice among three: **this champion wins**, **the other champion wins**, **égalité**. Rejected: a 1-5 difficulty/rating scale (rating what, exactly, is ambiguous without a fixed reference champion, and doesn't map to a simple aggregate; a three-way pick mirrors `counter_relations`' own vocabulary and is one tap) |
| Matchup key | **`role` plus an unordered champion pair**, canonicalized as `champion_low_id < champion_high_id` (lexicographic on `champions.id`, already a stable lowercase slug) so "Darius vs Garen" and "Garen vs Darius" are the same row. A `check` constraint enforces the order; a shared helper (`src/lib/matchup/key.ts`) canonicalizes both ends before every query or write, so the app never has to try both orders. Both champions share `role`: that is what the existing seed data means by "role" on a counter pair (`scripts/build-seed-data.mjs` writes one `counter_relations` row per role from OP.GG's per-role counters list), and it is also the only matchup a viewer of the draft tool can act on directly (their lane) |
| No shared "matchup" table | The three (`role`, `champion_low_id`, `champion_high_id`) columns are repeated on `matchup_votes` and `matchup_comments`, each with its own `check` for the canonical order, instead of a normalizing dimension table. This matches the existing schema's style (`champion_stats`, `matchups`, `builds` each repeat their own composite key rather than sharing one), at the cost of repeating three columns and one check in two tables |
| Where reviews live in the UI | **Confirmed by owner.** A dedicated page per matchup (`/duel/[role]/[a]-vs-[b]`, canonical order in the URL) holding the vote buttons, the comment list and form, and the report button; the draft board's `Verdict` panel gains a small "Avis de la communauté" link next to the counter explanation, pointing at the matchup between the recommended champion and the enemy on the drafting role. Rejected: building the whole review UI inline in the draft board -- that panel already re-renders on every pick, and a form plus a list plus pagination would compete for the space the recommendation itself needs; a dedicated page also gives reviews a permalink, which sharing and moderation both want |
| Comments: one per account per matchup, or open discussion | **Confirmed by owner: open discussion.** An account may post several comments on the same matchup. The list stays **flat**: no replies or threading in v1, which keeps rendering, sorting and moderation simple. A comment is independent of its author's vote (no "voted X" badge), so changing a vote never rewrites what a comment appeared to say. Rejected: one comment per account per matchup (the recommended default, turned down by the owner) |
| Comment length, edit, delete | 3 to 500 characters, plain text (rendered as text, never `dangerouslySetInnerHTML` -- no HTML, no markdown, no links rendered as links). Editable at any time by its author, with a "modifié" marker and the new `updated_at` (a real timestamp, not an invented one). Deletable at any time by its author (hard delete: the row and its comment-votes and reports cascade) |
| Up/downvote on comments and sorting | One reaction per account per comment, `for` or `against`, upsertable (changing your mind moves the vote, it doesn't add a second one) via a unique `(comment_id, user_id)`. Sort: score (`for` minus `against`) descending, ties broken by `created_at` descending. No sort toggle, no pagination beyond a simple "Voir plus" (offset and limit) in v1 |
| Showing vote and reaction numbers vs an invented aggregate | Raw counts are always shown as-is (an exact count is a fact, not an estimate, so the "never show an invented number" rule does not ask to hide it). What is hidden below a threshold is a derived reading of those counts: the matchup page does not show a percentage-style verdict line ("X % pense que ce champion gagne") until the matchup has **at least 5 votes**; below that it shows only the raw counts. A percentage computed from one or two votes reads as false confidence, exactly the kind of misleading number the rule is written against, even though the inputs are real |
| Rate limiting and anti-stuffing | No CAPTCHA or IP throttling in v1. Votes and reactions are capped structurally (one vote per account per matchup, one reaction per account per comment), enforced by Postgres unique constraints and RLS `with check (auth.uid() = user_id)`, the same pattern as `pool_all_own` and `preferences_all_own`. Comments, now that an account may post several, are capped by a **`before insert` trigger on `matchup_comments`**: at most **3 comments per account per matchup in 10 minutes** and **20 per account across the site in 24 hours**; beyond that the insert raises a dedicated error (`errcode 'P0001'`, message `comment_rate_limited`) that the action maps to a French message. The limit lives in the database, not the Server Action, so a client calling Supabase directly with its own session hits it too. The numbers are starting values, not measured ones; they are constants at the top of the trigger function so the owner can tune them in one migration. Multi-accounting (many OAuth logins voting the same way) is an accepted residual risk, the same posture as accounts creation itself at this project's scale -- noted, not solved here |
| Posting requires a nickname | Reuses the accounts spec's stated intent ("Chantier 3 will require a nickname before posting"): a signed-in user with no nickname is redirected to `/compte/pseudo?next=...` from the vote and comment forms, same as `/compte` |
| Reporting flow | A report is `(comment_id, reporter_user_id, reason)`, `reason` one of `spam`, `insultant`, `hors_sujet`, `autre`, unique per `(comment_id, reporter_user_id)` (one report per person per comment). Insert-only for `authenticated` (`with check (auth.uid() = reporter_user_id)`); **no select policy for `anon` or `authenticated`** -- not even the reporter can list reports back, which keeps a reporter's identity from leaking through the API. Rows are read only by the owner, outside RLS, through the Supabase dashboard (the `postgres` role bypasses RLS) |
| Who moderates, and how | **Confirmed by owner: the owner alone, through the Supabase dashboard's table editor or SQL editor** -- the same posture as `delete_my_account()`'s note in the accounts spec ("no service-role key on the server"). No admin flag, no in-app moderation UI, no notification e-mail (a digest needs a sender, rejected here for the same reason magic-link sign-in was rejected in the accounts spec). The owner checks `matchup_comment_reports` manually. A comment is removed with a plain delete; there is no `hidden` column and no soft-hide state, so there is nothing for RLS to filter and no admin-only read policy to write |
| Hide a comment automatically after N reports | **Confirmed by owner: no**, for v1. Auto-hiding on report count is easy to brigade (a handful of accounts silences a comment nobody moderated), and the expected volume is low enough that manual review is realistic. Revisit if abuse actually shows up |
| Votes and comments on account deletion | **Confirmed by owner: votes cascade-delete** (`on delete cascade`, same as `champion_pool_entries`) -- a vote has no value once orphaned, and removing it keeps the aggregate honest. **Comments are anonymized, not deleted** (`user_id` nullable, `on delete set null`, text kept, author shown as "Utilisateur supprimé") -- the comment is the content other players came to read. `delete_my_account()` (migration 0004) needs no change: the new tables' own `on delete cascade`/`set null` foreign keys do the work when `auth.users` loses the row |
| Scoring | **Unchanged.** No table here is read by `src/lib/recommendation/engine.ts` or `counter.ts`; the recommend API and `load-example.ts` keep their identical `champion_stats` and `counter_relations` queries. Wiring votes into scoring is explicitly out of scope and would need its own spec |

## Design

### Migration `0005_matchup_reviews.sql`

- `matchup_votes`: `id uuid pk`, `role text not null`, `champion_low_id text not null references champions(id) on delete cascade`, `champion_high_id text not null references champions(id) on delete cascade`, `user_id uuid not null references auth.users(id) on delete cascade`, `choice text not null check (choice in ('low', 'high', 'even'))` (`choice` names the winner by its canonical slot, not by id, so the row stays meaningful regardless of which champion ended up `low` or `high`), `created_at`, `updated_at`. `check (champion_low_id < champion_high_id)`. `unique (role, champion_low_id, champion_high_id, user_id)`.
- `matchup_comments`: `id uuid pk`, `role text not null`, `champion_low_id text not null references champions(id) on delete cascade`, `champion_high_id text not null references champions(id) on delete cascade`, `user_id uuid references auth.users(id) on delete set null` (nullable: anonymized on account deletion), `body text not null check (char_length(body) between 3 and 500)`, `created_at`, `updated_at`. `check (champion_low_id < champion_high_id)`. No uniqueness on the author: several comments per account per matchup are allowed.
- `enforce_comment_rate_limit()` trigger function, `before insert on matchup_comments`: counts the author's comments on the same matchup in the last 10 minutes and site-wide in the last 24 hours, and raises `comment_rate_limited` (`errcode 'P0001'`) past 3 or 20 respectively. `security definer` with `set search_path = ''`, so the count sees every row regardless of the caller's RLS, same hardening as `delete_my_account()`.
- `matchup_comment_votes`: `id uuid pk`, `comment_id uuid not null references matchup_comments(id) on delete cascade`, `user_id uuid not null references auth.users(id) on delete cascade`, `value text not null check (value in ('for', 'against'))`, `created_at`. `unique (comment_id, user_id)`.
- `matchup_comment_reports`: `id uuid pk`, `comment_id uuid not null references matchup_comments(id) on delete cascade`, `reporter_user_id uuid not null references auth.users(id) on delete cascade`, `reason text not null check (reason in ('spam', 'insultant', 'hors_sujet', 'autre'))`, `created_at`. `unique (comment_id, reporter_user_id)`.
- RLS enabled on all four tables. Policies:
  - `matchup_votes`, `matchup_comment_votes`: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`, plus a `select using (true)` policy so anyone (including `anon`) can read aggregates -- the same shape as `pool_all_own` plus the existing `*_read_all` pattern.
  - `matchup_comments`: `select using (true)`; `insert with check (auth.uid() = user_id)`; `update`/`delete using (auth.uid() = user_id)`. No update or delete path in the app clears `user_id` -- that only happens through the `on delete set null` foreign key when the account itself is gone.
  - `matchup_comment_reports`: `insert with check (auth.uid() = reporter_user_id)` only. No `select` policy at all (nobody but `postgres` can read reports, per the Decisions table above).
- Table privileges: `grant select, insert, update, delete on matchup_votes, matchup_comments, matchup_comment_votes to authenticated;` `grant select on matchup_votes, matchup_comments, matchup_comment_votes to anon;` `grant insert on matchup_comment_reports to authenticated;` (no `select` on reports for anyone but `postgres`, matching migration 0003's grant-plus-RLS pattern).
- Indexes: `matchup_votes_lookup_idx (role, champion_low_id, champion_high_id)`, `matchup_comments_lookup_idx (role, champion_low_id, champion_high_id, created_at desc)`, `matchup_comments_author_idx (user_id, created_at desc)` (serves the rate-limit trigger), `matchup_comment_votes_comment_idx (comment_id)`.

### Files

| File | Responsibility |
|---|---|
| `src/lib/matchup/key.ts` | `matchupKey(championAId, championBId, role)`: canonicalizes to `{ role, championLowId, championHighId }`; pure, unit-tested |
| `src/lib/matchup/reviews.ts` | Server-side helpers: fetch votes and aggregate, fetch comments with the caller's own reaction, cast or change a vote, post/edit/delete a comment, react to a comment, report a comment -- each a thin wrapper around the Supabase server client, mirroring `src/app/compte/actions.ts`'s shape |
| `src/app/duel/[role]/[pair]/page.tsx` | The matchup page: both champions' names and avatars, the vote buttons and aggregate (with the 5-vote threshold), the comment list (sorted, with reactions and a report button per comment), the comment form (nickname-gated) |
| `src/app/duel/[role]/[pair]/actions.ts` | Server Actions: `castVote`, `postComment`, `editComment`, `deleteComment`, `reactToComment`, `reportComment` |
| `src/components/matchup/vote-panel.tsx`, `comment-list.tsx`, `comment-form.tsx`, `report-button.tsx` | Presentational pieces, colour tokens only |
| `src/components/draft/verdict.tsx` | Adds the "Avis de la communauté" link to `/duel/[role]/[pair]`, built from the recommended champion and the enemy on `draftingRole` when both are known |
| `supabase/migrations/0005_matchup_reviews.sql` | See above |
| `src/lib/supabase/types.ts` | Updated for the migration |
| `src/components/legal/privacy-policy.tsx`, `terms-of-use.tsx`, `src/lib/legal/site-info.ts` | Legal updates below |

`[pair]` is a single segment, `<low>-vs-<high>` in canonical order; a non-canonical or unknown pair returns a 404 rather than a redirect, to keep the route simple and the page cacheable per exact URL.

### Legal updates (same piece of work)

- **Privacy policy**, new subsection under "Compte" (or its own "Avis" section): what is stored (vote choice, comment text, reactions, reports, each tied to the account), purpose (publishing community opinions on matchups, and moderation), legal basis (performance of the service for votes and comments; legitimate interest for reports), retention (until the account is deleted or the owner removes the content), and that account deletion anonymizes rather than deletes comment text -- stated plainly, since it is the one place user content outlives the account.
- **"Évolutions à venir"** section is removed or rewritten: this was the last of the three announced pieces of work.
- **Terms of use**, new "Avis et commentaires" section: one vote per matchup per account, and a posting rate limit on comments; comments follow the same rule as nicknames (no impersonation, nothing insulting or hateful -- reuse the wording from the accounts spec's "Compte" section); reviews are not a guarantee (restates the existing "recommendations are decision support" line, so a vote count is never read as certified); reports go to the publisher, who may remove content or accounts that break the rules; content posted under an account is not automatically deleted when the account is (comments are anonymized instead).
- `SITE_INFO.lastUpdated` set to the day this merges.

### Errors

| Case | Behaviour |
|---|---|
| Not signed in, tries to vote, comment, react or report | Redirect to `/connexion?next=...` |
| Signed in, no nickname | Redirect to `/compte/pseudo?next=...` |
| Comment body outside 3-500 characters | The form shows the rule that failed |
| Duplicate vote or reaction (Postgres `23505`) | Treated as an update: the vote or reaction moves |
| Duplicate report (Postgres `23505`) | "Vous avez déjà signalé ce commentaire." |
| Comment rate limit hit (`comment_rate_limited`) | "Vous commentez trop vite. Réessayez dans quelques minutes." The typed text stays in the form |
| Unknown or non-canonical `[pair]` | 404 |
| Editing, deleting or reporting someone else's comment | RLS refuses the write; the action returns a generic French error |
| Supabase unreachable | "Une erreur est survenue. Réessayez plus tard." The matchup page still renders with whatever it already has |

## Testing

Vitest, next to the code, Supabase client mocked where a route or action needs it:

- `matchup/key.test.ts`: canonicalizes either input order to the same result; rejects `a === b`.
- `duel/[role]/[pair]/actions.test.ts`: not signed in, no nickname, valid vote and comment, duplicate vote (becomes an update), a second comment on the same matchup (accepted), the rate-limit error (mapped to its French message, text kept), editing or deleting another user's comment (refused), reacting twice (the second call moves the reaction rather than duplicating it), reporting twice (refused by the unique constraint).
- `vote-panel.test.tsx`: renders counts always; renders the derived percentage line only at 5+ votes, not below.
- `comment-list.test.tsx`: sort order (score descending, then recency); "modifié" marker after an edit; "Utilisateur supprimé" for a `user_id = null` row.
- `verdict.test.tsx`: the community link appears only when both the recommended champion and the direct enemy opponent are known, and points at the canonical `[pair]`.
- Privacy policy and terms tests: the new sections render.
- The migration has no automated test (no SQL test tooling in this project, per the accounts spec's precedent). The plan includes a manual check on a local Supabase: the canonical-order check constraint rejects the reversed pair, uniqueness holds per account, `anon` cannot `select` reports, `authenticated` cannot `select` another account's reports, the 4th comment within 10 minutes on one matchup is refused, and cascade/anonymize behaviour is correct after `delete_my_account()`.

## Scope

- **In:** vote (3-way choice) with a 5-vote threshold before showing a derived percentage, a flat open discussion per matchup (edit and delete, database-side rate limit), up/downvote on comments, report button and reasons, migration 0005, the matchup page and its link from the draft board, privacy policy and terms updates, tests.
- **Out:** wiring votes or comments into `src/lib/recommendation/` scoring (its own spec, explicitly); replies or threading on comments; an in-app moderation UI or admin flag (the owner moderates via the Supabase dashboard); automated hide-after-N-reports; e-mail notifications for reports; a sort toggle and full pagination (a simple "Voir plus" only); CAPTCHA or IP-based rate limiting; a matchup page for pairs that never occur in the same role (nothing generates or links to those); touching the production Supabase project.

## Owner actions (not done by Claude)

- [x] Product decisions confirmed on 2026-09-24: dedicated matchup page, open flat discussion, owner-only moderation via the dashboard with no auto-hide, votes cascade and comments anonymized on account deletion.
- [ ] Check `matchup_comment_reports` in the Supabase dashboard regularly once the feature is live.
- [ ] Apply migration 0005 to production when ready.
- [ ] Re-read the privacy policy's new section against what production actually stores, as the accounts spec's checklist already asks for its own "Compte" section.
- [ ] Everything in the legal pages checklist (`2026-09-23-draftforme-legal-pages-design.md`) before the site goes public, now with no more "upcoming changes" left to add.
