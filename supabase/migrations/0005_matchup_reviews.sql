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
  -- Serializes concurrent inserts by the same author so a burst can't exceed the caps.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.user_id::text));

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

  select count(*) into site_wide_count
  from public.matchup_comments
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';

  if site_wide_count >= 20 then
    raise exception 'comment_rate_limited' using errcode = 'P0001';
  end if;

  -- The windows above trust created_at, so the client never chooses it: a
  -- backdated insert would otherwise fall outside every window and dodge the cap.
  new.created_at := now();
  new.updated_at := now();
  return new;
end;
$$;

create trigger matchup_comments_rate_limit
  before insert on public.matchup_comments
  for each row execute function public.enforce_comment_rate_limit();

-- An author may edit a comment's body, nothing else. created_at is locked so a
-- comment cannot be backdated out of the rate-limit windows; the matchup key
-- is locked so a comment cannot be moved to another matchup; user_id is
-- locked except for becoming null, because the on delete set null foreign key
-- anonymizes a deleted account's comments through an UPDATE that must pass.
-- updated_at is maintained here (body edits only) so the application never
-- has to set it.
create function public.lock_matchup_comment_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.id := old.id;
  new.created_at := old.created_at;
  new.role := old.role;
  new.champion_low_id := old.champion_low_id;
  new.champion_high_id := old.champion_high_id;
  if new.user_id is not null then
    new.user_id := old.user_id;
  end if;
  -- updated_at > created_at shows a "modifié" marker, so only a real body
  -- edit bumps it: anonymization on account deletion must not look like one.
  if new.body is distinct from old.body then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
  end if;
  return new;
end;
$$;

create trigger matchup_comments_lock_columns
  before update on public.matchup_comments
  for each row execute function public.lock_matchup_comment_columns();

-- Changing a vote (castVote's upsert) keeps its original created_at and
-- stamps updated_at, so neither depends on what the client sends.
create function public.touch_matchup_vote()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger matchup_votes_touch
  before update on public.matchup_votes
  for each row execute function public.touch_matchup_vote();

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

-- 0003 ends with `alter default privileges in schema public grant select on
-- tables to anon, authenticated`, which applies to every table created
-- afterwards by the same role -- including this one. Left alone it would
-- silently hand anon/authenticated the exact select access the "no select
-- policy at all" decision above depends on not existing. Revoked explicitly
-- so RLS (zero select policies, so nobody but postgres) is what decides.
revoke select on public.matchup_comment_reports from anon, authenticated;

-- Comment authors' nicknames. profiles only lets a user read their own row
-- (0001), so the matchup page cannot read anyone else's display_name from it.
-- This is a plain view, deliberately NOT security_invoker: it runs with its
-- owner's rights, so it bypasses profiles' own-row RLS -- which is why it
-- exposes exactly two columns. display_name is public by design (it is shown
-- next to every comment); default_region, default_role and the timestamps
-- stay private and are only reachable through profiles' own-row policy.
-- Rows without a nickname are left out: those users cannot comment anyway.
create view public.public_profiles as
  select user_id, display_name from public.profiles where display_name is not null;

revoke all on public.public_profiles from anon, authenticated;
grant select on public.public_profiles to anon, authenticated;

create index matchup_votes_lookup_idx on public.matchup_votes (role, champion_low_id, champion_high_id);
create index matchup_comments_lookup_idx on public.matchup_comments (role, champion_low_id, champion_high_id, created_at desc);
create index matchup_comments_author_idx on public.matchup_comments (user_id, created_at desc);
create index matchup_comment_votes_comment_idx on public.matchup_comment_votes (comment_id);
