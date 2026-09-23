-- Accounts: a public nickname per profile, and self-service account deletion.
-- See docs/superpowers/specs/2026-09-24-draftforme-accounts-design.md.

-- Nicknames: same rule as src/lib/auth/nickname.ts, and unique ignoring case
-- so "Faker" and "faker" cannot both exist. NULL (not chosen yet) is allowed.
alter table public.profiles
  add constraint profiles_display_name_format check (display_name ~ '^[A-Za-z0-9_-]{3,20}$');

create unique index profiles_display_name_lower on public.profiles (lower(display_name));

-- The Riot ID was rejected (unverifiable without the Riot API); these columns
-- were never written.
alter table public.profiles drop column riot_name;
alter table public.profiles drop column riot_tag;

-- Deletes the caller's own auth user and nothing else. The on delete cascade
-- foreign keys from 0001 remove profiles, user_preferences and
-- champion_pool_entries; recommendation_sessions keeps its rows with a null
-- user_id. security definer is needed to reach auth.users; the empty
-- search_path and the fully qualified name keep it from being hijacked.
create function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
