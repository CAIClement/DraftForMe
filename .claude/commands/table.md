---
description: Show the current Supabase schema — migrations applied, and (if reachable) the live table list — before touching a query.
---

Look up: $ARGUMENTS (a table name, or leave blank for the full picture)

1. Read `supabase/migrations/` in order and summarize the schema as it stands today — every `CREATE TABLE` / `ALTER TABLE` that still applies, most recent last.
2. If a Supabase MCP connection is available for this project, cross-check with `list_tables` rather than relying on migrations alone (a migration can be written and not yet applied).
3. If the lookup concerns `champion_stats` or `counter_relations`, point out `src/lib/draft/load-example.ts` and `src/app/api/recommend/route.ts` — both query these and must stay in sync (`.claude/rules/supabase.md`).
4. Never write to the production project from this command — read-only.
