---
active: paths
paths:
  - "supabase/**"
  - "src/lib/draft/load-example.ts"
  - "src/app/api/recommend/route.ts"
  - "src/lib/supabase/**"
---

# Supabase

- `supabase/seed.sql` is **generated** by `scripts/build-seed-data.mjs` from `data/` — never edit it by hand. Regenerate with `npm run seed:build`; `npm run seed:check` fails CI if it's out of sync.
- `supabase/migrations/` is applied in order; a schema change is a new migration, never an edit to an already-applied one.
- The home page's example (`src/lib/draft/load-example.ts`) and the recommend API (`src/app/api/recommend/route.ts`) both load `champion_stats` and `counter_relations` and call the scoring engine — keep their queries identical, or the two surfaces will silently disagree.
- `createPublicClient()` (`src/lib/supabase/public.ts`) is for anonymous, cacheable, non-user-scoped reads only — it holds no session. Anything that depends on the signed-in user goes through the server client instead.
- Push, deploy, or query the production Supabase project only when the owner asks.
