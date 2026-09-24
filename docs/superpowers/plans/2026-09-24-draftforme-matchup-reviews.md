# Matchup Reviews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in, nicknamed player vote on who wins a lane matchup (three-way choice, 5-vote threshold before showing a derived percentage) and read/join a flat, rate-limited open discussion with up/downvotes and a report button, on a dedicated `/duel/[role]/[pair]` page linked from the draft board's `Verdict`. Ships with the privacy policy and terms of use updated to match, and closes the "Evolutions a venir" promise from the legal-pages and accounts specs.

**Architecture:** Pure canonicalization in `src/lib/matchup/key.ts` (a matchup is `role` + an unordered champion pair, always sorted). Data access and mutation logic in `src/lib/matchup/reviews.ts` -- plain async functions taking a Supabase client, mirroring `src/app/compte/actions.ts`'s shape but factored out of the `"use server"` boundary so they stay unit-testable and are reused by both the page (reads) and the Server Actions (writes). `src/app/duel/[role]/[pair]/actions.ts` holds the thin `"use server"` wrappers: sign-in and nickname redirects, then delegation into `reviews.ts`, then French error mapping. `src/app/duel/[role]/[pair]/page.tsx` composes the read helpers and the presentational components in `src/components/matchup/`. `src/components/draft/verdict.tsx` gains an optional link built from `matchupHref`, wired from `draft-board.tsx` using the already-existing `directOpponent(draft)` helper.

**Tech Stack:** Next.js 15.5 App Router (typedRoutes on, Server Actions, `useActionState`), React 19, `@supabase/ssr` 0.6, zod 3 (for the two body-length and choice/reason enums, mirroring `src/lib/auth/nickname.ts`'s use of zod), Vitest + Testing Library (jsdom), Tailwind with tokens from `src/app/globals.css`.

**Spec:** `docs/superpowers/specs/2026-09-24-draftforme-matchup-reviews-design.md`

## Deviations from the spec, decided while planning

1. **`matchup_comment_reports` needs an explicit `revoke select`.** Migration `0003_grant_table_privileges.sql` ends with `alter default privileges in schema public grant select on tables to anon, authenticated;`, which applies to every table created afterwards by the same role -- including `matchup_comment_reports`. Left alone, that default privilege would silently hand `anon`/`authenticated` the exact `select` access the "no select policy at all" decision depends on not existing (RLS with zero select policies denies everyone, but only if there is no table-level grant handing out unconditional access). Migration 0005 ends with an explicit `revoke select on public.matchup_comment_reports from anon, authenticated;` so RLS is the only thing deciding who can read a report. Task 2's manual checklist verifies this directly.
2. **`castVote` and `reactToComment` use `upsert`, not `insert`.** The spec's Errors table says a duplicate vote or reaction "is treated as an update: the vote or reaction moves." Rather than insert-then-catch-23505-then-update, both call Supabase `.upsert(..., { onConflict: "<unique columns>" })` against the tables' own unique constraints, so changing your mind is one round trip and there is no 23505 path to handle for these two.
3. **Sorting comments (score descending, then `created_at` descending) happens in `reviews.ts`'s `getComments`, before pagination is applied**, not in the `comment-list.tsx` component -- pagination (`offset`/`limit`) has to slice the *sorted* list to make "Voir plus" mean anything. `comment-list.test.tsx` therefore checks that the component preserves the order of the array it is given (it must not reverse or reshuffle it), while `reviews.test.ts` is what actually proves the score-then-recency ordering.
4. **"Voir plus" is a plain link with an `offset` search param on the matchup page, not client-side fetching.** `src/app/duel/[role]/[pair]/page.tsx` reads `searchParams.offset`, asks `getComments` for that page, and renders a `<Link href=".../?offset=20">Voir plus</Link>` when `hasMore` is true. No new client component, no extra request/loading state to test -- consistent with the spec's "no pagination beyond a simple Voir plus".
5. **The matchup page uses the server Supabase client (`createClient()`) throughout, not `createPublicClient()`.** Every render needs the caller's own vote, own reactions and nickname-gating, so the page is unavoidably per-user and dynamic; splitting champion/vote reads onto the anonymous cacheable client (the way `load-example.ts` does) would buy nothing here and would add a second client to reason about.
6. **`src/lib/matchup/reviews.ts` gets its own test file (`reviews.test.ts`), separate from `duel/[role]/[pair]/actions.test.ts`.** The spec's Testing section names only `actions.test.ts`, but splitting mirrors the accounts plan's own precedent (`nickname.ts` tested standalone, then `compte/actions.ts` tested separately for the redirect/guard wiring) and keeps each commit smaller and each test file focused: `reviews.test.ts` owns the database-shaped assertions (upsert-not-insert, sorting, rate-limit error mapping, RLS-refusal-returns-generic-error), `actions.test.ts` owns the sign-in/nickname redirect guard and delegation.

## Conventions every task follows

- Code, comments, identifiers, commits in English; every user-facing string in French, true, and never inventing a number (raw counts always shown; a derived percentage only at 5+ votes, per the spec's Decisions table).
- Colours only through Tailwind token names already in `tailwind.config.ts` (`text-ink`, `text-ink-muted`, `text-ink-faint`, `bg-surface`, `bg-surface-sunk`, `border-rule`, `border-rule-soft`, `text-accent`, `bg-accent`, `text-on-accent`, `text-danger`, `border-danger`). Never hex, `rgb()`, `text-white`, `bg-stone-*`. No new token is needed for this piece of work.
- typedRoutes is on: a dynamic `href` needs `as Route` (`import type { Route } from "next"`).
- `src/lib/recommendation/` is never touched: no table this plan creates is read by `engine.ts` or `counter.ts`, and no task below changes the recommend API's or `load-example.ts`'s queries.
- Checks: `npx vitest run --exclude "**/.claude/**" <paths>` (a sibling git worktree under `.claude/worktrees/` duplicates tests and fails there -- see `git worktree list` before assuming this checkout's `main` is current), `npx next typegen && npx tsc --noEmit`, and `npm run lint`.
- Commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`. `git add` explicit paths; quote paths containing brackets or parentheses (`"src/app/duel/[role]/[pair]/actions.ts"`).
- Branch from `main`, never commit on `main`; small commits, one per task.
- Never touch the production Supabase project, never push, never run anything against the Riot API. `ml.win.test`'s `test_report.json` is untouched -- nothing here is under `ml/`.

## File map

| File | Status | Task |
|---|---|---|
| `src/lib/matchup/key.ts` (+ test) | Create | 1 |
| `supabase/migrations/0005_matchup_reviews.sql` | Create | 2 |
| `src/lib/supabase/types.ts` | Modify: add 4 tables | 2 |
| `src/lib/matchup/reviews.ts` (+ test) | Create | 3 |
| `src/app/duel/[role]/[pair]/actions.ts` (+ test) | Create | 4 |
| `src/components/matchup/vote-panel.tsx` (+ test) | Create | 5 |
| `src/components/matchup/comment-list.tsx` (+ test), `report-button.tsx` (+ test) | Create | 6 |
| `src/components/matchup/comment-form.tsx` (+ test) | Create | 7 |
| `src/app/duel/[role]/[pair]/page.tsx` | Create | 8 |
| `src/components/draft/verdict.tsx` (+ test), `src/components/draft/draft-board.tsx` | Modify | 9 |
| `src/components/legal/privacy-policy.tsx` (+ test), `terms-of-use.tsx` (+ test), `src/lib/legal/site-info.ts` | Modify | 10 |
| -- (manual, controller only) | -- | 11 |
| -- (verification, controller only) | -- | 12 |

---

### Task 1: Matchup key -- pure canonicalization

**Files:**
- Create: `src/lib/matchup/key.ts`, `src/lib/matchup/key.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/lib/matchup/key.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchupHref, matchupKey, pairSegment, parsePairSegment } from "./key";

describe("matchupKey", () => {
  it("canonicalizes either input order to the same result", () => {
    const fromGarenFirst = matchupKey("garen", "darius", "top");
    const fromDariusFirst = matchupKey("darius", "garen", "top");

    expect(fromGarenFirst).toEqual({ role: "top", championLowId: "darius", championHighId: "garen" });
    expect(fromDariusFirst).toEqual(fromGarenFirst);
  });

  it("rejects a champion matched against itself", () => {
    expect(() => matchupKey("darius", "darius", "top")).toThrow(/two different champions/);
  });
});

describe("pairSegment / parsePairSegment", () => {
  it("round-trips a canonical pair", () => {
    const key = matchupKey("garen", "darius", "top");
    expect(pairSegment(key)).toBe("darius-vs-garen");
    expect(parsePairSegment(pairSegment(key))).toEqual({ championLowId: "darius", championHighId: "garen" });
  });

  it("rejects a reversed (non-canonical) segment", () => {
    expect(parsePairSegment("garen-vs-darius")).toBeNull();
  });

  it.each(["darius", "darius-vs-garen-vs-katarina", "-vs-garen", "darius-vs-"])(
    "rejects the malformed segment %s",
    (segment) => {
      expect(parsePairSegment(segment)).toBeNull();
    }
  );
});

describe("matchupHref", () => {
  it("builds the canonical duel URL regardless of input order", () => {
    expect(matchupHref("garen", "darius", "top")).toBe("/duel/top/darius-vs-garen");
    expect(matchupHref("darius", "garen", "top")).toBe("/duel/top/darius-vs-garen");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/matchup`
Expected: FAIL, cannot resolve `./key`.

- [ ] **Step 3: Implement**

`src/lib/matchup/key.ts`:

```ts
import type { Route } from "next";
import type { Role } from "@/lib/draft/roles";

// A "matchup" is role plus an unordered champion pair. Canonicalized here so
// the app never has to try both orders: "Darius vs Garen" and "Garen vs
// Darius" are the same row, the same URL, the same everything.
export type MatchupKey = { role: Role; championLowId: string; championHighId: string };

export function matchupKey(championAId: string, championBId: string, role: Role): MatchupKey {
  if (championAId === championBId) {
    throw new Error("A matchup needs two different champions.");
  }

  const [championLowId, championHighId] = [championAId, championBId].sort();
  return { role, championLowId, championHighId };
}

// champions.id has no hyphens (scripts/build-seed-data.mjs strips apostrophes,
// dots and spaces but champion ids never contained one to begin with), so
// "-vs-" is an unambiguous separator.
export function pairSegment(key: Pick<MatchupKey, "championLowId" | "championHighId">): string {
  return `${key.championLowId}-vs-${key.championHighId}`;
}

// Returns null for anything that is not exactly two non-empty ids already in
// canonical order -- including the reversed pair, which the page treats as
// unknown (404) rather than redirecting, per the design's "keep the route
// simple and the page cacheable per exact URL".
export function parsePairSegment(segment: string): { championLowId: string; championHighId: string } | null {
  const parts = segment.split("-vs-");
  if (parts.length !== 2) return null;

  const [championLowId, championHighId] = parts;
  if (!championLowId || !championHighId || championLowId >= championHighId) return null;

  return { championLowId, championHighId };
}

export function matchupHref(championAId: string, championBId: string, role: Role): Route {
  const key = matchupKey(championAId, championBId, role);
  return `/duel/${key.role}/${pairSegment(key)}` as Route;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/matchup`
Expected: PASS, 8 tests.

- [ ] **Step 5: Typecheck and commit**

Run: `npx next typegen && npx tsc --noEmit` -- Expected: no errors.

```bash
git add src/lib/matchup/key.ts src/lib/matchup/key.test.ts
git commit -m "feat: add the matchup key canonicalization helpers"
```

---

### Task 2: Migration 0005 and database types

**Files:**
- Create: `supabase/migrations/0005_matchup_reviews.sql`
- Modify: `src/lib/supabase/types.ts`

No dependency on Task 1's code, but Task 3 needs the types this task adds.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0005_matchup_reviews.sql`:

```sql
-- Matchup reviews: a community vote and open discussion per (role, champion
-- pair). See docs/superpowers/specs/2026-09-24-draftforme-matchup-reviews-design.md.
-- Never read by src/lib/recommendation/: wiring votes or comments into
-- scoring is out of scope and would need its own spec.

create table public.matchup_votes (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  champion_low_id text not null references public.champions(id) on delete cascade,
  champion_high_id text not null references public.champions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Names the winner by its canonical slot, not by champion id, so the row
  -- stays meaningful regardless of which champion ended up low or high.
  choice text not null check (choice in ('low', 'high', 'even')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (champion_low_id < champion_high_id),
  unique (role, champion_low_id, champion_high_id, user_id)
);
```

```sql
create table public.matchup_comments (
  id uuid primary key default gen_random_uuid(),
  role text not null,
  champion_low_id text not null references public.champions(id) on delete cascade,
  champion_high_id text not null references public.champions(id) on delete cascade,
  -- Nullable: anonymized (not deleted) when the author's account is deleted --
  -- the comment is the content other players came to read, per the spec's
  -- "Votes and comments on account deletion" decision.
  user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (champion_low_id < champion_high_id)
  -- No uniqueness on the author: an open discussion allows several comments
  -- per account per matchup (owner's decision, see the spec).
);

-- Caps posting structurally rather than in the Server Action, so a client
-- calling Supabase directly with its own session hits it too: at most 3
-- comments per account per matchup in 10 minutes, and 20 per account across
-- the site in 24 hours. security definer + empty search_path so the count
-- sees every row regardless of the caller's RLS, same hardening as
-- delete_my_account() in 0004. The two limits are starting values, kept as
-- literals here (not a table) so the owner can tune them in one migration.
create function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  same_matchup_count int;
  site_wide_count int;
begin
  select count(*) into same_matchup_count
  from public.matchup_comments
  where user_id = new.user_id
    and role = new.role
    and champion_low_id = new.champion_low_id
    and champion_high_id = new.champion_high_id
    and created_at > now() - interval '10 minutes';

  if same_matchup_count >= 3 then
    raise exception 'comment_rate_limited' using errcode = 'P0001';
  end if;
```

```sql
  select count(*) into site_wide_count
  from public.matchup_comments
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';

  if site_wide_count >= 20 then
    raise exception 'comment_rate_limited' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger matchup_comments_rate_limit
  before insert on public.matchup_comments
  for each row execute function public.enforce_comment_rate_limit();

create table public.matchup_comment_votes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.matchup_comments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value text not null check (value in ('for', 'against')),
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);

create table public.matchup_comment_reports (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.matchup_comments(id) on delete cascade,
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'insultant', 'hors_sujet', 'autre')),
  created_at timestamptz not null default now(),
  unique (comment_id, reporter_user_id)
);

alter table public.matchup_votes enable row level security;
alter table public.matchup_comments enable row level security;
alter table public.matchup_comment_votes enable row level security;
alter table public.matchup_comment_reports enable row level security;
```

```sql
create policy "matchup_votes_read_all" on public.matchup_votes for select using (true);
create policy "matchup_votes_all_own" on public.matchup_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "matchup_comments_read_all" on public.matchup_comments for select using (true);
create policy "matchup_comments_insert_own" on public.matchup_comments for insert with check (auth.uid() = user_id);
create policy "matchup_comments_update_own" on public.matchup_comments for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "matchup_comments_delete_own" on public.matchup_comments for delete using (auth.uid() = user_id);
-- No policy clears user_id: that only happens through the on delete set null
-- foreign key when the account itself is gone.

create policy "matchup_comment_votes_read_all" on public.matchup_comment_votes for select using (true);
create policy "matchup_comment_votes_all_own" on public.matchup_comment_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Insert-only, and on purpose no select policy at all: not even the reporter
-- can list reports back, which keeps a reporter's identity from leaking
-- through the API. Rows are read by the owner alone, outside RLS, through the
-- Supabase dashboard's postgres role.
create policy "matchup_comment_reports_insert_own" on public.matchup_comment_reports for insert with check (auth.uid() = reporter_user_id);

grant select, insert, update, delete on public.matchup_votes to authenticated;
grant select on public.matchup_votes to anon;
grant select, insert, update, delete on public.matchup_comments to authenticated;
grant select on public.matchup_comments to anon;
grant select, insert, update, delete on public.matchup_comment_votes to authenticated;
grant select on public.matchup_comment_votes to anon;
grant insert on public.matchup_comment_reports to authenticated;
```

```sql
-- 0003 ends with `alter default privileges in schema public grant select on
-- tables to anon, authenticated`, which applies to every table created
-- afterwards by the same role -- including this one. Left alone it would
-- silently hand anon/authenticated the exact select access the "no select
-- policy at all" decision above depends on not existing. Revoked explicitly
-- so RLS (zero select policies, so nobody but postgres) is what decides.
revoke select on public.matchup_comment_reports from anon, authenticated;

create index matchup_votes_lookup_idx on public.matchup_votes (role, champion_low_id, champion_high_id);
create index matchup_comments_lookup_idx on public.matchup_comments (role, champion_low_id, champion_high_id, created_at desc);
create index matchup_comments_author_idx on public.matchup_comments (user_id, created_at desc);
create index matchup_comment_votes_comment_idx on public.matchup_comment_votes (comment_id);
```

- [ ] **Step 2: Add the types**

In `src/lib/supabase/types.ts`, add these four entries inside `Tables`, after `recommendation_sessions`:

```ts
      matchup_votes: TableDefinition<
        {
          id: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string;
          choice: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string;
          choice: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          id: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string;
          choice: string;
          created_at: string;
          updated_at: string;
        }>
      >;
```

```ts
      matchup_comments: TableDefinition<
        {
          id: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        },
        Partial<{
          id: string;
          role: string;
          champion_low_id: string;
          champion_high_id: string;
          user_id: string | null;
          body: string;
          created_at: string;
          updated_at: string;
        }>
      >;
      matchup_comment_votes: TableDefinition<
        { id: string; comment_id: string; user_id: string; value: string; created_at: string },
        { id?: string; comment_id: string; user_id: string; value: string; created_at?: string },
        Partial<{ id: string; comment_id: string; user_id: string; value: string; created_at: string }>
      >;
      matchup_comment_reports: TableDefinition<
        { id: string; comment_id: string; reporter_user_id: string; reason: string; created_at: string },
        { id?: string; comment_id: string; reporter_user_id: string; reason: string; created_at?: string },
        Partial<{ id: string; comment_id: string; reporter_user_id: string; reason: string; created_at: string }>
      >;
```

- [ ] **Step 3: Typecheck**

Run: `npx next typegen && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0005_matchup_reviews.sql src/lib/supabase/types.ts
git commit -m "feat: add the matchup reviews migration (votes, comments, reactions, reports)"
```

(The migration is checked against a real local database in Task 11.)

---

### Task 3: Server-side review helpers

**Files:**
- Create: `src/lib/matchup/reviews.ts`, `src/lib/matchup/reviews.test.ts`

Depends on Task 1 (`MatchupKey`) and Task 2 (types). Runs against a Supabase client mock, same `then`-resolving query-builder pattern as `src/app/api/recommend/route.test.ts`'s `makeQuery`.

- [ ] **Step 1: Write the failing tests**

`src/lib/matchup/reviews.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import {
  castVote,
  deleteComment,
  editComment,
  getComments,
  getVoteSummary,
  postComment,
  reactToComment,
  reportComment
} from "./reviews";
import type { MatchupKey } from "./key";

const KEY: MatchupKey = { role: "top", championLowId: "darius", championHighId: "garen" };

// A minimal thenable query builder: every chained call returns itself, and
// awaiting it resolves to the fixture. Mirrors the pattern already used in
// src/app/api/recommend/route.test.ts's makeQuery.
function query(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: chain,
    eq: chain,
    in: chain,
    order: chain,
    upsert: vi.fn(chain),
    insert: vi.fn(chain),
    update: vi.fn(chain),
    delete: vi.fn(chain),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: (value: typeof result) => void) => resolve(result)
  });
  return builder;
}

function stub(byTable: Record<string, ReturnType<typeof query>>) {
  return { from: (table: string) => byTable[table] ?? query({ data: null, error: null }) } as never;
}
```

```ts
describe("getVoteSummary", () => {
  it("counts each choice and reports the caller's own vote", async () => {
    const supabase = stub({
      matchup_votes: query({
        data: [
          { choice: "low", user_id: "user-1" },
          { choice: "low", user_id: "user-2" },
          { choice: "high", user_id: "user-3" },
          { choice: "even", user_id: "user-4" }
        ],
        error: null
      })
    });

    expect(await getVoteSummary(supabase, KEY, "user-1")).toEqual({
      low: 2,
      high: 1,
      even: 1,
      total: 4,
      myChoice: "low"
    });
  });

  it("has no opinion for a signed-out or non-voting caller", async () => {
    const supabase = stub({ matchup_votes: query({ data: [{ choice: "low", user_id: "user-2" }], error: null }) });
    expect((await getVoteSummary(supabase, KEY, null)).myChoice).toBeNull();
    expect((await getVoteSummary(supabase, KEY, "user-1")).myChoice).toBeNull();
  });
});

describe("castVote", () => {
  it("upserts on the matchup's own unique columns rather than inserting", async () => {
    const votes = query({ data: null, error: null });
    const supabase = stub({ matchup_votes: votes });

    expect(await castVote(supabase, "user-1", KEY, "low")).toEqual({ ok: true });
    expect(votes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "top", champion_low_id: "darius", champion_high_id: "garen", user_id: "user-1", choice: "low" }),
      { onConflict: "role,champion_low_id,champion_high_id,user_id" }
    );
  });
});
```

```ts
describe("getComments", () => {
  function comment(overrides: Record<string, unknown>) {
    return {
      id: "c1",
      body: "body",
      created_at: "2026-09-01T00:00:00Z",
      updated_at: "2026-09-01T00:00:00Z",
      user_id: "user-1",
      profiles: { display_name: "Faker" },
      ...overrides
    };
  }

  it("sorts by score descending, then recency descending, before paginating", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [
          comment({ id: "old-low-score", created_at: "2026-09-01T00:00:00Z" }),
          comment({ id: "new-high-score", created_at: "2026-09-03T00:00:00Z" }),
          comment({ id: "new-no-score", created_at: "2026-09-02T00:00:00Z" })
        ],
        error: null
      }),
      matchup_comment_votes: query({
        data: [
          { comment_id: "new-high-score", user_id: "user-9", value: "for" },
          { comment_id: "new-high-score", user_id: "user-8", value: "for" },
          { comment_id: "old-low-score", user_id: "user-9", value: "against" }
        ],
        error: null
      })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments.map((c) => c.id)).toEqual(["new-high-score", "new-no-score", "old-low-score"]);
  });
```

```ts
  it("shows Utilisateur supprimé when the author is anonymized", async () => {
    const supabase = stub({
      matchup_comments: query({ data: [comment({ user_id: null, profiles: null })], error: null }),
      matchup_comment_votes: query({ data: [], error: null })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].authorNickname).toBeNull();
  });

  it("marks a comment edited once updated_at moves past created_at", async () => {
    const supabase = stub({
      matchup_comments: query({
        data: [comment({ created_at: "2026-09-01T00:00:00Z", updated_at: "2026-09-02T00:00:00Z" })],
        error: null
      }),
      matchup_comment_votes: query({ data: [], error: null })
    });

    const { comments } = await getComments(supabase, KEY, null, { limit: 20, offset: 0 });
    expect(comments[0].edited).toBe(true);
  });
});
```

```ts
describe("postComment", () => {
  it("rejects a body outside 3-500 characters without touching the database", async () => {
    const comments = query({ data: null, error: null });
    const supabase = stub({ matchup_comments: comments });

    expect(await postComment(supabase, "user-1", KEY, "ab")).toEqual({
      ok: false,
      error: "Le commentaire doit faire entre 3 et 500 caractères."
    });
    expect(comments.insert).not.toHaveBeenCalled();
  });

  it("maps the rate-limit trigger's error to its French message", async () => {
    const supabase = stub({
      matchup_comments: query({ data: null, error: { message: "comment_rate_limited" } })
    });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({
      ok: false,
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
    });
  });

  it("inserts a valid comment", async () => {
    const comments = query({ data: null, error: null });
    const supabase = stub({ matchup_comments: comments });

    expect(await postComment(supabase, "user-1", KEY, "Un avis tout à fait valable.")).toEqual({ ok: true });
    expect(comments.insert).toHaveBeenCalledWith(
      expect.objectContaining({ role: "top", champion_low_id: "darius", champion_high_id: "garen", user_id: "user-1" })
    );
  });
});
```

```ts
describe("editComment / deleteComment", () => {
  it("reports a generic error when RLS refuses (no matching row for this user)", async () => {
    const supabase = stub({ matchup_comments: query({ data: null, error: null }) });
    expect(await editComment(supabase, "user-1", "someone-elses-comment", "New text.")).toEqual({
      ok: false,
      error: "Une erreur est survenue. Réessayez plus tard."
    });
    expect(await deleteComment(supabase, "user-1", "someone-elses-comment")).toEqual({
      ok: false,
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });

  it("succeeds when the row belongs to the caller", async () => {
    const supabase = stub({ matchup_comments: query({ data: { id: "c1" }, error: null }) });
    expect(await editComment(supabase, "user-1", "c1", "New text.")).toEqual({ ok: true });
    expect(await deleteComment(supabase, "user-1", "c1")).toEqual({ ok: true });
  });
});

describe("reactToComment", () => {
  it("upserts on (comment_id, user_id) rather than inserting", async () => {
    const votes = query({ data: null, error: null });
    const supabase = stub({ matchup_comment_votes: votes });

    expect(await reactToComment(supabase, "user-1", "c1", "for")).toEqual({ ok: true });
    expect(votes.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ comment_id: "c1", user_id: "user-1", value: "for" }),
      { onConflict: "comment_id,user_id" }
    );
  });
});
```

```ts
describe("reportComment", () => {
  it("refuses a duplicate report", async () => {
    const supabase = stub({ matchup_comment_reports: query({ data: null, error: { code: "23505" } }) });
    expect(await reportComment(supabase, "user-1", "c1", "spam")).toEqual({
      ok: false,
      error: "Vous avez déjà signalé ce commentaire."
    });
  });

  it("accepts a new report", async () => {
    const supabase = stub({ matchup_comment_reports: query({ data: null, error: null }) });
    expect(await reportComment(supabase, "user-1", "c1", "spam")).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/matchup/reviews.test.ts`
Expected: FAIL, cannot resolve `./reviews`.

- [ ] **Step 3: Implement**

`src/lib/matchup/reviews.ts`:

```ts
import type { createClient } from "@/lib/supabase/server";
import type { MatchupKey } from "./key";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type VoteChoice = "low" | "high" | "even";
export type VoteSummary = { low: number; high: number; even: number; total: number; myChoice: VoteChoice | null };

export type ReactionValue = "for" | "against";
export type ReportReason = "spam" | "insultant" | "hors_sujet" | "autre";
```

```ts
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

export async function getVoteSummary(
  supabase: SupabaseServerClient,
  key: MatchupKey,
  userId: string | null
): Promise<VoteSummary> {
  const { data } = await whereMatchup(supabase.from("matchup_votes").select("choice, user_id"), key);
  const rows = (data ?? []) as { choice: VoteChoice; user_id: string }[];

  const summary = { low: 0, high: 0, even: 0, total: 0, myChoice: null as VoteChoice | null };
  for (const row of rows) {
    summary[row.choice] += 1;
    summary.total += 1;
    if (userId !== null && row.user_id === userId) summary.myChoice = row.choice;
  }
  return summary;
}
```

```ts
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
      choice,
      updated_at: new Date().toISOString()
    } as never,
    { onConflict: "role,champion_low_id,champion_high_id,user_id" }
  );
  return error ? { ok: false, error: GENERIC_ERROR } : { ok: true };
}

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  updated_at: string;
  user_id: string | null;
  profiles: { display_name: string | null } | null;
};
type ReactionRow = { comment_id: string; user_id: string; value: ReactionValue };
```

```ts
export async function getComments(
  supabase: SupabaseServerClient,
  key: MatchupKey,
  userId: string | null,
  { limit, offset }: { limit: number; offset: number }
): Promise<{ comments: Comment[]; hasMore: boolean }> {
  const { data: commentRows } = await whereMatchup(
    supabase.from("matchup_comments").select("id, body, created_at, updated_at, user_id, profiles(display_name)"),
    key
  );
  const rows = (commentRows ?? []) as unknown as CommentRow[];

  const { data: reactionRows } = await supabase
    .from("matchup_comment_votes")
    .select("comment_id, user_id, value")
    .in("comment_id", rows.map((row) => row.id));
  const reactions = (reactionRows ?? []) as ReactionRow[];

  const reactionsByComment = new Map<string, ReactionRow[]>();
  for (const reaction of reactions) {
    const list = reactionsByComment.get(reaction.comment_id) ?? [];
    list.push(reaction);
    reactionsByComment.set(reaction.comment_id, list);
  }
```

```ts
  const comments: Comment[] = rows.map((row) => {
    const rowReactions = reactionsByComment.get(row.id) ?? [];
    const forCount = rowReactions.filter((r) => r.value === "for").length;
    const againstCount = rowReactions.filter((r) => r.value === "against").length;
    const mine = userId === null ? undefined : rowReactions.find((r) => r.user_id === userId);

    return {
      id: row.id,
      authorNickname: row.user_id === null ? null : (row.profiles?.display_name ?? null),
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
  // from the spec" in this plan for why this happens here and not in the
  // comment-list component.
  comments.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));

  const page = comments.slice(offset, offset + limit);
  return { comments: page, hasMore: offset + limit < comments.length };
}
```

```ts
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
```

```ts
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
    .update({ body: trimmed, updated_at: new Date().toISOString() } as never)
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
```

```ts
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
```

Note: the mock's `maybeSingle` in the test file resolves the same fixture regardless of the preceding chain, which is enough to exercise both branches (`data` present vs `null`) across the two `describe` blocks that need it.

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/lib/matchup/reviews.test.ts`
Expected: PASS. If the "inserts a valid comment" test and the "rejects a body outside 3-500" test interfere with each other's `insert` mock call count, double-check each `describe` builds its own `query(...)` instance (it does, per-test) rather than sharing one.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` -- Expected: no errors. If `supabase.from(...).upsert(...)` or `.insert(...)` fail to typecheck against the hand-written `Database` type, cast the payload `as never` at the call site (same workaround `compte/actions.ts` uses), keeping the tests unchanged.

```bash
git add src/lib/matchup/reviews.ts src/lib/matchup/reviews.test.ts
git commit -m "feat: add the matchup review data helpers (votes, comments, reactions, reports)"
```

---

### Task 4: Server Actions for the matchup page

**Files:**
- Create: `src/app/duel/[role]/[pair]/actions.ts`, `src/app/duel/[role]/[pair]/actions.test.ts`

Depends on Task 3.

- [ ] **Step 1: Write the failing tests**

`src/app/duel/[role]/[pair]/actions.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  })
}));

const reviews = vi.hoisted(() => ({
  castVote: vi.fn(),
  postComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  reactToComment: vi.fn(),
  reportComment: vi.fn()
}));
vi.mock("@/lib/matchup/reviews", () => reviews);

import { createClient } from "@/lib/supabase/server";
import {
  castVote,
  deleteComment,
  editComment,
  postComment,
  reactToComment,
  reportComment
} from "./actions";
```

```ts
function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const MATCHUP_FIELDS = { role: "top", championLowId: "darius", championHighId: "garen" };

function stubSupabase({
  user = { id: "user-1" } as { id: string } | null,
  displayName = "Faker" as string | null
} = {}) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: displayName === null ? null : { display_name: displayName }, error: null });
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }))
  } as never);
}

describe("castVote", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    Object.values(reviews).forEach((fn) => fn.mockReset());
  });

  it("sends a signed-out visitor to the sign-in page", async () => {
    stubSupabase({ user: null });
    await expect(castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).rejects.toThrow(
      "REDIRECT:/connexion?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
    expect(reviews.castVote).not.toHaveBeenCalled();
  });
```

```ts
  it("sends a nickname-less user to choose one first", async () => {
    stubSupabase({ displayName: null });
    await expect(castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).rejects.toThrow(
      "REDIRECT:/compte/pseudo?next=%2Fduel%2Ftop%2Fdarius-vs-garen"
    );
    expect(reviews.castVote).not.toHaveBeenCalled();
  });

  it("casts the vote and revalidates the matchup page", async () => {
    stubSupabase();
    reviews.castVote.mockResolvedValue({ ok: true });

    expect(await castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).toEqual({ error: null });
    expect(reviews.castVote).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      { role: "top", championLowId: "darius", championHighId: "garen" },
      "low"
    );
  });

  it("relays the helper's error", async () => {
    stubSupabase();
    reviews.castVote.mockResolvedValue({ ok: false, error: "Une erreur est survenue. Réessayez plus tard." });

    expect(await castVote({ error: null }, form({ ...MATCHUP_FIELDS, choice: "low" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });
});
```

```ts
describe("postComment", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    Object.values(reviews).forEach((fn) => fn.mockReset());
  });

  it("posts a comment for a signed-in, nicknamed user", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValue({ ok: true });

    expect(await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Un avis." }))).toEqual({ error: null });
    expect(reviews.postComment).toHaveBeenCalledWith(expect.anything(), "user-1", MATCHUP_FIELDS, "Un avis.");
  });

  it("keeps the rate-limit message from the helper", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValue({ ok: false, error: "Vous commentez trop vite. Réessayez dans quelques minutes." });

    expect(await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Un avis." }))).toEqual({
      error: "Vous commentez trop vite. Réessayez dans quelques minutes."
    });
  });

  it("allows a second comment on the same matchup (open discussion)", async () => {
    stubSupabase();
    reviews.postComment.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Premier avis." }));
    await postComment({ error: null }, form({ ...MATCHUP_FIELDS, body: "Deuxième avis." }));

    expect(reviews.postComment).toHaveBeenCalledTimes(2);
  });
});
```

```ts
describe("editComment / deleteComment", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    Object.values(reviews).forEach((fn) => fn.mockReset());
  });

  it("relays a refusal to edit someone else's comment", async () => {
    stubSupabase();
    reviews.editComment.mockResolvedValue({ ok: false, error: "Une erreur est survenue. Réessayez plus tard." });

    expect(
      await editComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", body: "New text." }))
    ).toEqual({ error: "Une erreur est survenue. Réessayez plus tard." });
  });

  it("relays a refusal to delete someone else's comment", async () => {
    stubSupabase();
    reviews.deleteComment.mockResolvedValue({ ok: false, error: "Une erreur est survenue. Réessayez plus tard." });

    expect(await deleteComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1" }))).toEqual({
      error: "Une erreur est survenue. Réessayez plus tard."
    });
  });
});
```

```ts
describe("reactToComment", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    Object.values(reviews).forEach((fn) => fn.mockReset());
  });

  it("moves the reaction rather than duplicating it (delegated to the upsert in reviews.ts)", async () => {
    stubSupabase();
    reviews.reactToComment.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: true });

    await reactToComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", value: "for" }));
    await reactToComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", value: "against" }));

    expect(reviews.reactToComment).toHaveBeenNthCalledWith(1, expect.anything(), "user-1", "c1", "for");
    expect(reviews.reactToComment).toHaveBeenNthCalledWith(2, expect.anything(), "user-1", "c1", "against");
  });
});

describe("reportComment", () => {
  beforeEach(() => {
    vi.mocked(createClient).mockReset();
    Object.values(reviews).forEach((fn) => fn.mockReset());
  });

  it("refuses a second report on the same comment", async () => {
    stubSupabase();
    reviews.reportComment.mockResolvedValue({ ok: false, error: "Vous avez déjà signalé ce commentaire." });

    expect(
      await reportComment({ error: null }, form({ ...MATCHUP_FIELDS, commentId: "c1", reason: "spam" }))
    ).toEqual({ error: "Vous avez déjà signalé ce commentaire." });
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" "src/app/duel"`
Expected: FAIL, cannot resolve `./actions`.

- [ ] **Step 3: Implement**

`src/app/duel/[role]/[pair]/actions.ts`:

```ts
"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as reviews from "@/lib/matchup/reviews";
import type { MatchupKey } from "@/lib/matchup/key";
import { pairSegment } from "@/lib/matchup/key";
import { isRole, type Role } from "@/lib/draft/roles";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error: string | null };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez plus tard.";

function readMatchupKey(formData: FormData): MatchupKey | null {
  const role = String(formData.get("role") ?? "");
  const championLowId = String(formData.get("championLowId") ?? "");
  const championHighId = String(formData.get("championHighId") ?? "");
  if (!isRole(role) || !championLowId || !championHighId || championLowId >= championHighId) return null;
  return { role: role as Role, championLowId, championHighId };
}

function matchupPath(key: MatchupKey): Route {
  return `/duel/${key.role}/${pairSegment(key)}` as Route;
}
```

```ts
// Every write on this page needs a signed-in, nicknamed account (see the
// spec's "Posting requires a nickname" decision) -- votes and comments alike.
async function requireNicknamedUser(nextPath: Route) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent(nextPath)}` as Route);

  const { data: profile } = await supabase.from("profiles").select("display_name").eq("user_id", user.id).maybeSingle();
  if (!(profile as { display_name: string | null } | null)?.display_name) {
    redirect(`/compte/pseudo?next=${encodeURIComponent(nextPath)}` as Route);
  }

  return { supabase, userId: user.id };
}

export async function castVote(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const choice = String(formData.get("choice") ?? "");
  if (!key || (choice !== "low" && choice !== "high" && choice !== "even")) return { error: GENERIC_ERROR };

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.castVote(supabase, userId, key, choice);
  if (!result.ok) return { error: result.error };

  revalidatePath(matchupPath(key));
  return { error: null };
}
```

```ts
export async function postComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const body = String(formData.get("body") ?? "");
  if (!key) return { error: GENERIC_ERROR };

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.postComment(supabase, userId, key, body);
  if (!result.ok) return { error: result.error };

  revalidatePath(matchupPath(key));
  return { error: null };
}

export async function editComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = String(formData.get("commentId") ?? "");
  const body = String(formData.get("body") ?? "");
  if (!key || !commentId) return { error: GENERIC_ERROR };

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.editComment(supabase, userId, commentId, body);
  if (!result.ok) return { error: result.error };

  revalidatePath(matchupPath(key));
  return { error: null };
}
```

```ts
export async function deleteComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = String(formData.get("commentId") ?? "");
  if (!key || !commentId) return { error: GENERIC_ERROR };

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.deleteComment(supabase, userId, commentId);
  if (!result.ok) return { error: result.error };

  revalidatePath(matchupPath(key));
  return { error: null };
}

export async function reactToComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = String(formData.get("commentId") ?? "");
  const value = String(formData.get("value") ?? "");
  if (!key || !commentId || (value !== "for" && value !== "against")) return { error: GENERIC_ERROR };

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.reactToComment(supabase, userId, commentId, value);
  if (!result.ok) return { error: result.error };

  revalidatePath(matchupPath(key));
  return { error: null };
}
```

```ts
export async function reportComment(_previous: FormState, formData: FormData): Promise<FormState> {
  const key = readMatchupKey(formData);
  const commentId = String(formData.get("commentId") ?? "");
  const reason = String(formData.get("reason") ?? "");
  if (!key || !commentId || !["spam", "insultant", "hors_sujet", "autre"].includes(reason)) {
    return { error: GENERIC_ERROR };
  }

  const { supabase, userId } = await requireNicknamedUser(matchupPath(key));
  const result = await reviews.reportComment(supabase, userId, commentId, reason as reviews.ReportReason);
  if (!result.ok) return { error: result.error };

  return { error: null };
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" "src/app/duel"`
Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` -- Expected: no errors.

```bash
git add "src/app/duel/[role]/[pair]/actions.ts" "src/app/duel/[role]/[pair]/actions.test.ts"
git commit -m "feat: add Server Actions to vote, comment, react and report on a matchup"
```

---

### Task 5: Vote panel component

**Files:**
- Create: `src/components/matchup/vote-panel.tsx`, `src/components/matchup/vote-panel.test.tsx`

Depends on Task 3's `VoteSummary` type. Independent of Task 4 (the action is passed in as a prop, not imported).

- [ ] **Step 1: Write the failing tests**

`src/components/matchup/vote-panel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VotePanel } from "./vote-panel";

const CHAMPION_LOW = { id: "darius", name: "Darius" };
const CHAMPION_HIGH = { id: "garen", name: "Garen" };

function props(summary: Partial<Parameters<typeof VotePanel>[0]["summary"]> = {}) {
  return {
    championLow: CHAMPION_LOW,
    championHigh: CHAMPION_HIGH,
    role: "top" as const,
    summary: { low: 0, high: 0, even: 0, total: 0, myChoice: null, ...summary },
    action: vi.fn()
  };
}
```

```tsx
describe("VotePanel", () => {
  it("always shows the raw count next to each choice", () => {
    render(<VotePanel {...props({ low: 3, high: 1, even: 0, total: 4 })} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("does not show a derived percentage below 5 votes", () => {
    render(<VotePanel {...props({ low: 3, high: 1, even: 0, total: 4 })} />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("shows the derived percentage once the matchup reaches 5 votes", () => {
    render(<VotePanel {...props({ low: 4, high: 1, even: 0, total: 5 })} />);
    expect(screen.getByText(/80 %/)).toBeInTheDocument();
    expect(screen.getByText(/Darius/)).toBeInTheDocument();
  });

  it("marks the caller's own choice", () => {
    render(<VotePanel {...props({ low: 1, total: 1, myChoice: "low" })} />);
    expect(screen.getByRole("button", { name: /Darius gagne/ })).toHaveAttribute("aria-pressed", "true");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/vote-panel.test.tsx`
Expected: FAIL, cannot resolve `./vote-panel`.

- [ ] **Step 3: Implement**

`src/components/matchup/vote-panel.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import type { Role } from "@/lib/draft/roles";
import type { VoteChoice, VoteSummary } from "@/lib/matchup/reviews";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";

const INITIAL: FormState = { error: null };
const PERCENT_THRESHOLD = 5;

type Champion = { id: string; name: string };
```

```tsx
export function VotePanel({
  championLow,
  championHigh,
  role,
  summary,
  action
}: {
  championLow: Champion;
  championHigh: Champion;
  role: Role;
  summary: VoteSummary;
  action: (previous: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState(action, INITIAL);

  const leader: { label: string; count: number } | null =
    summary.total < PERCENT_THRESHOLD
      ? null
      : [
          { choice: "low" as const, label: `${championLow.name} gagne`, count: summary.low },
          { choice: "high" as const, label: `${championHigh.name} gagne`, count: summary.high },
          { choice: "even" as const, label: "Égalité", count: summary.even }
        ].reduce((best, entry) => (entry.count > best.count ? entry : best));
```

```tsx
  function choiceButton(choice: VoteChoice, label: string, count: number) {
    return (
      <button
        key={choice}
        type="submit"
        name="choice"
        value={choice}
        disabled={pending}
        aria-pressed={summary.myChoice === choice}
        className={`flex flex-1 flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors duration-200 ${
          summary.myChoice === choice ? "border-accent bg-accent-wash text-ink" : "border-rule text-ink-muted hover:border-accent"
        }`}
      >
        <span>{label}</span>
        <span className="tabular-nums text-xs text-ink-faint">{count}</span>
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLow.id} />
      <input type="hidden" name="championHighId" value={championHigh.id} />

      <div className="flex gap-2">
        {choiceButton("low", `${championLow.name} gagne`, summary.low)}
        {choiceButton("even", "Égalité", summary.even)}
        {choiceButton("high", `${championHigh.name} gagne`, summary.high)}
      </div>
```

```tsx
      {leader && (
        <p className="text-xs text-ink-faint">
          {Math.round((leader.count / summary.total) * 100)} % pensent que {leader.label.toLowerCase()} ({summary.total} votes)
        </p>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/vote-panel.test.tsx`
Expected: PASS, 4 tests. If React 19's `useActionState` does not update `aria-pressed` synchronously enough for the last test in jsdom, that assertion depends only on the `summary` prop, not on submitting the form -- leave the test as-is; it renders with `myChoice: "low"` already set and should pass without any interaction.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` -- Expected: no errors (the import of `FormState` from `@/app/duel/[role]/[pair]/actions` is type-only and does not require that file's Server Action bundling to succeed at this point, since Task 4 already created it).

```bash
git add src/components/matchup/vote-panel.tsx src/components/matchup/vote-panel.test.tsx
git commit -m "feat: add the matchup vote panel"
```

---

### Task 6: Comment list and report button components

**Files:**
- Create: `src/components/matchup/comment-list.tsx`, `src/components/matchup/comment-list.test.tsx`
- Create: `src/components/matchup/report-button.tsx`, `src/components/matchup/report-button.test.tsx`

Depends on Task 3's `Comment` type. Independent of Tasks 4, 5, 7.

- [ ] **Step 1: Write the failing tests**

`src/components/matchup/report-button.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const reportComment = vi.hoisted(() => vi.fn());
vi.mock("@/app/duel/[role]/[pair]/actions", () => ({ reportComment }));

import { ReportButton } from "./report-button";

describe("ReportButton", () => {
  it("offers the four report reasons", () => {
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));

    expect(screen.getByRole("radio", { name: /indésirable/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /insultant/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /hors sujet/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /autre/i })).toBeInTheDocument();
  });
```

```tsx
  it("shows the error when a comment was already reported", async () => {
    reportComment.mockResolvedValue({ error: "Vous avez déjà signalé ce commentaire." });
    render(<ReportButton role="top" championLowId="darius" championHighId="garen" commentId="c1" />);

    fireEvent.click(screen.getByRole("button", { name: "Signaler" }));
    fireEvent.click(screen.getByRole("radio", { name: /indésirable/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Envoyer le signalement" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Vous avez déjà signalé ce commentaire.");
  });
});
```

`src/components/matchup/comment-list.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentList } from "./comment-list";
import type { Comment } from "@/lib/matchup/reviews";

vi.mock("@/app/duel/[role]/[pair]/actions", () => ({
  reactToComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  reportComment: vi.fn()
}));
```

```tsx
function comment(overrides: Partial<Comment>): Comment {
  return {
    id: "c1",
    authorNickname: "Faker",
    body: "Un avis.",
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
    edited: false,
    score: 0,
    forCount: 0,
    againstCount: 0,
    myReaction: null,
    isMine: false,
    ...overrides
  };
}

const MATCHUP = { role: "top" as const, championLowId: "darius", championHighId: "garen" };

describe("CommentList", () => {
  it("renders in the order it is given (sorting is reviews.ts's job, see the plan)", () => {
    render(
      <CommentList
        comments={[comment({ id: "first", body: "Premier" }), comment({ id: "second", body: "Second" })]}
        currentUserId={null}
        matchup={MATCHUP}
      />
    );

    const bodies = screen.getAllByTestId("comment-body").map((node) => node.textContent);
    expect(bodies).toEqual(["Premier", "Second"]);
  });
```

```tsx
  it("shows a modifié marker after an edit", () => {
    render(<CommentList comments={[comment({ edited: true })]} currentUserId={null} matchup={MATCHUP} />);
    expect(screen.getByText(/modifié/i)).toBeInTheDocument();
  });

  it("shows Utilisateur supprimé for an anonymized author", () => {
    render(<CommentList comments={[comment({ authorNickname: null })]} currentUserId={null} matchup={MATCHUP} />);
    expect(screen.getByText("Utilisateur supprimé")).toBeInTheDocument();
  });

  it("offers edit and delete only on the caller's own comment", () => {
    render(
      <CommentList
        comments={[comment({ id: "mine", isMine: true }), comment({ id: "theirs", isMine: false })]}
        currentUserId="user-1"
        matchup={MATCHUP}
      />
    );
    expect(screen.getAllByRole("button", { name: "Modifier" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Supprimer" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/comment-list.test.tsx src/components/matchup/report-button.test.tsx`
Expected: FAIL, cannot resolve the components.

- [ ] **Step 3: Implement**

`src/components/matchup/report-button.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { reportComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";
import type { ReportReason } from "@/lib/matchup/reviews";

const INITIAL: FormState = { error: null };

const REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Indésirable (spam)" },
  { value: "insultant", label: "Insultant ou haineux" },
  { value: "hors_sujet", label: "Hors sujet" },
  { value: "autre", label: "Autre" }
];
```

```tsx
export function ReportButton({
  role,
  championLowId,
  championHighId,
  commentId
}: {
  role: string;
  championLowId: string;
  championHighId: string;
  commentId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(reportComment, INITIAL);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-ink-faint transition-colors duration-200 hover:text-danger"
      >
        Signaler
      </button>
    );
  }
```

```tsx
  return (
    <form action={formAction} className="mt-2 space-y-2 rounded-lg border border-rule bg-surface-sunk p-2 text-xs">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLowId} />
      <input type="hidden" name="championHighId" value={championHighId} />
      <input type="hidden" name="commentId" value={commentId} />
      <fieldset className="space-y-1">
        <legend className="sr-only">Motif du signalement</legend>
        {REASONS.map((reason) => (
          <label key={reason.value} className="flex items-center gap-2 text-ink-muted">
            <input type="radio" name="reason" value={reason.value} defaultChecked={reason.value === "spam"} />
            {reason.label}
          </label>
        ))}
      </fieldset>
      {state.error && (
        <p role="alert" className="text-danger">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="text-accent hover:text-accent-pale">
        Envoyer le signalement
      </button>
    </form>
  );
}
```

`src/components/matchup/comment-list.tsx`:

```tsx
"use client";

import { useActionState, useState } from "react";
import { deleteComment, editComment, reactToComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";
import type { Comment } from "@/lib/matchup/reviews";
import { ReportButton } from "./report-button";

const INITIAL: FormState = { error: null };
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });

type Matchup = { role: string; championLowId: string; championHighId: string };
```

```tsx
function ReactionForm({ matchup, commentId, value, active, label }: {
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
```

```tsx
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
```

```tsx
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
```

```tsx
export function CommentList({
  comments,
  currentUserId,
  matchup
}: {
  comments: Comment[];
  currentUserId: string | null;
  matchup: Matchup;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (comments.length === 0) {
    return <p className="text-sm text-ink-muted">Aucun commentaire pour l&apos;instant. Soyez le premier à donner votre avis.</p>;
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
```

```tsx
          {editingId === comment.id ? (
            <EditForm matchup={matchup} comment={comment} onCancel={() => setEditingId(null)} />
          ) : (
            <p data-testid="comment-body" className="mt-1 text-sm text-ink">
              {comment.body}
            </p>
          )}

          <div className="mt-2 flex items-center gap-3 text-xs">
            <ReactionForm matchup={matchup} commentId={comment.id} value="for" active={comment.myReaction === "for"} label={`▲ ${comment.forCount}`} />
            <ReactionForm matchup={matchup} commentId={comment.id} value="against" active={comment.myReaction === "against"} label={`▼ ${comment.againstCount}`} />
            {comment.isMine && editingId !== comment.id && (
              <>
                <button type="button" onClick={() => setEditingId(comment.id)} className="text-ink-faint hover:text-ink">
                  Modifier
                </button>
                <DeleteForm matchup={matchup} commentId={comment.id} />
              </>
            )}
            {!comment.isMine && (
              <ReportButton role={matchup.role} championLowId={matchup.championLowId} championHighId={matchup.championHighId} commentId={comment.id} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
```

Note: `currentUserId` is accepted for API symmetry with the rest of the page (every other matchup component takes the caller's id) even though `CommentList` itself only needs the already-computed `comment.isMine`/`comment.myReaction`. If ESLint flags it as an unused parameter, add `void currentUserId;` as the first line of the function body rather than removing the prop -- the tests pass it explicitly and a future "highlight my own comments" affordance would read it.

- [ ] **Step 4: Run them to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/comment-list.test.tsx src/components/matchup/report-button.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` -- Expected: no errors.

```bash
git add src/components/matchup/comment-list.tsx src/components/matchup/comment-list.test.tsx src/components/matchup/report-button.tsx src/components/matchup/report-button.test.tsx
git commit -m "feat: add the comment list, reactions and report button"
```

---

### Task 7: Comment form component

**Files:**
- Create: `src/components/matchup/comment-form.tsx`, `src/components/matchup/comment-form.test.tsx`

Depends on Task 4's `postComment` action shape. Independent of Tasks 5, 6.

- [ ] **Step 1: Write the failing test**

`src/components/matchup/comment-form.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const postComment = vi.hoisted(() => vi.fn());
vi.mock("@/app/duel/[role]/[pair]/actions", () => ({ postComment }));

import { CommentForm } from "./comment-form";

describe("CommentForm", () => {
  it("states the length rule and posts to the matchup", () => {
    render(<CommentForm role="top" championLowId="darius" championHighId="garen" />);
    expect(screen.getByText(/3 à 500 caractères/)).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("maxLength", "500");
  });
```

```tsx
  it("shows the error the action returns and keeps the typed text", async () => {
    postComment.mockResolvedValue({ error: "Vous commentez trop vite. Réessayez dans quelques minutes." });
    render(<CommentForm role="top" championLowId="darius" championHighId="garen" />);

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Un avis bien construit." } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Publier" }));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Vous commentez trop vite. Réessayez dans quelques minutes.");
    expect(textarea).toHaveValue("Un avis bien construit.");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/comment-form.test.tsx`
Expected: FAIL, cannot resolve `./comment-form`.

- [ ] **Step 3: Implement**

`src/components/matchup/comment-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { postComment } from "@/app/duel/[role]/[pair]/actions";
import type { FormState } from "@/app/duel/[role]/[pair]/actions";

const INITIAL: FormState = { error: null };
```

```tsx
export function CommentForm({
  role,
  championLowId,
  championHighId
}: {
  role: string;
  championLowId: string;
  championHighId: string;
}) {
  const [state, formAction, pending] = useActionState(postComment, INITIAL);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="role" value={role} />
      <input type="hidden" name="championLowId" value={championLowId} />
      <input type="hidden" name="championHighId" value={championHighId} />
      <label htmlFor="comment-body" className="sr-only">
        Votre avis sur ce matchup
      </label>
      <textarea
        id="comment-body"
        name="body"
        minLength={3}
        maxLength={500}
        required
        rows={3}
        placeholder="Votre avis sur ce matchup…"
        className="w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
      />
      <p className="text-xs text-ink-faint">3 à 500 caractères. Texte brut : pas de mise en forme ni de liens cliquables.</p>
      {state.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-on-accent transition-opacity duration-200 disabled:opacity-60"
      >
        Publier
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run --exclude "**/.claude/**" src/components/matchup/comment-form.test.tsx`
Expected: PASS, 2 tests. If the second test cannot get the mocked action to fire from a click in jsdom, fall back to `fireEvent.submit(textarea.closest("form")!)`, as `nickname-form.test.tsx` (accounts plan, Task 7) already documents for this exact situation.

- [ ] **Step 5: Typecheck, lint, commit**

Run: `npx next typegen && npx tsc --noEmit` and `npm run lint` -- Expected: no errors.

```bash
git add src/components/matchup/comment-form.tsx src/components/matchup/comment-form.test.tsx
git commit -m "feat: add the comment form"
```

---

### Task 8: The matchup page

**Files:**
- Create: `src/app/duel/[role]/[pair]/page.tsx`

Depends on Tasks 1, 3, 4, 5, 6, 7 (composes all of them). No dedicated unit test, same posture as the accounts plan's account pages (Task 9 there) -- it only wires already-tested pieces together. Checked in the browser in Task 12.

- [ ] **Step 1: Implement**

`src/app/duel/[role]/[pair]/page.tsx`:

```tsx
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { castVote } from "./actions";
import { CommentForm } from "@/components/matchup/comment-form";
import { CommentList } from "@/components/matchup/comment-list";
import { VotePanel } from "@/components/matchup/vote-panel";
import { ChampionAvatar } from "@/components/ui/champion-avatar";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isRole } from "@/lib/draft/roles";
import { parsePairSegment } from "@/lib/matchup/key";
import { getComments, getVoteSummary } from "@/lib/matchup/reviews";
import { createClient } from "@/lib/supabase/server";

const COMMENTS_PER_PAGE = 20;

export const metadata: Metadata = { title: "Avis sur ce matchup — DraftForMe" };
```

```tsx
export default async function MatchupPage({
  params,
  searchParams
}: {
  params: Promise<{ role: string; pair: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { role, pair } = await params;
  const { offset: offsetParam } = await searchParams;

  if (!isRole(role)) notFound();
  const parsedPair = parsePairSegment(pair);
  if (!parsedPair) notFound();

  const supabase = await createClient();
  const [championsResult, user] = await Promise.all([
    supabase.from("champions").select("id, name, image_url").in("id", [parsedPair.championLowId, parsedPair.championHighId]),
    getCurrentUser()
  ]);

  const championLow = championsResult.data?.find((c) => c.id === parsedPair.championLowId);
  const championHigh = championsResult.data?.find((c) => c.id === parsedPair.championHighId);
  if (!championLow || !championHigh) notFound();

  const key = { role, championLowId: parsedPair.championLowId, championHighId: parsedPair.championHighId };
  const offset = Number(offsetParam ?? 0) || 0;

  const [summary, { comments, hasMore }] = await Promise.all([
    getVoteSummary(supabase, key, user?.id ?? null),
    getComments(supabase, key, user?.id ?? null, { limit: COMMENTS_PER_PAGE, offset })
  ]);

  const nextOffsetHref = `/duel/${role}/${pair}?offset=${offset + COMMENTS_PER_PAGE}` as Route;
```

```tsx
  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-6 flex items-center gap-3">
          <ChampionAvatar name={championLow.name} imageUrl={championLow.image_url ?? undefined} />
          <h1 className="text-2xl font-semibold text-ink">
            {championLow.name} vs {championHigh.name}
          </h1>
          <ChampionAvatar name={championHigh.name} imageUrl={championHigh.image_url ?? undefined} />
        </div>

        <VotePanel
          championLow={{ id: championLow.id, name: championLow.name }}
          championHigh={{ id: championHigh.id, name: championHigh.name }}
          role={role}
          summary={summary}
          action={castVote}
        />
```

```tsx
        <section className="mt-10 space-y-4">
          <h2 className="text-lg font-semibold text-ink">Discussion</h2>
          {user ? (
            <CommentForm role={role} championLowId={championLow.id} championHighId={championHigh.id} />
          ) : (
            <p className="text-sm text-ink-muted">
              <Link href={`/connexion?next=${encodeURIComponent(`/duel/${role}/${pair}`)}` as Route} className="text-accent underline underline-offset-2">
                Connectez-vous
              </Link>{" "}
              pour donner votre avis.
            </p>
          )}

          <CommentList comments={comments} currentUserId={user?.id ?? null} matchup={key} />

          {hasMore && (
            <Link href={nextOffsetHref} className="text-sm text-accent underline underline-offset-2">
              Voir plus
            </Link>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
```

Note: `castVote` is passed as a prop into `VotePanel`; no other import from `./actions` is needed at the page level, since `CommentForm`, `CommentList` and `ReportButton` already import their own actions internally.

- [ ] **Step 2: Typecheck, lint, full suite**

Run: `npx next typegen && npx tsc --noEmit` -- Expected: no errors.
Run: `npm run lint` -- Expected: no errors.
Run: `npx vitest run --exclude "**/.claude/**"` -- Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "src/app/duel/[role]/[pair]/page.tsx"
git commit -m "feat: add the matchup review page"
```

---

### Task 9: Link the matchup page from the draft board's Verdict

**Files:**
- Modify: `src/components/draft/verdict.tsx`, `src/components/draft/verdict.test.tsx`
- Modify: `src/components/draft/draft-board.tsx`

Depends on Task 1 (`matchupHref`). Independent of Tasks 2–8 otherwise.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/draft/verdict.test.tsx` (new `describe` block, after the existing tests):

```tsx
describe("Verdict's community link", () => {
  it("links to the canonical matchup when the direct opponent is known", () => {
    render(<Verdict recommendation={build()} role="mid" enemyChampionId="zed" />);
    expect(screen.getByRole("link", { name: "Avis de la communauté" })).toHaveAttribute("href", "/duel/mid/galio-vs-zed");
  });

  it("omits the link when there is no direct opponent yet", () => {
    render(<Verdict recommendation={build()} role="mid" enemyChampionId={null} />);
    expect(screen.queryByRole("link", { name: "Avis de la communauté" })).not.toBeInTheDocument();
  });

  it("omits the link when the role is not known", () => {
    render(<Verdict recommendation={build()} enemyChampionId="zed" />);
    expect(screen.queryByRole("link", { name: "Avis de la communauté" })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --exclude "**/.claude/**" src/components/draft/verdict.test.tsx`
Expected: FAIL, `Verdict` accepts no `role`/`enemyChampionId` props yet.

- [ ] **Step 3: Implement**

In `src/components/draft/verdict.tsx`, add the import `import Link from "next/link";`, `import type { Route } from "next";`, `import type { Role } from "@/lib/draft/roles";`, `import { matchupHref } from "@/lib/matchup/key";`, and change the signature and body:

```tsx
export function Verdict({
  recommendation,
  role,
  enemyChampionId
}: {
  recommendation: Recommendation;
  role?: Role;
  enemyChampionId?: string | null;
}) {
  const counter = recommendation.explanation.factors.find((factor) => factor.key === "counter");
  const communityHref: Route | null =
    role && enemyChampionId && enemyChampionId !== recommendation.championId
      ? matchupHref(recommendation.championId, enemyChampionId, role)
      : null;

  return (
    // ...unchanged JSX up to the counter paragraph...
        <p className="col-span-full border-t border-rule-soft pt-2.5 text-xs leading-relaxed text-ink-muted">
          {counter?.detail}
          {communityHref && (
            <>
              {" "}
              <Link href={communityHref} className="text-accent underline underline-offset-2 hover:text-accent-pale">
                Avis de la communauté
              </Link>
            </>
          )}
        </p>
    // ...
  );
}
```

(Keep every other line of the existing component unchanged.)

In `src/components/draft/draft-board.tsx`:
- add `directOpponent` to the existing `@/lib/draft/draft-state` import;
- change `<Verdict recommendation={top} />` to `<Verdict recommendation={top} role={draft.yourRole} enemyChampionId={directOpponent(draft)} />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --exclude "**/.claude/**" src/components/draft`
Expected: PASS, all tests including the 3 new ones.

- [ ] **Step 5: Typecheck, lint, full suite, commit**

Run: `npx next typegen && npx tsc --noEmit`, `npm run lint`, `npx vitest run --exclude "**/.claude/**"` -- Expected: all clean.

```bash
git add src/components/draft/verdict.tsx src/components/draft/verdict.test.tsx src/components/draft/draft-board.tsx
git commit -m "feat: link the draft board's Verdict to the matchup review page"
```

---

### Task 10: Legal pages -- privacy policy, terms of use, SITE_INFO.lastUpdated

**Files:**
- Modify: `src/lib/legal/site-info.ts` (confirm `lastUpdated`)
- Modify: `src/components/legal/privacy-policy.tsx`, `src/components/legal/privacy-policy.test.tsx`
- Modify: `src/components/legal/terms-of-use.tsx`, `src/components/legal/terms-of-use.test.tsx`

Independent of every other task; can run at any point.

- [ ] **Step 1: Confirm `lastUpdated`**

`src/lib/legal/site-info.ts` already has `lastUpdated: "2026-09-24"` from the accounts piece of work merged the same day; leave it as-is (it is still today). If this task lands on a later date, update it to that date instead -- the rule is "the day this merges", not a fixed string.

- [ ] **Step 2: Update the privacy policy tests (failing first)**

In `src/components/legal/privacy-policy.test.tsx`:
- replace `"Évolutions à venir"` with `"Avis"` in the "has every expected section" list;
- keep the existing `"no longer announces accounts as upcoming"` test unchanged (accounts are shipped, distinct from this claim); add these two new tests after it:

```tsx
  it("no longer announces matchup reviews as upcoming", () => {
    render(<PrivacyPolicy info={noContact} />);
    expect(screen.queryByText(/sont prévus/)).not.toBeInTheDocument();
  });

  it("describes what an avis stores, its basis, its retention and the anonymization on deletion", () => {
    render(<PrivacyPolicy info={noContact} />);

    expect(screen.getByText(/choix de vote/)).toBeInTheDocument();
    expect(screen.getByText(/le texte de vos commentaires est conservé/)).toBeInTheDocument();
    expect(screen.getByText(/supprimé, pas le contenu/)).toBeInTheDocument();
  });
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal/privacy-policy.test.tsx` -- Expected: FAIL.

- [ ] **Step 3: Update the privacy policy**

In `src/components/legal/privacy-policy.tsx`, replace the `"Évolutions à venir"` section with:

```tsx
      <LegalSection title="Avis">
        <p>
          Si vous donnez votre avis sur un matchup, {info.siteName} enregistre votre choix de vote, le texte de vos
          commentaires, vos réactions (pour / contre) sur les commentaires des autres joueurs, et le motif de vos
          éventuels signalements -- chacun associé à votre compte.
        </p>
        <p>
          Finalité : publier les avis de la communauté sur les matchups et permettre la modération. Base légale :
          l&apos;exécution du service que vous demandez en votant, en commentant ou en réagissant (article 6.1.b du
          RGPD) ; l&apos;intérêt légitime de l&apos;éditeur pour les signalements. Durée de conservation : jusqu&apos;à
          la suppression de votre compte ou jusqu&apos;à ce que l&apos;éditeur retire le contenu.
        </p>
        <p>
          Si vous supprimez votre compte, vos votes sont supprimés avec lui. Vos commentaires, en revanche, restent
          visibles : c&apos;est le compte qui est supprimé, pas le contenu que d&apos;autres joueurs sont venus lire ;
          leur auteur apparaît alors comme « Utilisateur supprimé ».
        </p>
      </LegalSection>
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal/privacy-policy.test.tsx` -- Expected: PASS, including the existing punctuation test.

- [ ] **Step 4: Update the terms tests (failing first)**

In `src/components/legal/terms-of-use.test.tsx`, add `"Avis et commentaires"` to the section list (after `"Compte"`) and:

```tsx
  it("sets the review rules", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/un vote par matchup et par compte/)).toBeInTheDocument();
    expect(screen.getByText(/poster trop vite/)).toBeInTheDocument();
    expect(screen.getByText(/ne sont pas une garantie/)).toBeInTheDocument();
  });
```

Also update the existing "Accès au service" text: `"un compte n'est nécessaire pour aucune d'entre elles aujourd'hui"` is no longer true (giving a matchup review needs one). Replace the sentence's second half with `"un compte est nécessaire pour donner votre avis sur les matchups."` and add a test for it:

```tsx
  it("says an account is needed to leave a review", () => {
    render(<TermsOfUse info={SITE_INFO} />);
    expect(screen.getByText(/un compte est nécessaire pour donner votre avis/)).toBeInTheDocument();
  });
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal/terms-of-use.test.tsx` -- Expected: FAIL.

- [ ] **Step 5: Update the terms**

In `src/components/legal/terms-of-use.tsx`:
- in "Accès au service", replace `"Ses outils sont accessibles sans inscription ; un compte n'est nécessaire pour aucune d'entre elles aujourd'hui."` with `"Ses outils sont accessibles sans inscription ; un compte est nécessaire pour donner votre avis sur les matchups."` (escape the apostrophe as `&apos;` as elsewhere in the file);
- insert a new section after "Compte":

```tsx
      <LegalSection title="Avis et commentaires">
        <p>
          Vous pouvez voter une fois par matchup et par compte, et laisser plusieurs commentaires : ils suivent la
          même règle que le pseudo (ni usurpation, ni propos injurieux, haineux ou contraires à la loi), et sont
          limités pour éviter de poster trop vite. Ces avis reflètent l&apos;opinion des joueurs qui les publient :
          comme les recommandations, ce ne sont pas une garantie. Un signalement est transmis à l&apos;éditeur, qui
          peut retirer un commentaire ou un compte qui enfreint ces règles. Si vous supprimez votre compte, vos
          commentaires ne sont pas supprimés avec lui : ils sont anonymisés (voir la{" "}
          <Link href="/confidentialite" className={LEGAL_LINK_CLASS}>
            politique de confidentialité
          </Link>
          ).
        </p>
      </LegalSection>
```

Run: `npx vitest run --exclude "**/.claude/**" src/components/legal src/lib/legal` -- Expected: PASS.

- [ ] **Step 6: Full checks and commit**

Run: `npx vitest run --exclude "**/.claude/**"`, `npx next typegen && npx tsc --noEmit`, `npm run lint` -- Expected: all clean.

```bash
git add src/lib/legal/site-info.ts src/components/legal/privacy-policy.tsx src/components/legal/privacy-policy.test.tsx src/components/legal/terms-of-use.tsx src/components/legal/terms-of-use.test.tsx
git commit -m "docs: describe matchup reviews in the privacy policy and terms of use"
```

---

### Task 11: Check against a real local Supabase (controller, not a subagent)

Needs Docker running and `.env.local` pointing at the local instance; the owner's production project is never used. Run after Task 2 at the earliest; running it after Tasks 3–8 as well lets the browser check in Step 3 exercise the real page.

- [ ] **Step 1:** `npx supabase start`, then `npx supabase db reset` (applies 0001-0005 and the seed). If Docker or the CLI is unavailable, skip Steps 1-3 and record in the spec that the migration was not run locally.
- [ ] **Step 2:** Using the SQL editor at the printed Studio URL (or `psql` via `docker exec`), as `postgres`:
  - Create two auth users (e.g. via Studio's user admin, or directly in `auth.users`) and a `profiles` row with a nickname for each.
  - Insert into `matchup_votes` with `champion_low_id = 'garen'`, `champion_high_id = 'darius'` (reversed order) → the `check (champion_low_id < champion_high_id)` constraint must reject it.
  - Insert a valid vote for user 1, then upsert a second vote for user 1 on the same matchup with a different `choice` using `on conflict (role, champion_low_id, champion_high_id, user_id) do update` → confirms the unique constraint and that the app's upsert path is sound.
  - As `anon` (`set role anon;`), run `select * from matchup_comment_reports;` → must fail with a permission error (not just an empty result) -- this is the check that Task 2's `revoke select` actually took effect.
  - As `authenticated` with user 1's JWT claims set (same `set_config('request.jwt.claims', ...)` pattern as the accounts plan's Task 11), insert a report from user 1 on some comment, then try `select` on `matchup_comment_reports` → still denied, even for the reporter themselves.
  - Insert 4 comments from the same user on the same matchup inside a few seconds of each other → the 4th must fail with `comment_rate_limited`.
  - Delete user 1's `auth.users` row (or call `delete_my_account()` as user 1) → their `matchup_votes` rows disappear (cascade) and their `matchup_comments` rows survive with `user_id` now `null`.

- [ ] **Step 3:** Start the dev server against the local instance (`npm run dev`) and check in the browser:
  - `/duel/top/darius-vs-garen` (or any two seeded top-lane champion ids in canonical order) renders the vote panel and an empty comment list.
  - `/duel/top/garen-vs-darius` (reversed) returns a 404.
  - Signed out, clicking a vote button redirects to `/connexion?next=...`; after signing in with no nickname, redirects to `/compte/pseudo?next=...` and back to the matchup page afterward.
  - Once nicknamed, casting a vote updates the counts and, once 5 votes exist (cast from several local test accounts, or via direct SQL for the remaining ones), the percentage line appears with the right wording and no invented number below that.
  - Posting, editing and deleting a comment all work; posting a 4th comment on the same matchup within 10 minutes shows "Vous commentez trop vite. Réessayez dans quelques minutes." with the typed text still in the textarea.
  - The draft board's Verdict shows "Avis de la communauté" once an enemy stands on the drafted role, and it links to the matching `/duel/...` URL.
  - The privacy policy and terms of use render their new sections.
  - Mobile width has no horizontal scroll on the matchup page.
- [ ] **Step 4:** `npx supabase stop`. Update the spec with what was verified and anything that could not be, and commit `docs: record the matchup reviews verification`.

---

### Task 12: Final verification

- [ ] **Step 1:** `npm run ci` (typecheck, lint, full Vitest suite) -- Expected: all green.
- [ ] **Step 2:** `npm run seed:check` -- Expected: passes without changes. (No task in this plan touches `data/` or `scripts/build-seed-data.mjs`, so `supabase/seed.sql` is unaffected by this piece of work; this step exists to confirm that assumption rather than because a change is expected.)
- [ ] **Step 3:** If not already done as part of Task 11, start the dev server (`npm run dev`) and load `/duel/<role>/<low>-vs-<high>` for a real seeded pair, plus `/draft` to confirm the "Avis de la communauté" link appears once an enemy occupies the drafted role and opens the matching matchup page.
- [ ] **Step 4:** Confirm every commit in this branch's history is green individually (`git log --oneline main..HEAD`) -- no task above should have been left with a red `npm run ci` between its steps.
