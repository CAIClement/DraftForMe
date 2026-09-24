# DraftForMe Accounts Design

Date: 2026-09-24

## Summary

Let players sign in with Discord or Google, choose a public nickname, and delete their account. This is the second of three pieces of work (legal pages, done; accounts, this spec; matchup reviews with votes and comments, next). Accounts on their own add nothing to the draft tool: they exist so the reviews that follow can be tied to a person, rate-limited, and moderated.

The privacy policy and terms of use are updated in the same piece of work, so the site never runs accounts that its legal pages don't describe.

## Why

- **Reviews need authors.** Votes and comments must be attributable to one account each (one vote per matchup, up/downvotes that can't be stuffed), and the terms must be enforceable against someone.
- **Most of the plumbing exists but nothing is wired.** `profiles`, per-user RLS, `src/lib/supabase/server.ts` and `/auth/callback` exist; `/auth/login` is a stub that redirects home and no page offers a sign-in.
- **Opening accounts as the code stands would start a silent collection.** `/api/recommend` inserts every signed-in user's draft into `recommendation_sessions`. No page shows it, and the privacy policy doesn't mention it.

## Decisions

| Question | Decision |
|---|---|
| Sign-in methods | **Discord and Google**, through Supabase Auth OAuth. Rejected: magic link (needs an e-mail sender, throwaway addresses weaken moderation), e-mail + password (resets and verification for no gain) |
| Public identity | **A nickname chosen at first sign-in**: 3 to 20 characters from `[A-Za-z0-9_-]`, unique ignoring case, editable. The provider's name is never shown: Google returns people's real names. Rejected: provider name (exposes real names), Riot ID (unverifiable without the Riot API, so impersonation; possible later as a verified badge) |
| Draft history | **Stop recording it.** Remove the `recommendation_sessions` insert from `/api/recommend`. Nothing displays it, so it would be collection without purpose. The table stays; a future "Mes drafts" feature can bring it back with its own spec |
| Auth library | **Supabase Auth** with `@supabase/ssr`, already a dependency. Rejected: Auth.js (Supabase would not know the user, so RLS stops working), Clerk (external service, possible cost, extra processor, glue to Supabase) |
| Account deletion | A SQL function `delete_my_account()`, `security definer`, deleting only `auth.users` where `id = auth.uid()`; existing `on delete cascade` foreign keys remove `profiles`, `user_preferences`, `champion_pool_entries`. No service-role key on the server |
| Minimum age | 13, as Discord and Google require. Stated in the terms |
| Requested provider scopes | The minimum: Discord `identify email`, Google `openid email`. What Supabase actually stores in `auth.users` (including `raw_user_meta_data`, e.g. the Discord username and avatar URL) is checked on a local instance during implementation, and the privacy policy lists exactly that |
| Scoring | Unchanged. A signed-in user has an empty champion pool (no page writes it), and the engine then receives the same empty list as for a visitor. Nothing in this work adds a pool editor |

## Design

### User flow

1. The header shows **Se connecter**, linking to `/connexion?next=<current path>`.
2. `/connexion` offers **Continuer avec Discord** and **Continuer avec Google**. Each links to `/auth/login?provider=…&next=…`.
3. `/auth/login` accepts only `discord` or `google` (anything else: 400), and starts `signInWithOAuth` with the scopes above and `redirectTo` = `/auth/callback?next=…`.
4. `/auth/callback` exchanges the code for a session. On failure it redirects to `/connexion?erreur=1`. On success it redirects to `/compte/pseudo?next=…` if the user's profile has no nickname, otherwise to `next`.
5. `next` always goes through `safeNextPath()`: only an internal path starting with a single `/` is accepted (not `//host`, not `/\host`, not an absolute URL); anything else becomes `/`. This prevents open redirects.
6. Signed in, the header shows the nickname (or "Choisir un pseudo" while there is none) with **Mon compte** and **Se déconnecter**.
7. `/compte` shows the nickname with an edit form, a sign-out button, and **Supprimer mon compte**, which requires typing the nickname to confirm, then calls `delete_my_account()`, signs out, and redirects home. `/compte` and `/compte/pseudo` redirect to `/connexion?next=…` when signed out.

A user without a nickname can browse normally. Chantier 3 will require a nickname before posting.

### Files

| File | Responsibility |
|---|---|
| `src/middleware.ts` | Refreshes the Supabase session cookie on each request (the standard `@supabase/ssr` middleware); matcher excludes static assets and images. It does not guard routes; pages do |
| `src/lib/auth/nickname.ts` | Nickname rules as a zod schema and a French error message per rule; pure |
| `src/lib/auth/safe-next-path.ts` | `safeNextPath(value: string \| null): string`; pure |
| `src/lib/auth/current-user.ts` | `getCurrentUser()`: `{ id, nickname: string \| null } \| null`, from `auth.getUser()` and `profiles` |
| `src/app/auth/login/route.ts` | Replaces the stub (its current test, which expects a redirect home, is rewritten) |
| `src/app/auth/callback/route.ts` | Adds the error path, the `next` handling and the no-nickname redirect |
| `src/app/connexion/page.tsx` | The two provider buttons and the error message |
| `src/app/compte/page.tsx`, `src/app/compte/pseudo/page.tsx` | Account page and nickname page |
| `src/app/compte/actions.ts` | Server Actions: `saveNickname`, `signOut`, `deleteAccount` |
| `src/components/auth/account-menu.tsx` | The header's signed-out button or signed-in menu |
| `src/components/auth/nickname-form.tsx` | Shared by `/compte/pseudo` and `/compte` |
| `src/components/marketing/site-header.tsx` | Renders `AccountMenu`, which receives the current user from the page or layout (the header stays a presentational component) |
| `supabase/migrations/0004_accounts.sql` | See below |
| `src/lib/supabase/types.ts` | Updated for the migration |
| `src/app/api/recommend/route.ts` | The `recommendation_sessions` insert removed |
| `src/components/legal/privacy-policy.tsx`, `terms-of-use.tsx`, `src/lib/legal/site-info.ts` | Legal updates below |

### Migration `0004_accounts.sql`

- `profiles.display_name`: `check (display_name ~ '^[A-Za-z0-9_-]{3,20}$')` and `create unique index profiles_display_name_lower on public.profiles (lower(display_name))`.
- Drop `profiles.riot_name` and `profiles.riot_tag` (empty today; the Riot ID was rejected above).
- `create function public.delete_my_account() returns void language sql security definer set search_path = '' as $$ delete from auth.users where id = auth.uid(); $$;` then `revoke execute on function public.delete_my_account() from public, anon; grant execute on function public.delete_my_account() to authenticated;`.
- The `profiles` row is created by `saveNickname` through an upsert (the insert and update policies from 0001 already restrict it to the user's own row). No trigger on `auth.users`.

### Legal updates (same piece of work)

- **Privacy policy**, new section "Compte":
  - data: provider identifier, e-mail, nickname, creation and last sign-in dates, plus exactly what Supabase stores from the provider (verified during implementation);
  - purpose: providing the account and, later, attributing reviews;
  - legal basis: performance of the service (GDPR art. 6.1.b);
  - retention: until the account is deleted, which the user can do at any time from `/compte`;
  - Supabase Pte. Ltd. as processor; Discord and Google as identity providers, each with a link to its privacy policy.
- **"Données traitées"** no longer says "no account"; **"Cookies"** now lists the Supabase session cookies, strictly necessary and therefore exempt from consent (CNIL guidelines), set only when you sign in. Still no banner.
- **"Évolutions à venir"** mentions only matchup reviews.
- **Terms of use**, new section "Compte": 13 years minimum; nickname rules (no impersonation, nothing insulting or hateful); the publisher may rename or delete an account that breaks them; the user may delete their account at any time.
- `SITE_INFO.lastUpdated` is set to the day the work merges.

### Errors

| Case | Behaviour |
|---|---|
| OAuth refused or failed | `/connexion?erreur=1`: "La connexion a échoué. Réessayez." |
| Unknown provider on `/auth/login` | 400, no redirect |
| Nickname invalid | The form shows the rule that failed |
| Nickname taken (Postgres `23505`) | "Ce pseudo est déjà pris." |
| Supabase unreachable in an action | "Une erreur est survenue. Réessayez plus tard." Public pages keep working without accounts |
| Delete confirmation doesn't match | The action refuses; nothing is deleted |

## Testing

Vitest, next to the code, with the Supabase client mocked where a route or action needs it:

- `nickname.test.ts`: valid and invalid nicknames (length, characters, spaces, accents).
- `safe-next-path.test.ts`: accepts `/draft`, `/compte?x=1`; rejects `//evil.com`, `/\evil.com`, `https://evil.com`, `javascript:…`, empty and null.
- `auth/login/route.test.ts`: unknown provider → 400; Discord and Google → `signInWithOAuth` called with the right provider, scopes and callback URL.
- `auth/callback/route.test.ts`: exchange failure → `/connexion?erreur=1`; no nickname → `/compte/pseudo`; nickname → `next`; unsafe `next` → `/`.
- `compte/actions.test.ts`: `saveNickname` valid / invalid / taken; `deleteAccount` refuses a wrong confirmation, otherwise calls the RPC then signs out.
- `account-menu.test.tsx`: signed out, signed in without nickname, signed in with nickname.
- `api/recommend/route.test.ts`: a signed-in request does not insert into `recommendation_sessions`.
- Privacy policy and terms tests: the new sections render.
- The migration has no automated test (the project has no SQL test tooling). The plan includes a manual check on a local Supabase: uniqueness ignoring case, the format check, and `delete_my_account()` removing only the caller.

## Scope

- **In:** sign-in with Discord and Google, nickname, account page, sign-out, account deletion, session middleware, migration 0004, removing the draft-history insert, privacy policy and terms updates, tests.
- **Out:** reviews, votes, comments, reporting and moderation tools (chantier 3); a champion pool editor; a Riot ID badge; e-mail sign-in; avatars; any change to scoring; touching the production Supabase project.

## Owner actions (not done by Claude)

- [ ] Create a Discord application (discord.com/developers) and a Google OAuth client (Google Cloud console), with the Supabase callback URL as redirect URI.
- [ ] Enable both providers in the Supabase dashboard with their client IDs and secrets, and add the site's URLs to the allowed redirect URLs **as wildcards** (`http://localhost:3000/**` and the production equivalent): `redirectTo` carries `?next=...`, and a non-matching URL makes Supabase silently fall back to the Site URL.
- [ ] Apply migration 0004 to production when ready.
- [ ] Check the Supabase project's region and accept Supabase's DPA (standard contractual clauses), then add one sentence to the privacy policy's "Compte" section on that transfer, as for Vercel (GDPR art. 13.1.f). Supabase Pte. Ltd. is in Singapore, which has no EU adequacy decision.
- [ ] Check whether Supabase Auth records IP addresses and browsers (`auth.audit_log_entries`, `auth.sessions`); if it does, list them in the "Compte" section.
- [ ] Before the site goes public: everything in the legal pages checklist (`2026-09-23-draftforme-legal-pages-design.md`), plus a re-read of the privacy policy's "Compte" section against what production actually stores.
