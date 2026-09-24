# Current work

## feat/matchup-reviews
Started: 2026-09-24
Spec: docs/superpowers/specs/2026-09-24-draftforme-matchup-reviews-design.md
Plan: docs/superpowers/plans/2026-09-24-draftforme-matchup-reviews.md

- Done: plan Tasks 1-10 and 12 (subagent-driven, each task reviewed, then a whole-branch review and its fixes). `npm run ci` green (354 tests), `seed:check` clean, engine/seed/ml untouched. Spec updated to record what was built.
- Owner decisions taken on the way: open flat discussion; votes and reactions stay publicly readable (legal text says so).
- Next: Task 11, the manual check of migration 0005 on a local Supabase (needs Docker Desktop running), then the browser check of `/duel/...` against that local instance. Migration 0005 has never run on any Postgres yet.
- Blocking before production: Task 11; `SITE_INFO.contactEmail` is empty, so nobody can actually ask for an erasure; applying 0005 to production is the owner's call.
- Nothing pushed.

<!--
Format `/pause` writes and `/point` reads:

## <branch name>
Started: <date>
Spec: <path, if any>
Plan: <path, if any>

- What's done
- What's next
- Anything blocking
-->
