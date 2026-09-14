create table public.counter_relations (
  id uuid primary key default gen_random_uuid(),
  champion_id text not null references public.champions(id) on delete cascade,
  countered_by_champion_id text not null references public.champions(id) on delete cascade,
  role text not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (champion_id, countered_by_champion_id, role, source),
  check (champion_id <> countered_by_champion_id)
);

alter table public.counter_relations enable row level security;

create policy "counter_relations_read_all" on public.counter_relations for select using (true);

create index counter_relations_lookup_idx on public.counter_relations (role, countered_by_champion_id);
create index counter_relations_champion_idx on public.counter_relations (role, champion_id);
