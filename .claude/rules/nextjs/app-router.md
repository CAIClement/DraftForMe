---
active: paths
paths:
  - "src/app/**"
---

# Next.js App Router

DraftForMe uses the App Router exclusively — there is no `pages/` directory and no reason to add one.

- `typedRoutes` is on: an `href` takes `Route` (`import type { Route } from "next"`), not a bare string.
- `src/app/api/recommend/route.ts` is the API surface; it must load `champion_stats` and `counter_relations` the same way `src/lib/draft/load-example.ts` does — see `.claude/rules/supabase.md`.
- Server vs. client boundaries: a component that needs the signed-in session goes through the server Supabase client, never `createPublicClient()` (see `.claude/rules/supabase.md`).
