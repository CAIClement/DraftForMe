-- Row Level Security controls which ROWS a role may see. It does not grant the
-- privilege to touch the TABLE at all -- both are required, and 0001 and 0002
-- only ever did the first. Every table they create is therefore unreadable by
-- `anon`, so a deployment built from these migrations answers every anonymous
-- request with "permission denied for table champion_stats" and the app falls
-- back to its degraded state for every visitor.
--
-- The tables inherit the `postgres` role's default privileges for schema
-- public, which grant anon Dxtm (truncate, references, trigger, maintain) and
-- deliberately withhold r (select). The grants below are the missing half.

-- Reference data: the read-all policies in 0001 and 0002 already make every row
-- visible to everyone, so the table privilege matches.
grant select on public.champions to anon, authenticated;
grant select on public.champion_stats to anon, authenticated;
grant select on public.matchups to anon, authenticated;
grant select on public.builds to anon, authenticated;
grant select on public.counter_relations to anon, authenticated;

-- User-scoped data: RLS already restricts every one of these to auth.uid(), so
-- the grants are scoped to `authenticated` and the policies do the filtering.
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.champion_pool_entries to authenticated;
grant select, insert on public.recommendation_sessions to authenticated;
grant select on public.recommendation_results to authenticated;

-- `recommendation_sessions` accepts a guest row (its insert policy allows a null
-- user_id), so an anonymous visitor must be able to write one.
grant insert on public.recommendation_sessions to anon;

-- Keep future tables in this schema from repeating the omission.
alter default privileges in schema public grant select on tables to anon, authenticated;
