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

create index matchup_votes_lookup_idx on public.matchup_votes (role, champion_low_id, champion_high_id);
create index matchup_comments_lookup_idx on public.matchup_comments (role, champion_low_id, champion_high_id, created_at desc);
create index matchup_comments_author_idx on public.matchup_comments (user_id, created_at desc);
create index matchup_comment_votes_comment_idx on public.matchup_comment_votes (comment_id);
