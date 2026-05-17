create extension if not exists "pgcrypto";

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  riot_name text,
  riot_tag text,
  default_region text not null default 'euw',
  default_role text not null default 'mid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  recommendation_style text not null default 'coach',
  meta_weight int not null default 50 check (meta_weight between 0 and 100),
  pool_weight int not null default 50 check (pool_weight between 0 and 100),
  matchup_weight int not null default 50 check (matchup_weight between 0 and 100),
  updated_at timestamptz not null default now()
);

create table public.champions (
  id text primary key,
  riot_key text not null unique,
  slug text not null unique,
  name text not null,
  image_url text not null,
  tags text[] not null default '{}',
  ddragon_version text not null
);

create table public.champion_stats (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  tier text not null,
  win_rate numeric,
  pick_rate numeric,
  ban_rate numeric,
  games int,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, role, region, tier, source)
);

create table public.matchups (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  enemy_champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  win_rate numeric,
  games int,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, enemy_champion_id, role, region, source)
);

create table public.builds (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  region text not null,
  core_items jsonb not null default '[]'::jsonb,
  starter_items jsonb not null default '[]'::jsonb,
  boots jsonb,
  skill_order text,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, role, region, source)
);

create table public.champion_pool_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  champion_id text not null references public.champions(id) on delete cascade,
  confidence int not null default 50 check (confidence between 0 and 100),
  games int,
  win_rate numeric,
  notes text,
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  unique (user_id, champion_id)
);

create table public.recommendation_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  role text not null,
  region text not null,
  tier text not null,
  enemy_picks text[] not null default '{}',
  bans text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.recommendation_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.recommendation_sessions(id) on delete cascade,
  champion_id text not null references public.champions(id) on delete cascade,
  rank int not null,
  total_score numeric not null,
  score_payload jsonb not null,
  explanation_payload jsonb not null
);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.champion_pool_entries enable row level security;
alter table public.recommendation_sessions enable row level security;
alter table public.recommendation_results enable row level security;
alter table public.champions enable row level security;
alter table public.champion_stats enable row level security;
alter table public.matchups enable row level security;
alter table public.builds enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "preferences_all_own" on public.user_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pool_all_own" on public.champion_pool_entries for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions_select_own" on public.recommendation_sessions for select using (auth.uid() = user_id);
create policy "sessions_insert_own_or_guest" on public.recommendation_sessions for insert with check (user_id is null or auth.uid() = user_id);

create policy "results_select_own" on public.recommendation_results
for select using (
  exists (
    select 1 from public.recommendation_sessions s
    where s.id = recommendation_results.session_id
    and s.user_id = auth.uid()
  )
);

create policy "champions_read_all" on public.champions for select using (true);
create policy "stats_read_all" on public.champion_stats for select using (true);
create policy "matchups_read_all" on public.matchups for select using (true);
create policy "builds_read_all" on public.builds for select using (true);

create index champion_stats_lookup_idx on public.champion_stats (role, region, tier);
create index matchups_lookup_idx on public.matchups (champion_id, role, region);
create index pool_user_idx on public.champion_pool_entries (user_id);
create index recommendation_sessions_user_idx on public.recommendation_sessions (user_id, created_at desc);
