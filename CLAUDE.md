# CLAUDE.md

DraftForMe is a League of Legends draft coach: given a role and the enemy picks already locked, it recommends three champions and explains each score. A Next.js site backed by Supabase, plus a Python `ml/` research folder. See `README.md` (French) for the product overview.

**Talk to the owner in French.** Code, comments, identifiers, specs and commit messages are in English.

## Commands

```bash
npm run dev                  # site on http://localhost:3000 (needs .env.local)
npm test                     # Vitest, all site tests
npx tsc --noEmit             # typecheck (typedRoutes is on: links take `Route`)
npm run lint
npm run seed:build           # regenerate supabase/seed.sql from data/
python -m pytest test/ml -q  # every Python test, about two minutes
```

`.env.local` needs `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`; without them `createPublicClient()` throws.

## Where things live

| Path | Responsibility |
|---|---|
| `src/lib/recommendation/` | The scoring engine (`engine.ts`, `counter.ts`). Pure functions, fully unit-tested |
| `src/app/page.tsx`, `src/app/api/recommend/route.ts` | Both load `champion_stats` and `counter_relations` and call the engine; keep their queries identical |
| `src/components/home/`, `src/components/draft/`, `src/components/ui/` | Home page sections, the draft tool, shared primitives |
| `src/app/globals.css` | The design tokens (colour palette) as CSS variables, mapped in `tailwind.config.ts` |
| `supabase/migrations/` | Schema, applied in order |
| `supabase/seed.sql` | **Generated** by `scripts/build-seed-data.mjs` from `data/`; never edit it by hand |
| `ml/collect/` | Riot API match collection into a resumable SQLite database |
| `ml/win/` | Win-probability model and its one-time evaluation (`select`, then `test`) |
| `ml/*.py` (top level), `recommendation.py` | The older rule-imitating pipeline, kept for reference |
| `test/ml/` | Python tests, flat, named `test_*.py` |
| `docs/superpowers/specs/`, `docs/superpowers/plans/` | One spec and one plan per piece of work, with the reasons behind each decision |

## Conventions

- **Colours only through tokens.** Never hardcode `text-white`, `bg-stone-*`, hex values or `rgb()` in components; add or reuse a variable in `globals.css` and its Tailwind name. The palette (Hextech: navy, gold, cyan focus) changes in one place.
- **User-facing text is French**, and must stay true: the site never shows an estimated or invented number. When data is missing, the element is hidden, not filled with a plausible value.
- **Tests sit next to the code** (`*.test.ts(x)`) for the site; Python tests import helpers by bare name (`from win_fixtures import ...`) because `test/ml/` has no `__init__.py`.
- **Python command output must be cp1252-safe** (no arrows or typographic quotes): the owner runs them in a Windows console. Every expected failure ends with a French message and a documented exit code, never a traceback.
- **The suite passes at every commit.**

## Guardrails

- **The Riot API key never touches the disk.** It is read from `RIOT_API_KEY` only: no `.env`, no file, no pasting into the conversation. Never run anything against the real Riot API yourself; the owner runs those commands.
- **The collection database lives outside OneDrive**, at `%LOCALAPPDATA%\DraftForMe\matches.sqlite`, and may be written by a running collection. Never open it for writing; `ml.win` and any analysis open it read-only (`?mode=ro`).
- **`ml.win.test` evaluates the test set once.** Its `test_report.json` is the lock; `ml.win.select` refuses to run after it. Never delete that report or rerun an evaluation to get a better number. Trial runs go in a separate `--artifacts` directory.
- **Do not change how the engine scores** as a side effect of other work; scoring changes get their own spec.
- **Push, deploy, or touch the production Supabase project only when the owner asks.**

## Workflow

1. New work starts with a spec, then a plan, both in `docs/superpowers/`.
2. Branch from `main`; never commit feature work directly on `main`.
3. Commit in small steps with messages like `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`.
4. When a statistic or model result is reported, say how it was measured and on how much data.
