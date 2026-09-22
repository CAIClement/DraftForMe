---
active: paths
paths:
  - "src/**/*.ts"
  - "src/**/*.tsx"
---

# TypeScript

- `typedRoutes` is on: links take `Route`, not a bare string — `import type { Route } from "next"` and type the `href`.
- `npx tsc --noEmit` must pass; run it before considering a TypeScript change done.
- `src/lib/recommendation/` is pure functions, fully unit-tested — new logic there should stay that way (no I/O, no hidden state) so it stays testable the same way.
- `src/lib/draft/load-example.ts` and `src/app/api/recommend/route.ts` must keep identical queries against `champion_stats` and `counter_relations` — a type change to one's return shape belongs in both.
